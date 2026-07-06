"""Registered task handlers — one module so new long-running jobs live in
one obvious place. Each handler is a plain async function that gets a
`TaskLogger` (for progress + logs + final result) and a `params` dict.

Handlers deliberately lean on the existing agent tools so we get the full
Mitsumi data pipeline for free.
"""

from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone

from app.core.jobs import register_handler
from app.core.mongo import mongo_db
from app.tools.departments import (
    campaign_list as _campaign_list,
    finance_aging_report as _finance_aging_report,
    low_stock_report as _low_stock_report,
    sales_pipeline_summary as _sales_pipeline_summary,
)
from app.tools.email_calendar import send_email as _send_email
from app.tools.file_gen import file_gen as _file_gen


async def _sleep_with_progress(logger, *, steps: int, per_step_ms: int, label: str) -> None:
    """Simulate a chunked long task with incremental progress updates."""
    for i in range(steps):
        await asyncio.sleep(per_step_ms / 1000)
        pct = int(((i + 1) / steps) * 100)
        await logger.progress(pct=pct, message=f"{label} — {pct}%")


# ---------- Department report generation ---------------------------------


@register_handler("department_report")
async def department_report(logger, params: dict) -> dict:
    """Generate a per-department snapshot report (PDF) and stash the URL."""
    department = (params.get("department") or "sales").lower()
    title = f"{department.title()} Department Report"
    await logger.progress(pct=5, message=f"Collecting {department} data…")

    if department == "sales":
        summary = await _sales_pipeline_summary.ainvoke({})
    elif department == "finance":
        summary = await _finance_aging_report.ainvoke({})
    elif department == "marketing":
        summary = await _campaign_list.ainvoke({"status": "all"})
    elif department == "ops":
        summary = await _low_stock_report.ainvoke({"threshold_multiplier": 1.5})
    else:
        raise ValueError(f"Unknown department {department!r}")
    await logger.progress(pct=45, message="Data collected — rendering PDF")

    content = [
        f"{title}",
        "",
        "Generated: " + datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "",
        "--- Live snapshot ---",
        json.dumps(json.loads(summary), indent=2, default=str)[:6000],
    ]
    file_info_raw = await _file_gen.ainvoke({
        "title": f"{department}_report",
        "body": "\n".join(content),
    })
    # file_gen returns a plain path string; wrap it for the result payload.
    file_info = {"path": file_info_raw, "url": f"/static/{str(file_info_raw).split('/')[-1]}"}
    await logger.progress(pct=90, message="PDF written")

    return {"department": department, "file": file_info}


# ---------- Bulk email push ----------------------------------------------


@register_handler("bulk_email")
async def bulk_email(logger, params: dict) -> dict:
    """Send a templated email to a list of customers and track delivery."""
    subject = params.get("subject") or "Update from Mitsumi Distribution"
    body = params.get("body") or "Thanks for being a Mitsumi partner."
    filter_region = params.get("region")
    filter_country = params.get("country")
    filt: dict = {}
    if filter_country:
        filt["country"] = filter_country.upper()
    elif filter_region:
        filt["region"] = filter_region.lower()

    customers = await mongo_db["customers"].find(filt, {"_id": 0, "name": 1, "customer_id": 1, "country": 1}).to_list(length=500)
    total = len(customers)
    if not total:
        await logger.progress(pct=100, message="No customers matched filter")
        return {"sent": 0, "skipped": 0, "filter": filt}

    sent = 0
    for idx, row in enumerate(customers, start=1):
        # Fake per-customer "email" via the existing send_email tool which
        # writes to generated/email_log.jsonl today (real Resend delivery
        # kicks in the moment RESEND_API_KEY is populated).
        await _send_email.ainvoke({
            "to": f"{row['customer_id'].lower()}@customer.example.com",
            "subject": subject,
            "body": f"Hi {row['name']},\n\n{body}",
        })
        sent += 1
        pct = int((idx / total) * 100)
        await logger.progress(pct=pct, message=f"Sent to {row['name']} ({idx}/{total})")
        await asyncio.sleep(0.05)  # polite throttle

    return {"sent": sent, "skipped": 0, "filter": filt, "total_customers": total}


# ---------- Run an agent from a task's stored prompt + tools -----------


