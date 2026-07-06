import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUp, BookOpen, Cpu, Download, FileUp, Loader2, Mic, MicOff, Paperclip, Pause, Play, Plus, Share2, Sparkles, Square, StopCircle, Wrench, X, Zap } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { ToolResultCard } from "./ToolResultCard";
import { PlanCard } from "./PlanCard";
import { MentionAutocomplete } from "./MentionAutocomplete";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useChatStore } from "../../store/chat";
import { useSessionStore } from "../../store/session";
import { Badge } from "../ui/Badge";
import { cn } from "../../lib/cn";
import { fetchAgentTools, uploadFileToChat, getChatContext, apiFetch, type MentionCandidate, type ContextInfo } from "../../api/client";
import { useToast } from "../../store/toast";
import type { AgentToolInfo, QuickAction, ModelSpec } from "../../types";

const MITSUMI_LOGO = "https://res.cloudinary.com/dunssu2gi/image/upload/v1767612787/blog-images/tfvwseshobpnx7blnimx.png";

type Props = {
  agentName: string;
  chatId: string;
  connected: boolean;
  llmReady?: boolean | null;
  modelName?: string;
  modelTier?: string;
  docsOpen?: boolean;
  onToggleDocs?: () => void;
  sendMessage: (message: string) => void;
  sendControl: (action: "pause" | "resume" | "stop") => void;
};

const EMPTY_MESSAGES: never[] = [];
const EMPTY_EVENTS: never[] = [];

