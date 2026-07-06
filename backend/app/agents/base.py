from collections.abc import AsyncIterator
import logging
import os

import boto3
from langchain_aws import ChatBedrockConverse
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.prebuilt import create_react_agent

from app.core.config import settings
from app.core.model_config import (
    MODELS,
    DEFAULT_MODEL,
    get_bedrock_model_id,
    get_department_model,
    get_max_tokens,
)
from app.memory.short_term import (
    append_short_term_memory,
    get_short_term_memory,
    get_conversation_summary,
    auto_summarise_if_needed,
)
from app.tools import ALL_TOOLS

logger = logging.getLogger(__name__)

FALLBACK_CHAIN = {"opus": "sonnet", "sonnet": "haiku", "haiku": None}


def _make_bedrock_client():
    return boto3.client(
        "bedrock-runtime",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def _get_bedrock_llm(model_key: str = DEFAULT_MODEL):
    model_id = get_bedrock_model_id(model_key)
    max_tokens = get_max_tokens(model_key)
    client = _make_bedrock_client()
    return ChatBedrockConverse(
        model=model_id,
        client=client,
        region_name=settings.AWS_REGION,
        max_tokens=max_tokens,
    )


def get_llm(model_key: str | None = None):
    if settings.is_bedrock:
        return _get_bedrock_llm(model_key or DEFAULT_MODEL)
    from langchain.chat_models import init_chat_model
    raw_provider = (settings.LLM_PROVIDER or "").strip().lower()
    provider_aliases = {"google": "google_genai", "gemini": "google_genai"}
    provider = provider_aliases.get(raw_provider, raw_provider)
    provider_env_var = {
        "anthropic": "ANTHROPIC_API_KEY",
        "openai": "OPENAI_API_KEY",
        "google_genai": "GOOGLE_API_KEY",
        "mistralai": "MISTRAL_API_KEY",
    }.get(provider)
    if provider_env_var and settings.LLM_API_KEY:
        os.environ[provider_env_var] = settings.LLM_API_KEY
    if provider == "google_genai":
        google_key = settings.GOOGLE_API_KEY or settings.LLM_API_KEY
        if google_key:
            os.environ["GOOGLE_API_KEY"] = google_key
    return init_chat_model(model=settings.LLM_MODEL, model_provider=provider, temperature=0)


def _build_history_messages(memory: list[dict], summary: str) -> list:
    """Convert stored memory + summary into LangChain message objects."""
    msgs = []
    if summary:
        msgs.append(SystemMessage(content=f"[Conversation summary so far]\n{summary}"))
    for m in memory:
        role = m.get("role", "user")
        content = m.get("content", "")
        if not content.strip():
            continue
        if role == "user":
            msgs.append(HumanMessage(content=content))
        elif role == "assistant":
            msgs.append(AIMessage(content=content))
    return msgs


TOOL_ROUTING_GUIDE = (
    "\n\nTOOL ROUTING RULES:\n"
    "- EMAIL: Use `send_email` for ALL emails (it uses Resend and always works). "
    "Only use `gmail_send` if the user explicitly asks to send from their personal Gmail.\n"
    "- SCHEDULING: Use `schedule_meeting` for meetings. It creates Google Calendar events with Google Meet links "
    "when Google is connected. If not connected, it returns an action to connect Google — tell the user.\n"
    "- CALENDAR: Use `google_calendar_list` to view the user's calendar. Requires Google connection.\n"
    "- GMAIL READ: Use `gmail_read` to search/read user's inbox. Requires Google connection.\n"
    "- If any Google tool returns 'action_required: google_connect', tell the user to connect Google in Settings.\n"
    "- REPORTS: Use `file_gen` for PDF reports, `excel_export` for spreadsheets. Always pass full content as the body.\n"
    "- PRICING: Use `mitsumi_pricing` with a product name, principal name, or SKU code.\n"
    "- APPROVALS: Use `request_approval` to submit approval requests to managers.\n"
    "- TASKS: Use `task_creator` to create follow-up tasks.\n"
    "\n"
    "ANTI-HALLUCINATION RULES (CRITICAL):\n"
    "- NEVER make up data. If a tool returns no results, say 'No data found' — do NOT invent numbers.\n"
    "- NEVER claim an action was completed unless a tool confirmed it (e.g., email_id returned, file generated).\n"
    "- If the user references data from earlier in the conversation, USE that context — do NOT say 'I don't have history'.\n"
    "- When asked to export/email previous results, use the data you already have — call `excel_export` or `send_email` with it.\n"
    "- When a tool returns an error, report the error honestly — do NOT pretend it succeeded.\n"
    "- If you need more information, ask ONCE — do NOT repeatedly ask the same question.\n"
    "- All currency amounts are in USD unless explicitly stated otherwise.\n"
)


class BaseAgent:
    name: str = "base"
    system_prompt: str = "You are a helpful assistant."
    allowed_tools: list[str] = []
    quick_actions: list[dict] = []

    def __init__(self, model_key: str | None = None) -> None:
        self._model_key = model_key
        self._init_agent(model_key)

    def _init_agent(self, model_key: str | None):
        self.llm = get_llm(model_key)
        tools = [t for t in ALL_TOOLS if t.name in self.allowed_tools] if self.allowed_tools else ALL_TOOLS
        full_prompt = self.system_prompt + TOOL_ROUTING_GUIDE
        self.graph = create_react_agent(
            model=self.llm,
            tools=tools,
            prompt=full_prompt,
        )

    async def run(self, user_message: str, session_id: str) -> AsyncIterator[dict]:
        # Auto-summarise old messages to keep context manageable
        await auto_summarise_if_needed(session_id)

        # Load conversation history
        memory = await get_short_term_memory(session_id)
        summary = await get_conversation_summary(session_id)

        # Check for uploaded documents and inject context
        doc_context = ""
        try:
            from app.core.documents import list_documents
            docs = await list_documents(session_id)
            if docs:
                doc_names = [d["filename"] for d in docs]
                doc_context = (
                    f"\n[UPLOADED DOCUMENTS in this conversation: {', '.join(doc_names)}. "
                    f"Use the `document_search` tool to read their content when the user asks about them.]"
                )
        except Exception:
            pass

        # Build full message history for the LLM
        history = _build_history_messages(memory, summary)

        # Append the user message with doc context hint
        final_message = user_message
        if doc_context:
            final_message = user_message + doc_context

        history.append(HumanMessage(content=final_message))

        # Store the new user message in short-term memory
        await append_short_term_memory(session_id, {"role": "user", "content": user_message})

        # Stream with FULL conversation history
        final_assistant_text = ""
        async for chunk in self.graph.astream(
            {"messages": history},
            stream_mode="values",
            config={"recursion_limit": 25},
        ):
            message_blob = chunk.get("messages", [])
            text = ""
            if message_blob:
                last = message_blob[-1]
                text = getattr(last, "content", "") if hasattr(last, "content") else str(last)
            # Track the final assistant text (cumulative — last one wins)
            if text and isinstance(message_blob[-1], AIMessage) and not message_blob[-1].tool_calls:
                final_assistant_text = text
            yield {"messages": memory, "chunk": chunk, "text": text}

        # Save the FINAL assistant response to memory ONCE (not per chunk)
        if final_assistant_text.strip():
            await append_short_term_memory(session_id, {"role": "assistant", "content": final_assistant_text})

    async def run_with_fallback(self, user_message: str, session_id: str) -> AsyncIterator[dict]:
        current_key = self._model_key or DEFAULT_MODEL
        while current_key:
            try:
                self._init_agent(current_key)
                async for event in self.run(user_message, session_id):
                    yield event
                return
            except Exception as exc:
                fallback = FALLBACK_CHAIN.get(current_key)
                if fallback:
                    logger.warning("Agent %s failed on %s (%s), falling back to %s",
                                   self.name, current_key, str(exc)[:80], fallback)
                    current_key = fallback
                else:
                    raise