@register_handler("run_agent_prompt")
async def run_agent_prompt(logger, params: dict) -> dict:
    """Execute a task's `agent_prompt` against the configured department agent.

    Params:
        task_id: Optional ObjectId of a tasks row. If provided, we load the
            agent_prompt / tools / department from the stored task (so the
            enqueue caller only has to pass an id).
        agent_name / agent_prompt / tools / department: Optional direct
            overrides, useful for ad-hoc runs from the agent-tasks modal.

    The handler marks the underlying task as in_progress → done/failed and
    stores the agent's final text on the task as `agent_result`.
    """
    from bson import ObjectId
    from app.agents import AGENT_REGISTRY
    from app.core.config import settings as app_settings

    task_id = params.get("task_id")
    agent_name = (params.get("agent_name") or params.get("department") or "").lower() or None
    prompt = params.get("agent_prompt") or ""
    selected_tools = params.get("tools") or []

    task_doc = None
    if task_id and ObjectId.is_valid(task_id):
        task_doc = await mongo_db["tasks"].find_one({"_id": ObjectId(task_id)})
        if task_doc:
            agent_name = agent_name or (task_doc.get("department") or "sales")
            prompt = prompt or (task_doc.get("agent_prompt") or task_doc.get("title") or "")
            selected_tools = selected_tools or (task_doc.get("tools") or [])
            # Mark underlying task as in-progress.
            await mongo_db["tasks"].update_one(
                {"_id": task_doc["_id"]},
                {"$set": {"status": "in_progress", "updated_at": datetime.now(timezone.utc)}},
            )
    if not agent_name:
        raise ValueError("agent_name / department is required")
    if not prompt.strip():
        raise ValueError("agent_prompt is empty")

    agent_cls = AGENT_REGISTRY.get(agent_name)
    if not agent_cls:
        raise ValueError(f"Unknown agent: {agent_name}")

    await logger.progress(
        pct=5,
        message=f"Starting {agent_name} agent"
        + (f" with {len(selected_tools)} selected tool(s)" if selected_tools else " with its default toolkit"),
    )

    # Bail gracefully if no LLM key is configured — the product still works
    # (tasks remain pending, UI shows a clear explanation).
    if not app_settings.llm_ready:
        await logger.progress(pct=100, message="LLM is not configured — skipped")
        if task_doc:
            await mongo_db["tasks"].update_one(
                {"_id": task_doc["_id"]},
                {
                    "$set": {
                        "status": "todo",
                        "agent_result": "Skipped: LLM is not configured on the server.",
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
        return {
            "skipped": True,
            "reason": "LLM not configured",
            "agent": agent_name,
            "prompt_chars": len(prompt),
        }

    # Compose a robust task prompt that forces execution without questions
    final_prompt = (
        "CRITICAL INSTRUCTION: This is an automated background task. You MUST:\n"
        "1. Execute the request completely using your available tools\n"
        "2. Do NOT ask clarifying questions — use reasonable defaults\n"
        "3. If generating a report/PDF, call `file_gen` with the full content as body\n"
        "4. If sending email, use the provided email address or a sensible default\n"
        "5. If generating Excel, call `excel_export` with properly formatted JSON data\n"
        "6. Provide a complete, formatted response with your findings\n\n"
    )
    if selected_tools:
        final_prompt += f"Available tools for this task: {', '.join(selected_tools)}.\n\n"
    final_prompt += f"TASK: {prompt}"

    try:
        from app.core.model_config import get_department_model
        dept_model = await get_department_model(agent_name)
        agent = agent_cls(model_key=dept_model.get("key"))
    except Exception as exc:
        await logger.progress(pct=100, message=f"Agent init failed: {exc}")
        raise

    await logger.progress(pct=20, message="Agent is working…")

    collected_text = ""
    tool_calls_log: list[str] = []
    session_id = f"job-{task_id or datetime.now(timezone.utc).timestamp()}"
    try:
        from langchain_core.messages import AIMessage as _AIMessage, ToolMessage as _ToolMessage
        async for event in agent.run(final_prompt, session_id):
            chunk = event.get("chunk", {})
            msgs = chunk.get("messages", [])
            if not msgs:
                continue
            last_msg = msgs[-1]
            if isinstance(last_msg, _AIMessage):
                text = last_msg.content if isinstance(last_msg.content, str) else ""
                if text and not last_msg.tool_calls:
                    collected_text = text
                if last_msg.tool_calls:
                    for tc in last_msg.tool_calls:
                        tool_name = tc.get("name", "tool")
                        tool_calls_log.append(tool_name)
                        await logger.progress(
                            pct=min(85, 30 + len(tool_calls_log) * 10),
                            message=f"Using {tool_name}…",
                        )
            elif isinstance(last_msg, _ToolMessage):
                tool_name = getattr(last_msg, "name", "")
                output = getattr(last_msg, "content", "")
                # Check for tool errors
                if "error" in str(output).lower()[:100]:
                    await logger.progress(
                        pct=min(85, 30 + len(tool_calls_log) * 10),
                        message=f"{tool_name} returned with warning",
                    )
    except Exception as exc:
        if task_doc:
            await mongo_db["tasks"].update_one(
                {"_id": task_doc["_id"]},
                {
                    "$set": {
                        "status": "todo",
                        "agent_result": f"Agent error: {exc}",
                        "updated_at": datetime.now(timezone.utc),
                    }
                },
            )
        raise

    # Persist result back onto the task.
    if task_doc:
        await mongo_db["tasks"].update_one(
            {"_id": task_doc["_id"]},
            {
                "$set": {
                    "status": "done",
                    "agent_result": collected_text.strip()[:10000],
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
    await logger.progress(pct=100, message=f"Done — used {len(tool_calls_log)} tool(s): {', '.join(tool_calls_log[:5])}" if tool_calls_log else "Done")
    return {
        "agent": agent_name,
        "task_id": task_id,
        "response_chars": len(collected_text),
        "tools_used": tool_calls_log,
        "preview": collected_text[:5000],
    }


# ---------- Simple demo job (for smoke-testing the runtime) --------------


@register_handler("demo_echo")
async def demo_echo(logger, params: dict) -> dict:
    """A 20-second demo job with chunked progress — handy for UI testing."""
    steps = int(params.get("steps", 10))
    await _sleep_with_progress(logger, steps=steps, per_step_ms=1500, label="Working")
    return {"echo": params.get("message", "hello"), "steps": steps}