export function AgentChat({ agentName, chatId, connected, llmReady, modelName, modelTier, docsOpen, onToggleDocs, sendMessage, sendControl }: Props) {
  const [input, setInput] = useState("");
  const [tools, setTools] = useState<AgentToolInfo[]>([]);
  const [quickActions, setQuickActions] = useState<QuickAction[]>([]);
  const [agentModel, setAgentModel] = useState<ModelSpec | null>(null);
  const [toolPickerOpen, setToolPickerOpen] = useState(false);
  const [pickedTools, setPickedTools] = useState<string[]>([]);
  const messagesByChat = useChatStore((state) => state.messages);
  const eventsByChat = useChatStore((state) => state.events);
  const messages = useMemo(() => messagesByChat[chatId] ?? EMPTY_MESSAGES, [messagesByChat, chatId]);
  const events = useMemo(() => eventsByChat[chatId] ?? EMPTY_EVENTS, [eventsByChat, chatId]);
  const addMessage = useChatStore((state) => state.addMessage);
  const editMessage = useChatStore((state) => state.editMessage);
  const deleteMessage = useChatStore((state) => state.deleteMessage);
  const clearEvents = useChatStore((state) => state.clearEvents);
  const toast = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolBtnRef = useRef<HTMLButtonElement>(null);

  // Voice input
  const [listening, setListening] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [showCorrectBtn, setShowCorrectBtn] = useState(false);
  const recognitionRef = useRef<any>(null);

  // File upload
  const [uploading, setUploading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; chunks: number }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context indicator
  const [contextInfo, setContextInfo] = useState<ContextInfo | null>(null);
  const [slashDocsOpen, setSlashDocsOpen] = useState(false);

  const toolsByName = useMemo(() => new Map(tools.map((t) => [t.name, t])), [tools]);
  const friendlyLabel = (n: string) => toolsByName.get(n)?.label || n;

  // ───────── Mention autocomplete state ─────────
  // `mentionQuery` is the raw @token under the caret — `null` means the
  // autocomplete is dismissed.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const mentionAnchor = useRef<{ start: number; end: number } | null>(null);
  const mentionKeyHandler = useRef<((e: KeyboardEvent<HTMLTextAreaElement>) => boolean) | null>(null);

  useEffect(() => {
    fetchAgentTools(agentName)
      .then((r) => {
        setTools(r.tools);
        setQuickActions(r.quick_actions || []);
        if (r.model) setAgentModel(r.model as ModelSpec);
      })
      .catch(() => {});
  }, [agentName]);

  // Load context info on mount and after message changes
  useEffect(() => {
    if (!chatId) return;
    getChatContext(chatId).then(setContextInfo).catch(() => {});
  }, [chatId, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, events.length]);

  // Auto-grow the composer.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [input]);

  function dispatch() {
    if (!input.trim() || !connected || llmReady === false) return;
    const userText = input.trim();
    // Build the full message with tool hints for the LLM
    const pieces: string[] = [];
    if (pickedTools.length > 0) {
      pieces.push(`Please use these tools as appropriate: ${pickedTools.join(", ")}.`);
    }
    pieces.push(userText);
    const fullMessage = pieces.join("\n\n");
    // Show only the user's text in the chat bubble (not the tool prefix)
    addMessage(chatId, { role: "user", content: userText });
    sendMessage(fullMessage);
    setInput("");
    setPickedTools([]);
    setShowCorrectBtn(false);
  }

  function handleEditMessage(index: number, newContent: string) {
    editMessage(chatId, index, newContent);
    // Re-send the edited message
    sendMessage(newContent);
  }

  function handleDeleteMessage(index: number) {
    deleteMessage(chatId, index);
  }

  function handleRetry(index: number) {
    const msg = messages[index];
    if (!msg) return;
    if (msg.role === "user") {
      // Re-send this user message
      sendMessage(msg.content);
    } else {
      // Regenerate: find the preceding user message and re-send it
      for (let k = index - 1; k >= 0; k--) {
        if (messages[k].role === "user") {
          sendMessage(messages[k].content);
          break;
        }
      }
    }
  }

  function handleShareChat() {
    const text = messages.map((m) =>
      `${m.role === "user" ? "You" : "Mitsumi AI"}: ${m.content}`
    ).join("\n\n---\n\n");
    navigator.clipboard.writeText(text).then(() => {
      toast.success("Chat copied to clipboard");
    }).catch(() => {
      toast.error("Failed to copy");
    });
  }

  function handleExportPdf() {
    const API_BASE = import.meta.env.VITE_API_BASE ?? "";
    const token = useSessionStore.getState().token;
    const url = `${API_BASE}/chats/${chatId}/export-pdf`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        if (!res.ok) throw new Error("Export failed");
        const blob = await res.blob();
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `chat_export_${chatId.slice(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        toast.success("Chat exported as PDF");
      })
      .catch(() => toast.error("Failed to export PDF"));
  }

  async function autoCorrectVoice() {
    const rawText = input.trim();
    if (!rawText || rawText.length < 5) return;
    setCorrecting(true);
    try {
      const res = await apiFetch<{ original: string; corrected: string; changed: boolean }>(
        "/agent/voice/correct",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText, agent_name: agentName }),
        }
      );
      if (res.changed && res.corrected) {
        setInput(res.corrected);
        toast.success("Text refined by AI");
      } else {
        toast.success("Looks good — no changes needed");
      }
    } catch {
      toast.error("Correction failed");
    } finally {
      setCorrecting(false);
      setShowCorrectBtn(false);
    }
  }

  function toggleVoice() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Voice input not supported in this browser");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    const userLang = navigator.language || "en-US";
    recognition.lang = userLang;
    try { (recognition as any).maxAlternatives = 3; } catch {}
    recognitionRef.current = recognition;

    let finalTranscript = input;
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += (finalTranscript ? " " : "") + transcript;
        } else {
          interim = transcript;
        }
      }
      setInput(finalTranscript + (interim ? " " + interim : ""));
    };
    recognition.onend = () => {
      setListening(false);
      // Show the AI refine button after voice stops
      if (finalTranscript.trim().length >= 5) {
        setShowCorrectBtn(true);
      }
    };
    recognition.onerror = (e: any) => {
      setListening(false);
      if (e.error !== "aborted") toast.error(`Voice: ${e.error || "failed"}`);
    };
    recognition.start();
    setListening(true);
    setShowCorrectBtn(false);
    toast.success(`Listening (${userLang.split("-")[0]})…`);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      try {
        const result = await uploadFileToChat(chatId, file);
        setAttachedFiles((prev) => [...prev, { name: result.filename, chunks: result.chunk_count }]);
        // Add a visual upload message to the chat
        addMessage(chatId, {
          role: "user",
          content: `[Uploaded: ${result.filename} — ${result.chunk_count} chunk${result.chunk_count !== 1 ? "s" : ""}, ${(result.file_size / 1024).toFixed(1)}KB]`,
        });
        toast.success(`${result.filename} uploaded — ${result.chunk_count} chunks ready`);
        getChatContext(chatId).then(setContextInfo).catch(() => {});
      } catch (err: any) {
        toast.error(err.message || "Upload failed");
      }
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatch();
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // The autocomplete owns Up/Down/Enter/Tab/Escape while open.
    if (mentionKeyHandler.current && mentionKeyHandler.current(event)) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      dispatch();
    }
  }

  /**
   * Inspect the textarea around the caret and, if the caret sits inside an
   * `@word` token, surface that token as `mentionQuery` so the autocomplete
   * opens. The "@" must be at the start of the text, or follow whitespace, to
   * avoid triggering on e.g. an email the user is already typing.
   */
  function onInputChange(value: string) {
    setInput(value);
    // Detect /docs slash command
    const isSlash = value.startsWith("/") || value.includes(" /docs");
    if (value.trim() === "/docs" || value.trimEnd().endsWith("/docs")) {
      setSlashDocsOpen(true);
    } else if (slashDocsOpen && !value.includes("/docs")) {
      setSlashDocsOpen(false);
    }
    const el = textareaRef.current;
    const caret = el?.selectionStart ?? value.length;
    // Walk back from the caret to find the last "@" in the current word.
    let start = caret;
    while (start > 0) {
      const ch = value[start - 1];
      if (ch === "@") {
        start -= 1;
        break;
      }
      if (/\s/.test(ch)) {
        start = -1;
        break;
      }
      start -= 1;
      if (caret - start > 40) {
        start = -1;
        break;
      }
    }
    if (start < 0 || value[start] !== "@") {
      if (mentionQuery !== null) setMentionQuery(null);
      mentionAnchor.current = null;
      return;
    }
    // "@" must be at string start or preceded by whitespace.
    const prev = start > 0 ? value[start - 1] : "";
    if (prev && !/\s/.test(prev)) {
      if (mentionQuery !== null) setMentionQuery(null);
      mentionAnchor.current = null;
      return;
    }
    const token = value.slice(start + 1, caret);
    if (/\s/.test(token)) {
      if (mentionQuery !== null) setMentionQuery(null);
      mentionAnchor.current = null;
      return;
    }
    mentionAnchor.current = { start, end: caret };
    setMentionQuery(token);
  }

  function handleMentionPick(candidate: MentionCandidate) {
    const anchor = mentionAnchor.current;
    if (!anchor) {
      setMentionQuery(null);
      return;
    }
    const before = input.slice(0, anchor.start);
    const after = input.slice(anchor.end);
    const replacement = `${candidate.email} `;
    const next = `${before}${replacement}${after}`;
    setInput(next);
    setMentionQuery(null);
    mentionAnchor.current = null;
    // Restore caret right after the inserted email.
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      const pos = before.length + replacement.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    });
  }

  function togglePickedTool(name: string) {
    setPickedTools((prev) => (prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name]));
  }

  // LangGraph sends cumulative token events — each contains the full response so far.
  // Take only the LAST token event as the complete response.
  const tokenEvents = events.filter((e): e is Extract<typeof e, { type: "token" }> => e.type === "token");
  const streamedTokens = tokenEvents.length > 0 ? tokenEvents[tokenEvents.length - 1].content : "";

  // Derive "agent is working" state:
  //   - the last message in the log is from the user, AND
  //   - we haven't yet seen a `done` or `error` event for this turn.
  // Label morphs based on the most recent progress signal so users see
  // "Thinking… → Using crm_search… → Composing a reply…".
  const lastMessageRole = messages.length > 0 ? messages[messages.length - 1].role : null;
  const terminalEventSeen = events.some((e) => e.type === "done" || e.type === "error");
  const awaitingAgent = lastMessageRole === "user" && !terminalEventSeen;
  const hasToolCall = events.some((e) => e.type === "tool_call");
  const hasPlan = events.some((e) => e.type === "plan");
  const lastToolCall = [...events].reverse().find((e) => e.type === "tool_call") as
    | Extract<(typeof events)[number], { type: "tool_call" }>
    | undefined;
  const statusEvent = [...events].reverse().find((e) => e.type === "status") as
    | Extract<(typeof events)[number], { type: "status" }>
    | undefined;
  const isPaused = awaitingAgent && statusEvent?.state === "paused";
  const thinkingLabel = isPaused
    ? "Paused"
    : streamedTokens
    ? "Composing a reply…"
    : lastToolCall
    ? `Using ${lastToolCall.tool}…`
    : hasPlan
    ? "Planning next step…"
    : hasToolCall
    ? "Working…"
    : "Thinking…";

  const errorEvent = events.find((e) => e.type === "error") as
    | Extract<(typeof events)[number], { type: "error" }>
    | undefined;

  useEffect(() => {
    if (!terminalEventSeen) return;
    if (streamedTokens.trim()) {
      addMessage(chatId, { role: "assistant", content: streamedTokens });
    }
    // Give the user a moment to read the error / last tool card before the
    // transient event list is wiped out.
    const timer = window.setTimeout(() => clearEvents(chatId), errorEvent ? 4000 : 50);
    return () => window.clearTimeout(timer);
  }, [terminalEventSeen, streamedTokens, addMessage, chatId, clearEvents, errorEvent]);

  const isEmpty = messages.length === 0 && events.length === 0;

  // Use backend-provided quick actions, with fallbacks
  const displayActions = quickActions.length > 0 ? quickActions : [
    { label: "Quick summary", prompt: `Give me a quick summary of the ${agentName} department` },
    { label: "Today's focus", prompt: "What should I focus on first today?" },
    { label: "Status update", prompt: "Draft a short status update I can share with my manager" },
  ];

  const tierColors: Record<string, string> = {
    fast: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    balanced: "bg-brand/10 text-brand border-brand/20",
    powerful: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  };
  const resolvedModelName = modelName || agentModel?.name || "";
  const resolvedTier = modelTier || agentModel?.tier || "";

  return (
    <div className="flex flex-col h-full overflow-hidden w-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2.5 shrink-0 w-full">
        <div className="w-8 h-8 rounded-full overflow-hidden bg-white dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-100 dark:border-slate-700">
          <img src={MITSUMI_LOGO} alt="Mitsumi AI" className="w-full h-full object-contain p-0.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-display font-semibold text-slate-800 dark:text-white capitalize truncate">
            Mitsumi AI · {agentName}
          </p>
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            {(() => {
              // Status precedence: LLM-missing > Online > Connecting > Reconnecting.
              // `llmReady===false` is authoritative from the server flag so it
              // must win even while the WS is still reconnecting.
              const degraded = llmReady === false;
              const online = !degraded && connected && llmReady === true;
              const connecting = !degraded && connected && llmReady === null;
              const dotCls = online
                ? "bg-emerald-500 animate-pulse"
                : degraded
                ? "bg-amber-500"
                : "bg-slate-400";
              const textCls = online
                ? "text-emerald-500"
                : degraded
                ? "text-amber-500"
                : "text-slate-400";
              const label = degraded
                ? "LLM key missing"
                : online
                ? "Online"
                : connecting
                ? "Connecting…"
                : "Reconnecting…";
              return (
                <>
                  <span className={cn("inline-block w-1.5 h-1.5 rounded-full", dotCls)} />
                  <span className={textCls} data-testid="agent-chat-status">{label}</span>
                </>
              );
            })()}
            <span className="text-slate-400">·</span>
            <span className="text-slate-500 dark:text-slate-400">{tools.length} tools</span>
            {resolvedModelName && (
              <>
                <span className="text-slate-400">·</span>
                <span className={cn("inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono border", tierColors[resolvedTier] || "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:border-slate-700")}>
                  <Cpu className="w-2.5 h-2.5" />
                  {resolvedModelName}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {messages.length > 0 && (
            <>
              <button type="button" onClick={handleExportPdf} data-testid="agent-chat-export-pdf-btn" title="Export PDF"
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors">
                <Download className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={handleShareChat} data-testid="agent-chat-share-btn" title="Share"
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors">
                <Share2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {onToggleDocs && (
            <button type="button" onClick={onToggleDocs} data-testid="toggle-docs-panel" title="Documents & Notes"
              className={cn("w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                docsOpen ? "bg-brand/10 text-brand" : "text-slate-400 hover:text-brand hover:bg-brand/10")}>
              <BookOpen className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-[10px] font-mono text-slate-400 ml-1 hidden lg:inline">#{chatId.slice(0, 6)}</span>
        </div>
      </div>

      {/* LLM-missing banner */}
      {llmReady === false && (
        <div
          data-testid="agent-chat-llm-banner"
          className="mx-4 md:mx-6 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span>
            Chat is paused — the workspace LLM key isn't configured yet. Ask a super-admin to add
            it in <span className="font-semibold">Settings → System Health</span>.
          </span>
        </div>
      )}

      {/* Scroll area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
        <div className={cn("mx-auto w-full max-w-3xl px-4 md:px-6", isEmpty ? "h-full flex items-center" : "py-6 space-y-4")}>
          {isEmpty && (
            <div className="w-full text-center py-12">
              <div className="w-16 h-16 rounded-3xl bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center mx-auto mb-5 overflow-hidden border border-slate-200 dark:border-slate-700">
                <img src={MITSUMI_LOGO} alt="Mitsumi AI" className="w-12 h-12 object-contain" />
              </div>
              <h3 className="text-xl font-display font-semibold text-slate-800 dark:text-white">
                How can I help you today?
              </h3>
              <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">
                Ask the {agentName} agent a question or tap a quick action below.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-8 max-w-3xl mx-auto">
                {displayActions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    data-testid={`agent-chat-quick-action-${idx}`}
                    onClick={() => {
                      setInput(action.prompt);
                      textareaRef.current?.focus();
                    }}
                    className="group text-left text-xs px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-brand/40 hover:shadow-sm transition-all text-slate-700 dark:text-slate-300 flex items-start gap-2"
                  >
                    <Zap className="w-3.5 h-3.5 text-brand mt-0.5 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
                    <span>{action.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <MessageBubble
              key={`msg-${idx}`}
              role={msg.role}
              content={msg.content}
              agentName={agentName}
              chatId={chatId}
              messageIndex={idx}
              onEdit={msg.role === "user" ? handleEditMessage : undefined}
              onDelete={handleDeleteMessage}
              onRetry={handleRetry}
            />
          ))}

          {events.map((event, idx) => {
            if (event.type === "plan") {
              return (
                <PlanCard
                  key={`plan-${idx}`}
                  content={event.content}
                  toolCalls={event.tool_calls}
                />
              );
            }
            if (event.type === "tool_call") {
              return (
                <ToolResultCard
                  key={`tool-call-${idx}`}
                  tool={event.tool}
                  payload={event.input}
                  kind="call"
                />
              );
            }
            if (event.type === "tool_result") {
              return (
                <ToolResultCard
                  key={`tool-result-${idx}`}
                  tool={event.tool}
                  payload={event.output}
                  kind="result"
                  latencyMs={event.latency_ms}
                  rows={event.rows}
                />
              );
            }
            if (event.type === "error") {
              // Error is rendered once, at the bottom of the stream, by the
              // awaitingAgent/errorEvent block — skip here to avoid dupes.
              return null;
            }
            return null;
          })}

          {streamedTokens && (
            <MessageBubble role="assistant" content={streamedTokens} agentName={agentName} chatId={chatId} />
          )}

          {awaitingAgent && !streamedTokens && (
            <ThinkingIndicator label={thinkingLabel} />
          )}

          {errorEvent && (
            <div
              data-testid="agent-chat-error"
              className="rounded-2xl border border-danger/20 bg-danger/5 text-danger text-xs px-4 py-3 animate-fade-up"
            >
              {errorEvent.message || "Something went wrong. Please retry."}
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="px-3 md:px-6 pb-4 pt-2 bg-gradient-to-t from-slate-50 via-slate-50/90 to-transparent dark:from-slate-950 dark:via-slate-950/90"
      >
        <div className="mx-auto w-full max-w-3xl">
          {/* Context indicator */}
          {contextInfo && (contextInfo.message_count > 0 || contextInfo.document_count > 0) && (
            <div className="flex items-center gap-2 sm:gap-3 mb-2 px-1 text-[10px] text-slate-400 flex-wrap" data-testid="context-indicator">
              <span className="inline-flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                {contextInfo.message_count} msg{contextInfo.message_count !== 1 ? "s" : ""}
              </span>
              {contextInfo.has_summary && (
                <span className="inline-flex items-center gap-1 text-amber-500">
                  <Zap className="w-3 h-3" />
                  Summarized
                </span>
              )}
              {contextInfo.document_count > 0 && (
                <span className="inline-flex items-center gap-1 text-brand">
                  <Paperclip className="w-3 h-3" />
                  {contextInfo.document_count} file{contextInfo.document_count !== 1 ? "s" : ""} ({contextInfo.document_chunks} chunks)
                </span>
              )}
              <span className="ml-auto font-mono">~{contextInfo.estimated_tokens.toLocaleString()} tokens</span>
            </div>
          )}

          {/* Attached files + picked tools */}
          {(pickedTools.length > 0 || attachedFiles.length > 0) && (
            <div className="flex items-center gap-2 mb-2 flex-wrap" data-testid="agent-chat-attachments">
              {attachedFiles.map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <Paperclip className="w-3 h-3" />
                  {f.name}
                  <button type="button" onClick={() => setAttachedFiles((p) => p.filter((_, j) => j !== i))} className="ml-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {pickedTools.map((name) => (
                <button key={name} type="button" onClick={() => togglePickedTool(name)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20"
                  data-testid={`agent-chat-picked-${name}`}>
                  <Wrench className="w-3 h-3" />{friendlyLabel(name)}<X className="w-3 h-3" />
                </button>
              ))}
            </div>
          )}

          {/* AI Refine button — appears after voice input */}
          {showCorrectBtn && input.trim().length >= 5 && (
            <div className="flex items-center gap-2 mb-2 animate-fade-up" data-testid="voice-refine-bar">
              <button
                type="button"
                onClick={autoCorrectVoice}
                disabled={correcting}
                data-testid="voice-refine-btn"
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                  correcting
                    ? "bg-brand/10 text-brand border-brand/20 cursor-wait"
                    : "bg-gradient-to-r from-brand to-brand-dark text-white border-transparent hover:shadow-md hover:scale-[1.02] active:scale-100"
                )}
              >
                {correcting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {correcting ? "Refining…" : "AI Refine"}
              </button>
              <button
                type="button"
                onClick={() => setShowCorrectBtn(false)}
                className="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                Dismiss
              </button>
              <span className="text-[10px] text-slate-400 ml-auto hidden sm:inline">Fix voice transcription with AI</span>
            </div>
          )}

          <div className="relative">
            <MentionAutocomplete query={mentionQuery} onPick={handleMentionPick} onClose={() => setMentionQuery(null)} keyHandlerRef={mentionKeyHandler} />
            {/* /docs slash command popover */}
            {slashDocsOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 z-30 animate-fade-up" data-testid="slash-docs-popover">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Reference a document</p>
                  <button type="button" onClick={() => setSlashDocsOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
                {contextInfo && contextInfo.documents.length > 0 ? (
                  <div className="space-y-1">
                    {contextInfo.documents.map((doc, i) => (
                      <button key={i} type="button" data-testid={`slash-doc-${i}`}
                        onClick={() => {
                          const ref = `[Referencing: ${doc.filename}] `;
                          setInput((prev) => prev.replace(/\/docs\s*$/, "").replace(/\/docs/, "").trim() + (prev.trim() ? " " : "") + ref);
                          setSlashDocsOpen(false);
                          textareaRef.current?.focus();
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                        <Paperclip className="w-3.5 h-3.5 text-brand shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate block">{doc.filename}</span>
                          <span className="text-[10px] text-slate-400">{doc.chunks} chunks</span>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="py-3 text-center">
                    <Paperclip className="w-5 h-5 text-slate-300 mx-auto mb-1.5" />
                    <p className="text-xs text-slate-500">No documents uploaded yet</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Use the 📎 button to upload a file first</p>
                  </div>
                )}
              </div>
            )}
            {/* Hidden file input */}
            <input ref={fileInputRef} type="file" className="hidden" multiple
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.json,.xml"
              onChange={handleFileUpload} data-testid="agent-chat-file-input" />
            <div className={cn(
              "flex items-end gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm transition-shadow focus-within:shadow-md focus-within:border-brand/40 px-2 py-2",
              !connected && "opacity-60"
            )}>
              {/* Tool picker */}
              <div className="relative">
                <button ref={toolBtnRef} type="button" aria-label="Add tool" data-testid="agent-chat-tool-picker-btn"
                  onClick={() => setToolPickerOpen((v) => !v)}
                  className={cn("w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors shrink-0",
                    toolPickerOpen && "bg-brand/10 text-brand")}>
                  <Plus className="w-4 h-4" />
                </button>
                {toolPickerOpen && (
                  <ToolPickerPopover anchorRef={toolBtnRef} tools={tools} picked={pickedTools} onToggle={togglePickedTool} onClose={() => setToolPickerOpen(false)} />
                )}
              </div>

              {/* File attach */}
              <button type="button" aria-label="Attach file" data-testid="agent-chat-attach-btn"
                onClick={() => fileInputRef.current?.click()} disabled={uploading}
                className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0",
                  uploading ? "text-brand animate-pulse" : "text-slate-400 hover:text-brand hover:bg-brand/10")}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
              </button>

              {/* Voice */}
              <button type="button" onClick={toggleVoice} aria-label={listening ? "Stop" : "Voice"}
                data-testid="agent-chat-voice-btn"
                className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0",
                  listening ? "bg-danger/10 text-danger animate-pulse" :
                  correcting ? "bg-brand/10 text-brand animate-pulse" :
                  "text-slate-400 hover:text-brand hover:bg-brand/10")}>
                {listening ? <MicOff className="w-3.5 h-3.5" /> :
                 correcting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> :
                 <Mic className="w-3.5 h-3.5" />}
              </button>

              <textarea
                ref={textareaRef}
                data-testid="agent-chat-input"
                rows={1}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => {
                  // Let `onMouseDown` on the popover fire first.
                  setTimeout(() => setMentionQuery(null), 120);
                }}
                placeholder={
                  llmReady === false
                    ? "LLM key missing — ask an admin to configure it in Settings → System Health."
                    : !connected
                    ? "Reconnecting…"
                    : `Message ${agentName}… (type /docs to reference files)`
                }
                disabled={!connected || llmReady === false}
                className="flex-1 resize-none max-h-60 bg-transparent text-sm font-body text-slate-900 dark:text-white placeholder:text-slate-400 outline-none px-1 py-2 leading-relaxed"
              />

              {awaitingAgent ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => sendControl(isPaused ? "resume" : "pause")}
                    aria-label={isPaused ? "Resume generation" : "Pause generation"}
                    data-testid="agent-chat-pause-btn"
                    className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-105"
                  >
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => sendControl("stop")}
                    aria-label="Stop generation"
                    data-testid="agent-chat-stop-btn"
                    className="w-9 h-9 rounded-full bg-danger text-white flex items-center justify-center shrink-0 transition-all duration-150 hover:scale-105"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="submit"
                  disabled={!connected || !input.trim() || llmReady === false}
                  aria-label="Send message"
                  data-testid="agent-chat-send-btn"
                  className="w-9 h-9 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shrink-0 transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105"
                >
                  {!connected || llmReady === false ? <StopCircle className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>

          <p className="text-[10px] text-center text-slate-400 mt-2">
            {listening ? "Listening… tap mic to stop" :
             correcting ? "AI is refining your text…" :
             "Enter to send · Shift+Enter for new line"}
          </p>
        </div>
      </form>
    </div>
  );
}

function ToolPickerPopover({
  anchorRef,
  tools,
  picked,
  onToggle,
  onClose
}: {
  anchorRef: React.RefObject<HTMLButtonElement>;
  tools: AgentToolInfo[];
  picked: string[];
  onToggle: (name: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Popover sits ABOVE the button with 8px gap; clamp left to keep within viewport.
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - 332));
    const bottom = window.innerHeight - rect.top + 8;
    setPos({ left, bottom });
  }, [anchorRef]);

  const filtered = useMemo(
    () =>
      query
        ? tools.filter((t) =>
            `${t.name} ${t.label ?? ""} ${t.description}`.toLowerCase().includes(query.toLowerCase())
          )
        : tools,
    [tools, query]
  );

  if (!pos) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-label="Tool picker"
        className="fixed z-[100] w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-fade-up"
        style={{ left: pos.left, bottom: pos.bottom }}
        data-testid="agent-chat-tool-picker"
      >
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Agent tools</p>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools…"
            autoFocus
            data-testid="agent-chat-tool-picker-search"
            className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          />
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-xs text-slate-400 text-center">No tools match</p>
          ) : (
            filtered.map((tool) => {
              const active = picked.includes(tool.name);
              return (
                <button
                  key={tool.name}
                  type="button"
                  onClick={() => onToggle(tool.name)}
                  data-testid={`agent-chat-tool-option-${tool.name}`}
                  className={cn(
                    "w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 flex items-start gap-2 transition-colors",
                    active && "bg-brand/5"
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 w-6 h-6 rounded-md shrink-0 flex items-center justify-center",
                      active ? "bg-brand text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                    )}
                  >
                    <Wrench className="w-3 h-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {tool.label || tool.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{tool.description}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
