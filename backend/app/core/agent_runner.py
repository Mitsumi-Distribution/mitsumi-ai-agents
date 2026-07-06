"""Background agent runner — decouples agent execution from WebSocket.

When a user sends a message, the agent runs in a background task that:
1. Executes to completion regardless of WS state
2. Saves results to MongoDB
3. Pushes events to connected WS clients (best-effort)

If the user disconnects and reconnects, they see saved messages.
"""

from __future__ import annotations

import asyncio
import json
import time
import logging
from typing import Any

from langchain_core.messages import AIMessage, ToolMessage

from app.agents.base import BaseAgent
from app.chats.repository import ChatRepository
from app.core.ws import ws_manager

log = logging.getLogger("agent_runner")

# Track active runs by chat_id so we don't double-run
_active_runs: dict[str, asyncio.Task] = {}


def is_running(chat_id: str) -> bool:
    task = _active_runs.get(chat_id)
    return task is not None and not task.done()


async def run_agent_background(
    *,
    agent: BaseAgent,
    user_message: str,
    chat_id: str,
    user_id: str,
    user_email: str,
    agent_name: str,
    outbound: asyncio.Queue | None = None,
) -> None:
    """Fire-and-forget agent execution. Pushes events to outbound queue for WS delivery."""

    chat_repo = ChatRepository()

    async def _emit(data: dict) -> None:
        """Push event to outbound queue for the WS handler to send."""
        if outbound:
            try:
                outbound.put_nowait(data)
            except Exception:
                pass

    assistant_text = ""
    tool_events: list[dict] = []
    seen_tool_calls: set[str] = set()
    seen_tool_results: set[str] = set()
    seen_plan_texts: set[str] = set()
    call_start_by_name: dict[str, float] = {}
    emitted_call_names: set[str] = set()  # track tool names we already sent call events for
    emitted_result_names: set[str] = set()  # track tool names we already sent result events for

    try:
        async for event in agent.run(user_message, session_id=chat_id):
            chunk = event.get("chunk", {})
            messages = chunk.get("messages", [])
            last = messages[-1] if messages else None
            if last is None:
                continue

            if isinstance(last, AIMessage):
                text_content = last.content if isinstance(last.content, str) else ""
                tool_calls = list(last.tool_calls or [])
                if tool_calls:
                    cleaned_text = text_content.strip()
                    if cleaned_text and cleaned_text not in seen_plan_texts:
                        seen_plan_texts.add(cleaned_text)
                        await _emit({"type": "plan", "content": cleaned_text,
                            "tool_calls": [{"name": c.get("name"), "args": c.get("args", {})} for c in tool_calls]})
                    for call in tool_calls:
                        tool_name = call.get("name", "")
                        call_id = str(call.get("id") or "")
                        # Aggressive dedup: only emit one call event per tool name per run
                        dedup_key = f"{tool_name}::{call_id}" if call_id else tool_name
                        if dedup_key in seen_tool_calls:
                            continue
                        seen_tool_calls.add(dedup_key)
                        call_start_by_name[tool_name] = time.time()
                        evt = {"type": "tool_call", "tool": tool_name,
                               "input": call.get("args", {}), "call_id": call_id}
                        tool_events.append(evt)
                        await _emit(evt)
                else:
                    if text_content:
                        assistant_text = text_content
                        await _emit({"type": "token", "content": text_content})

            elif isinstance(last, ToolMessage):
                tool_name = getattr(last, "name", "") or ""
                output = getattr(last, "content", "")
                # Aggressive dedup: only emit one result per tool name
                if tool_name in seen_tool_results:
                    continue
                seen_tool_results.add(tool_name)
                call_id = str(getattr(last, "tool_call_id", "") or "")
                started = call_start_by_name.pop(tool_name, None)
                latency_ms = int((time.time() - started) * 1000) if started else None
                rows = None
                try:
                    if isinstance(output, list):
                        rows = len(output)
                    elif isinstance(output, str) and output.startswith("["):
                        parsed = json.loads(output)
                        if isinstance(parsed, list):
                            rows = len(parsed)
                except Exception:
                    pass
                result_evt: dict = {"type": "tool_result", "tool": tool_name, "output": output, "call_id": call_id}
                if latency_ms is not None:
                    result_evt["latency_ms"] = latency_ms
                if rows is not None:
                    result_evt["rows"] = rows
                tool_events.append(result_evt)
                await _emit(result_evt)

    except asyncio.CancelledError:
        assistant_text += "\n\n*[Generation stopped]*"
    except Exception as exc:
        log.warning("Agent run failed for chat %s: %s", chat_id, str(exc)[:100])
        await _emit({"type": "error", "message": str(exc)[:180]})

    # ALWAYS save the result to MongoDB — this is the key: runs to completion
    if assistant_text.strip():
        try:
            await chat_repo.append_message(
                chat_id=chat_id, role="assistant",
                content=assistant_text, tool_events=tool_events)
            await chat_repo.update_after_exchange(
                chat_id=chat_id, user_id=user_id,
                assistant_preview=assistant_text, increment_by=2)
        except Exception as exc:
            log.error("Failed to save agent response: %s", exc)

    # Token tracking
    try:
        from app.core.token_tracking import record_usage
        from app.core.model_config import get_department_model
        dm = await get_department_model(agent_name)
        await record_usage(
            department=agent_name, model_key=dm.get("key", "haiku"),
            model_id=dm.get("id", ""), input_tokens=len(user_message.split()) * 2,
            output_tokens=len(assistant_text.split()) * 2,
            user_email=user_email, chat_id=chat_id)
    except Exception:
        pass

    await _emit({"type": "done"})

    # Title update — always try for chats with no real title
    if assistant_text.strip():
        try:
            from app.chats.service import ChatService
            from app.core.mongo import mongo_db as _db
            chat_doc = await _db["chats"].find_one({"_id": __import__("bson").ObjectId(chat_id)})
            current_title = (chat_doc or {}).get("title", "")
            if not current_title or current_title.startswith("New chat"):
                chat_svc = ChatService()
                chat_svc.schedule_title_update(
                    user_id=user_id, chat_id=chat_id,
                    user_text=user_message, assistant_text=assistant_text,
                )
        except Exception:
            pass

    # Mentions
    if assistant_text.strip():
        try:
            from app.core.mentions import notify_mentions
            await notify_mentions(author_email=user_email, agent_name=agent_name,
                                  chat_id=chat_id, text=assistant_text)
        except Exception:
            pass

    # Clean up
    _active_runs.pop(chat_id, None)


def start_agent_run(*, outbound: asyncio.Queue | None = None, **kwargs) -> asyncio.Task:
    """Start a background agent run. Returns the task."""
    chat_id = kwargs["chat_id"]
    old = _active_runs.get(chat_id)
    if old and not old.done():
        old.cancel()
    task = asyncio.create_task(run_agent_background(outbound=outbound, **kwargs))
    _active_runs[chat_id] = task
    return task
