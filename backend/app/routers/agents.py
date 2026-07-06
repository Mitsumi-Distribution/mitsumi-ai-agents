import asyncio
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from langchain_core.messages import AIMessage, ToolMessage
from pydantic import BaseModel

import json as _json
import time as _time

from app.agents import AGENT_REGISTRY
from app.agents.base import BaseAgent
from app.chats import ChatService
from app.chats.repository import ChatRepository
from app.core.auth import get_current_user, get_current_user_full, get_ws_user
from app.core.mentions import notify_mentions
from app.core.mongo import user_has_module
from app.core.ws import ws_manager
from app.memory.short_term import get_short_term_memory, set_short_term_memory
from app.tools import ALL_TOOLS

router = APIRouter(prefix="/agent", tags=["agents"])
ws_router = APIRouter(tags=["agents-ws"])
chat_service = ChatService()
chat_repo = ChatRepository()


# ---------- Tool catalogue -------------------------------------------------

# Short user-facing description + friendly label per tool (used by the "+"
# tool picker in chat and the Tasks composer). Labels are non-technical.
TOOL_META: dict[str, dict[str, str]] = {
    "crm_search": {"label": "Find customers & leads", "description": "Look up Mitsumi customers, contacts or leads."},
    "crm_update": {"label": "Update a CRM record", "description": "Change owner, stage or notes on a CRM record."},
    "customer_analytics": {"label": "Customer 360", "description": "Full customer view: deals, invoices, tickets, health score."},
    "order_search": {"label": "Find orders", "description": "Search sales orders by customer, ID or status."},
    "sales_forecast": {"label": "Sales forecast", "description": "Weighted pipeline forecast with best/worst case."},
    "sales_pipeline_summary": {"label": "Pipeline summary", "description": "Totals and weighted forecast by stage."},
    "quote_search": {"label": "Find quotes", "description": "Search quotes by customer, principal or status."},
    "mitsumi_pricing": {"label": "Product pricing", "description": "Per-SKU cost, list price and margin."},
    "invoice_search": {"label": "Find invoices", "description": "Search invoices, dates and outstanding amounts."},
    "finance_aging_report": {"label": "AR aging report", "description": "Accounts-receivable aging buckets."},
    "campaign_list": {"label": "Marketing campaigns", "description": "List campaigns and their performance."},
    "ticket_search": {"label": "Find support tickets", "description": "Search tickets by status or priority."},
    "shipment_status": {"label": "Shipment tracking", "description": "Shipment tracking and ETAs."},
    "low_stock_report": {"label": "Low stock alerts", "description": "Warehouse SKUs below reorder threshold."},
    "erp_query": {"label": "Query ERP data", "description": "Run a structured query against ERP data."},
    "rag_search": {"label": "Search company docs", "description": "Search Mitsumi internal knowledge base."},
    "file_gen": {"label": "Generate PDF report", "description": "Create a Mitsumi-branded PDF report."},
    "excel_export": {"label": "Export to Excel", "description": "Generate a branded Excel spreadsheet."},
    "document_search": {"label": "Search uploads", "description": "Search through documents uploaded to this conversation."},
    "schedule_meeting": {"label": "Schedule meeting", "description": "Create a meeting with attendees, date, time, and agenda."},
    "data_comparison": {"label": "Compare data", "description": "Compare metrics across regions, periods, or products."},
    "task_creator": {"label": "Create task", "description": "Create a new task that appears in the Tasks page."},
    "google_calendar_create": {"label": "Create calendar event", "description": "Create a Google Calendar event with attendees."},
    "google_calendar_list": {"label": "List calendar events", "description": "View upcoming Google Calendar events."},
    "gmail_send": {"label": "Send Gmail", "description": "Send an email via user's Gmail account."},
    "gmail_read": {"label": "Read Gmail", "description": "Read emails from user's Gmail inbox."},
    "request_approval": {"label": "Request approval", "description": "Submit an approval request to a manager."},
    "send_email": {"label": "Send email", "description": "Draft and send an email (via Resend)."},
    "calendar_event": {"label": "Create calendar event", "description": "Create a Google Calendar event."},
    "web_search": {"label": "Web search", "description": "Search the public web for market intel."},
}

# Default tool bundles per department — used to auto-pick when the user
# doesn't specify tools on a task or agent job.
DEPARTMENT_DEFAULT_TOOLS: dict[str, list[str]] = {
    "sales": ["crm_search", "sales_pipeline_summary", "mitsumi_pricing", "customer_analytics"],
    "marketing": ["campaign_list", "crm_search", "send_email", "customer_analytics"],
    "finance": ["invoice_search", "finance_aging_report", "crm_search", "customer_analytics"],
    "ops": ["ticket_search", "low_stock_report", "shipment_status", "customer_analytics"],
}


