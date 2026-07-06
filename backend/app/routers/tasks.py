"""Lightweight task tracker used by the Tasks page.

Tasks are backed by the `tasks` Mongo collection and are scoped per user.
Any user can create/list/update/delete their own tasks. Admins can list all.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user_full
from app.core.mongo import mongo_db

router = APIRouter(prefix="/tasks", tags=["tasks"])


# Default tool bundles per department (mirrors routers/agents.py). We keep a
# local copy to avoid a circular import from routers.agents.
_DEFAULT_TOOLS_BY_DEPT: dict[str, list[str]] = {
    "sales": ["crm_search", "sales_pipeline_summary", "mitsumi_pricing"],
    "marketing": ["campaign_list", "crm_search", "send_email"],
    "finance": ["invoice_search", "finance_aging_report", "crm_search"],
    "ops": ["ticket_search", "low_stock_report", "shipment_status"],
}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "title": doc.get("title"),
        "notes": doc.get("notes") or "",
        "status": doc.get("status") or "todo",
        "priority": doc.get("priority") or "medium",
        "department": doc.get("department"),
        "agent_prompt": doc.get("agent_prompt") or "",
        "tools": doc.get("tools") or [],
        "agent_result": doc.get("agent_result") or "",
        "agent_job_id": doc.get("agent_job_id") or None,
        "due_at": doc.get("due_at").isoformat() if isinstance(doc.get("due_at"), datetime) else doc.get("due_at"),
        "created_by": doc.get("created_by"),
        "created_at": doc["created_at"].isoformat() if isinstance(doc.get("created_at"), datetime) else doc.get("created_at"),
        "updated_at": doc["updated_at"].isoformat() if isinstance(doc.get("updated_at"), datetime) else doc.get("updated_at"),
    }


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str | None = None
    priority: str = Field(default="medium")
    status: str = Field(default="todo")
    department: str | None = None
    agent_prompt: str | None = None
    tools: list[str] | None = None
    due_at: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    notes: str | None = None
    priority: str | None = None
    status: str | None = None
    department: str | None = None
    agent_prompt: str | None = None
    tools: list[str] | None = None
    due_at: datetime | None = None


@router.get("")
async def list_tasks(
    status: str | None = Query(default=None),
    department: str | None = Query(default=None),
    user=Depends(get_current_user_full),
) -> list[dict]:
    filt: dict[str, Any] = {"created_by": user["email"]}
    if status:
        filt["status"] = status
    if department:
        filt["department"] = department
    cursor = mongo_db["tasks"].find(filt).sort([("status", 1), ("priority", -1), ("created_at", -1)])
    docs = await cursor.to_list(length=200)
    return [_serialize(t) for t in docs]


@router.post("")
async def create_task(payload: TaskCreate, user=Depends(get_current_user_full)) -> dict:
    # Role-scoped: if the task is tied to a department, the user must have
    # access to that department's module. Super admins bypass.
    if payload.department and not user.get("is_super_admin"):
        modules = user.get("modules") or []
        if f"department:{payload.department}" not in modules:
            raise HTTPException(
                status_code=403,
                detail=f"You don't have access to the {payload.department} department",
            )
    now = _now()
    doc = {
        **payload.dict(),
        "created_by": user["email"],
        "created_at": now,
        "updated_at": now,
    }
    # Auto-pick default tools if user didn't provide any and a department is set.
    if payload.department and not (payload.tools or []):
        doc["tools"] = _DEFAULT_TOOLS_BY_DEPT.get(payload.department, [])
    result = await mongo_db["tasks"].insert_one(doc)
    doc["_id"] = result.inserted_id
    return _serialize(doc)


@router.get("/{task_id}")
async def get_task(task_id: str, user=Depends(get_current_user_full)) -> dict:
    """Single-resource read — admins can read anyone's task, owners their own."""
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")
    filt: dict = {"_id": ObjectId(task_id)}
    if not user.get("is_super_admin"):
        filt["created_by"] = user["email"]
    doc = await mongo_db["tasks"].find_one(filt)
    if not doc:
        raise HTTPException(status_code=404, detail="Task not found")
    return _serialize(doc)


@router.patch("/{task_id}")
async def update_task(task_id: str, payload: TaskUpdate, user=Depends(get_current_user_full)) -> dict:
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")
    target = await mongo_db["tasks"].find_one({"_id": ObjectId(task_id), "created_by": user["email"]})
    if not target:
        raise HTTPException(status_code=404, detail="Task not found")
    update = {k: v for k, v in payload.dict(exclude_none=True).items()}
    if update:
        update["updated_at"] = _now()
        await mongo_db["tasks"].update_one({"_id": target["_id"]}, {"$set": update})
    target = await mongo_db["tasks"].find_one({"_id": target["_id"]})
    return _serialize(target)


@router.delete("/{task_id}")
async def delete_task(task_id: str, user=Depends(get_current_user_full)) -> dict:
    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")
    res = await mongo_db["tasks"].delete_one({"_id": ObjectId(task_id), "created_by": user["email"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}


@router.post("/{task_id}/run")
async def run_task_with_agent(task_id: str, user=Depends(get_current_user_full)) -> dict:
    """Enqueue a background agent-run for this task.

    The handler (`run_agent_prompt`) picks up the stored `agent_prompt`, the
    selected tools and the department, spins up the matching agent, and
    writes the final reply back onto the task as `agent_result`.
    """
    from app.core.jobs import enqueue as enqueue_job

    if not ObjectId.is_valid(task_id):
        raise HTTPException(status_code=400, detail="Invalid task id")
    task = await mongo_db["tasks"].find_one({"_id": ObjectId(task_id), "created_by": user["email"]})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if not (task.get("agent_prompt") or "").strip():
        raise HTTPException(status_code=400, detail="This task has no agent prompt to run")

    job = await enqueue_job(
        kind="run_agent_prompt",
        title=f"Run agent: {task.get('title')}",
        department=task.get("department"),
        params={"task_id": task_id},
        created_by=user["email"],
    )
    # Link the job back onto the task so the UI can surface it.
    await mongo_db["tasks"].update_one(
        {"_id": task["_id"]},
        {"$set": {"agent_job_id": job["id"], "updated_at": _now()}},
    )
    task = await mongo_db["tasks"].find_one({"_id": task["_id"]})
    return {"task": _serialize(task), "job": job}