@router.get("/{name}/tools")
async def list_agent_tools(name: str, user=Depends(get_current_user_full)) -> dict:
    """Return the tools a specific agent is allowed to invoke, plus quick actions and model info."""
    from app.core.model_config import get_department_model

    agent_cls = AGENT_REGISTRY.get(name)
    if not agent_cls:
        raise HTTPException(status_code=404, detail="Unknown agent")
    if not (user_has_module(user, f"agent:{name}") or user_has_module(user, f"department:{name}")):
        raise HTTPException(status_code=403, detail=f"You don't have access to the {name} agent")
    allowed = set(getattr(agent_cls, "allowed_tools", []) or [])
    tools = []
    for tool in ALL_TOOLS:
        if allowed and tool.name not in allowed:
            continue
        meta = TOOL_META.get(tool.name, {})
        tools.append(
            {
                "name": tool.name,
                "label": meta.get("label") or tool.name.replace("_", " ").title(),
                "description": meta.get("description") or getattr(tool, "description", "") or "",
            }
        )
    quick_actions = getattr(agent_cls, "quick_actions", []) or []
    model_info = await get_department_model(name)
    return {
        "agent": name,
        "tools": tools,
        "defaults": DEPARTMENT_DEFAULT_TOOLS.get(name, []),
        "quick_actions": quick_actions,
        "model": model_info,
    }


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class VoiceCorrectRequest(BaseModel):
    text: str
    agent_name: str = "sales"


@router.post("/voice/correct")
async def voice_autocorrect(payload: VoiceCorrectRequest, user=Depends(get_current_user_full)) -> dict:
    """Use the LLM to clean up a voice transcription for clarity and intent."""
    from app.agents.base import get_llm
    from app.core.model_config import DEFAULT_MODEL
    from langchain_core.messages import HumanMessage, SystemMessage

    raw = payload.text.strip()
    if not raw or len(raw) < 3:
        return {"original": raw, "corrected": raw, "changed": False}

    try:
        llm = get_llm(DEFAULT_MODEL)  # Use fast Haiku for corrections
        response = await llm.ainvoke([
            SystemMessage(content=(
                "You are a voice transcription corrector for a business AI platform (Mitsumi Distribution). "
                "The user spoke to a " + payload.agent_name + " agent. "
                "Fix speech-to-text errors, mishearings, and unclear words. "
                "Keep the user's INTENT — don't change what they meant to say. "
                "Common business terms: ROI, pipeline, CRM, invoice, campaign, forecast, "
                "Dell, HPE, Aruba, Fortinet, Microsoft, Cisco, Veeam. "
                "Return ONLY the corrected text, nothing else."
            )),
            HumanMessage(content=f"Correct this voice transcription:\n\n{raw}"),
        ])
        corrected = response.content.strip().strip('"').strip("'")
        # Sanity check: if correction is wildly different length, keep original
        if len(corrected) > len(raw) * 3 or len(corrected) < len(raw) * 0.2:
            return {"original": raw, "corrected": raw, "changed": False}
        return {"original": raw, "corrected": corrected, "changed": corrected != raw}
    except Exception:
        return {"original": raw, "corrected": raw, "changed": False}


@router.post("/{name}/chat")
async def chat(name: str, payload: ChatRequest, user=Depends(get_current_user_full)) -> dict:
    agent_cls = AGENT_REGISTRY.get(name)
    if not agent_cls:
        raise HTTPException(status_code=404, detail="Unknown agent")
    if not (user_has_module(user, f"agent:{name}") or user_has_module(user, f"department:{name}")):
        raise HTTPException(status_code=403, detail=f"You don't have access to the {name} agent")
    if not payload.session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    chat = await chat_repo.get_chat_for_agent(chat_id=payload.session_id, user_id=user["id"], agent_name=name)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")

    agent = agent_cls()
    session_id = payload.session_id
    final_text = ""
    await chat_repo.append_message(chat_id=session_id, role="user", content=payload.message)
    async for event in agent.run(payload.message, session_id=session_id):
        if event["text"]:
            final_text = event["text"]
    await chat_repo.append_message(chat_id=session_id, role="assistant", content=final_text)
    await chat_repo.update_after_exchange(chat_id=session_id, user_id=user["id"], assistant_preview=final_text, increment_by=2)
    if final_text.strip():
        try:
            await notify_mentions(
                author_email=user.get("email", ""),
                agent_name=name,
                chat_id=session_id,
                text=final_text,
            )
        except Exception:
            pass
    return {"session_id": session_id, "agent": name, "response": final_text, "user": user["id"]}


@ws_router.websocket("/ws/{name}/chat/{chat_id}")
async def stream_chat(websocket: WebSocket, name: str, chat_id: str) -> None:
    try:
        user = await get_ws_user(websocket)
    except HTTPException:
        await websocket.close(code=1008)
        return
    await ws_manager.connect(user["id"], websocket)
    agent_cls = AGENT_REGISTRY.get(name)
    if not agent_cls:
        await websocket.send_json({"type": "error", "message": "Unknown agent"})
        await websocket.close()
        ws_manager.disconnect(user["id"], websocket)
        return

    chat = await chat_repo.get_chat_for_agent(chat_id=chat_id, user_id=user["id"], agent_name=name)
    if not chat:
        await websocket.send_json({"type": "error", "message": "Chat not found"})
        await websocket.close(code=1008)
        ws_manager.disconnect(user["id"], websocket)
        return

    # Tell the client we're ready + whether the LLM is actually wired.
    from app.core.config import settings as _settings
    from app.core.model_config import get_department_model as _get_dept_model
    from app.core.documents import get_context_info as _get_ctx
    dept_model = await _get_dept_model(name)
    ctx_info = await _get_ctx(chat_id)
    await websocket.send_json({
        "type": "ready",
        "llm": _settings.llm_ready,
        "model": dept_model.get("name", ""),
        "model_tier": dept_model.get("tier", ""),
        "context": ctx_info,
    })

    memory = await get_short_term_memory(chat_id)
    if not memory:
        existing = await chat_repo.list_messages(chat_id=chat_id)
        if existing:
            await set_short_term_memory(
                chat_id,
                [{"role": msg.get("role", "assistant"), "content": msg.get("content", "")} for msg in existing],
            )

    inbound: asyncio.Queue[dict[str, Any]] = asyncio.Queue()

    async def _receive_loop() -> None:
        try:
            while True:
                payload = await websocket.receive_json()
                await inbound.put(payload if isinstance(payload, dict) else {})
        except WebSocketDisconnect:
            await inbound.put({"_disconnect": True})
        except Exception:
            await inbound.put({"_disconnect": True})

    receiver_task = asyncio.create_task(_receive_loop())
    agent: BaseAgent | None = None
    # Outbound queue for agent events — serializes all WS sends
    outbound: asyncio.Queue = asyncio.Queue()

    async def _drain_outbound():
        """Continuously drain the outbound queue and send to WS."""
        while True:
            try:
                data = await asyncio.wait_for(outbound.get(), timeout=0.1)
                try:
                    await websocket.send_json(data)
                except Exception:
                    break
            except asyncio.TimeoutError:
                continue
            except asyncio.CancelledError:
                # Drain remaining items before exit
                while not outbound.empty():
                    try:
                        data = outbound.get_nowait()
                        await websocket.send_json(data)
                    except Exception:
                        break
                break

    drain_task = asyncio.create_task(_drain_outbound())

    try:
        while True:
            payload = await inbound.get()
            if payload.get("_disconnect"):
                break
            if payload.get("_ping"):
                try:
                    await websocket.send_json({"type": "pong"})
                except Exception:
                    pass
                continue
            action = str(payload.get("action", "")).strip().lower()
            if action == "stop":
                from app.core.agent_runner import _active_runs
                task = _active_runs.get(chat_id)
                if task and not task.done():
                    task.cancel()
                try:
                    await websocket.send_json({"type": "status", "state": "stopped", "message": "Generation stopped"})
                    await websocket.send_json({"type": "done"})
                except Exception:
                    pass
                continue
            if action in ("pause", "resume"):
                continue

            user_message = payload.get("message", "")
            if not user_message:
                continue
            if not _settings.llm_ready:
                await websocket.send_json({"type": "error", "message": "Chat is paused — LLM is not configured."})
                await websocket.send_json({"type": "done"})
                continue

            if agent is None:
                try:
                    from app.core.model_config import get_department_model as _gdm
                    _dept_model = await _gdm(name)
                    agent = agent_cls(model_key=_dept_model.get("key"))
                    from app.tools.document_tool import set_current_chat_id
                    set_current_chat_id(chat_id)
                    from app.tools.google_tools import set_google_user_email
                    set_google_user_email(user.get("email", ""))
                except Exception as exc:
                    await websocket.send_json({"type": "error", "message": f"Agent init failed: {str(exc)[:160]}"})
                    await websocket.send_json({"type": "done"})
                    continue

            await chat_repo.append_message(chat_id=chat_id, role="user", content=user_message)

            from app.core.agent_runner import start_agent_run
            start_agent_run(
                outbound=outbound,
                agent=agent,
                user_message=user_message,
                chat_id=chat_id,
                user_id=user["id"],
                user_email=user.get("email", ""),
                agent_name=name,
            )

    except WebSocketDisconnect:
        pass
    except Exception:
        try:
            await websocket.send_json({"type": "error", "message": "Connection error. Agent continues in background."})
        except Exception:
            pass
    finally:
        drain_task.cancel()
        receiver_task.cancel()
        ws_manager.disconnect(user["id"], websocket)
