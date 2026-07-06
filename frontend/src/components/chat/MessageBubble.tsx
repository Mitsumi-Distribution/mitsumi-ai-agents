import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AtSign, Check, CheckCircle, ClipboardCopy, Download, FileSpreadsheet, FileText, FileUp, Pencil, RefreshCw, Trash2, User, Wrench } from "lucide-react";
import { cn } from "../../lib/cn";
import { useSessionStore } from "../../store/session";

const MITSUMI_LOGO = "https://res.cloudinary.com/dunssu2gi/image/upload/v1767612787/blog-images/tfvwseshobpnx7blnimx.png";

type Props = {
  role: "user" | "assistant";
  content: string;
  time?: string;
  score?: number;
  agentName?: string;
  chatId?: string;
  /** Index within the messages array — used for edit/delete/retry */
  messageIndex?: number;
  onEdit?: (index: number, newContent: string) => void;
  onDelete?: (index: number) => void;
  onRetry?: (index: number) => void;
};

const EMAIL_RE = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;

export function MessageBubble({ role, content, time, score, agentName, chatId, messageIndex, onEdit, onDelete, onRetry }: Props) {
  const isUser = role === "user";
  const myEmail = useSessionStore((s) => s.user?.email?.toLowerCase() ?? null);
  const [hovering, setHovering] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [copied, setCopied] = useState(false);

  // Detect file upload message
  const uploadMatch = content.match(/^\[Uploaded: (.+?) — (\d+) chunks?, (.+?)\]$/);
  if (uploadMatch && isUser) {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 max-w-md" data-testid="upload-card">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
            <FileUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 truncate">{uploadMatch[1]}</p>
            <p className="text-[11px] text-emerald-600/70 dark:text-emerald-400/70">{uploadMatch[2]} chunks · {uploadMatch[3]}</p>
          </div>
          <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
        </div>
      </div>
    );
  }

  function handleCopy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function handleEditSave() {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== content && onEdit && messageIndex != null) {
      onEdit(messageIndex, trimmed);
    }
    setEditing(false);
  }

  return (
    <div
      className={cn("group flex gap-3 md:gap-4 animate-fade-up", isUser && "flex-row-reverse")}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Avatar */}
      {isUser ? (
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl shrink-0 flex items-center justify-center shadow-sm bg-slate-900 dark:bg-white text-white dark:text-slate-900">
          <User className="w-4 h-4" />
        </div>
      ) : (
        <div className="w-8 h-8 md:w-9 md:h-9 rounded-xl shrink-0 overflow-hidden shadow-sm bg-white dark:bg-slate-800 flex items-center justify-center">
          <img src={MITSUMI_LOGO} alt="Mitsumi AI" className="w-full h-full object-contain p-0.5" />
        </div>
      )}

      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        <p className="text-[11px] uppercase tracking-widest text-slate-400 mb-1">
          {isUser ? "You" : "Mitsumi AI"}
        </p>

        {editing ? (
          <div className="w-full max-w-full">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl text-sm font-body bg-brand/5 dark:bg-brand/10 border border-brand/30 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand/30 resize-none"
              rows={Math.min(8, editValue.split("\n").length + 1)}
              autoFocus
              data-testid="message-edit-input"
            />
            <div className="flex justify-end gap-2 mt-1.5">
              <button
                onClick={() => { setEditing(false); setEditValue(content); }}
                className="text-[11px] px-3 py-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                data-testid="message-edit-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="text-[11px] px-3 py-1 rounded-lg bg-brand text-white hover:bg-brand-light"
                data-testid="message-edit-save"
              >
                Save & Resend
              </button>
            </div>
          </div>
        ) : (
          <div className="relative">
            <div
              className={cn(
                "max-w-full text-sm leading-relaxed font-body break-words rounded-2xl px-4 py-3",
                isUser
                  ? "bg-brand/10 text-slate-900 dark:bg-brand/20 dark:text-white rounded-tr-sm whitespace-pre-wrap"
                  : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm"
              )}
            >
              {isUser
                ? content
                : <RichContent content={content} agentName={agentName} chatId={chatId} myEmail={myEmail} />
              }
              {(time || score != null) && (
                <div className={cn("mt-2 flex items-center gap-1 text-xs", isUser ? "text-slate-500" : "text-slate-400")}>
                  {time && <span className="font-mono">{time}</span>}
                  {time && score != null && <span>·</span>}
                  {score != null && <span>Score: {score.toFixed(2)}</span>}
                </div>
              )}
            </div>

            {/* Action bar on hover */}
            {hovering && !editing && (
              <div
                className={cn(
                  "absolute top-1 flex items-center gap-0.5 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm px-0.5 py-0.5 z-10",
                  isUser ? "left-1" : "right-1"
                )}
                data-testid="message-actions"
              >
                <ActionBtn
                  icon={copied ? <Check className="w-3 h-3 text-emerald-500" /> : <ClipboardCopy className="w-3 h-3" />}
                  label="Copy"
                  onClick={handleCopy}
                  testId="message-action-copy"
                />
                {isUser && onEdit && messageIndex != null && (
                  <ActionBtn
                    icon={<Pencil className="w-3 h-3" />}
                    label="Edit"
                    onClick={() => { setEditValue(content); setEditing(true); }}
                    testId="message-action-edit"
                  />
                )}
                {isUser && onRetry && messageIndex != null && (
                  <ActionBtn
                    icon={<RefreshCw className="w-3 h-3" />}
                    label="Retry"
                    onClick={() => onRetry(messageIndex)}
                    testId="message-action-retry"
                  />
                )}
                {!isUser && onRetry && messageIndex != null && (
                  <ActionBtn
                    icon={<RefreshCw className="w-3 h-3" />}
                    label="Regenerate"
                    onClick={() => onRetry(messageIndex)}
                    testId="message-action-regenerate"
                  />
                )}
                {onDelete && messageIndex != null && (
                  <ActionBtn
                    icon={<Trash2 className="w-3 h-3" />}
                    label="Delete"
                    onClick={() => onDelete(messageIndex)}
                    testId="message-action-delete"
                    danger
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, testId, danger }: { icon: React.ReactNode; label: string; onClick: () => void; testId: string; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      data-testid={testId}
      className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
        danger
          ? "text-slate-400 hover:text-danger hover:bg-danger/10"
          : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
      )}
    >
      {icon}
    </button>
  );
}

/** Rich content renderer for assistant messages. */
function RichContent({
  content,
  agentName,
  chatId,
  myEmail,
}: {
  content: string;
  agentName?: string;
  chatId?: string;
  myEmail: string | null;
}) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className="space-y-2">
      {blocks.map((block, i) => {
        if (block.type === "table") {
          return <DataTable key={i} headers={block.headers} rows={block.rows} />;
        }
        if (block.type === "separator") {
          return <hr key={i} className="border-slate-200 dark:border-slate-700 my-3" />;
        }
        if (block.type === "file_link") {
          return <FileDownloadCard key={i} url={block.url} filename={block.filename} format={block.format} />;
        }
        if (block.type === "action_card") {
          return <ActionCard key={i} action={block.action} label={block.label} url={block.url} message={block.message} />;
        }
        if (block.type === "heading") {
          const Tag = block.level <= 2 ? "h3" : "h4";
          return (
            <Tag key={i} className={cn(
              "font-display font-semibold text-slate-900 dark:text-white",
              block.level <= 2 ? "text-base mt-3 mb-1" : "text-sm mt-2 mb-0.5"
            )}>
              {renderInline(block.text, { agentName, chatId, myEmail })}
            </Tag>
          );
        }
        if (block.type === "list") {
          const Wrapper = block.ordered ? "ol" : "ul";
          return (
            <Wrapper key={i} className={cn("pl-4 space-y-0.5", block.ordered ? "list-decimal" : "list-disc")}>
              {block.items.map((item, j) => (
                <li key={j} className="text-sm leading-relaxed">
                  {renderInline(item, { agentName, chatId, myEmail })}
                </li>
              ))}
            </Wrapper>
          );
        }
        return (
          <p key={i} className="whitespace-pre-wrap">
            {renderInline(block.text, { agentName, chatId, myEmail })}
          </p>
        );
      })}
    </div>
  );
}

// ── Block parser ──
type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "separator" }
  | { type: "file_link"; url: string; filename: string; format: string }
  | { type: "action_card"; action: string; label: string; url: string; message: string };

function parseBlocks(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const hMatch = line.match(/^(#{1,4})\s+(.+)/);
    if (hMatch) {
      blocks.push({ type: "heading", level: hMatch[1].length, text: hMatch[2] });
      i++;
      continue;
    }
    // horizontal separator (---, ___, ***)
    if (/^[-_*]{3,}\s*$/.test(line)) {
      blocks.push({ type: "separator" });
      i++;
      continue;
    }
    // File reference detection: generated/file.pdf, /static/file.xlsx (may be wrapped in backticks or bold)
    const cleanLine = line.replace(/`/g, "").replace(/\*\*/g, "");
    const fileMatch = cleanLine.match(/(generated\/[\w._-]+\.(pdf|xlsx|csv)|\/static\/[\w._-]+\.(pdf|xlsx|csv))/i);
    if (fileMatch) {
      const filePath = fileMatch[1];
      const ext = fileMatch[2] || fileMatch[3] || "pdf";
      const filename = filePath.split("/").pop() || filePath;
      const url = filePath.startsWith("/static/") ? filePath : `/static/${filename}`;
      blocks.push({ type: "file_link", url, filename, format: ext });
      i++;
      continue;
    }
    // Action card detection: connect Google, connect Gmail, etc.
    const actionPatterns = [
      { re: /connect.*google.*account.*settings/i, action: "google_connect", label: "Connect Google Account", url: "/settings" },
      { re: /connect.*gmail.*settings/i, action: "google_connect", label: "Connect Gmail", url: "/settings" },
      { re: /connect.*calendar.*settings/i, action: "google_connect", label: "Connect Google Calendar", url: "/settings" },
    ];
    const actionMatch = actionPatterns.find(p => p.re.test(cleanLine));
    if (actionMatch) {
      blocks.push({ type: "action_card", action: actionMatch.action, label: actionMatch.label, url: actionMatch.url, message: line.replace(/\*\*/g, "") });
      i++;
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\|?\s*[-:]+/.test(lines[i + 1])) {
      const headers = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|")) {
        const row = lines[i].split("|").map((c) => c.trim()).filter(Boolean);
        if (row.length > 0) rows.push(row);
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }
    if (/^[-*]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }
    if (!line.trim()) { i++; continue; }
    let para = line;
    i++;
    while (
      i < lines.length && lines[i].trim() &&
      !lines[i].match(/^#{1,4}\s/) && !lines[i].includes("|") &&
      !/^[-*]\s/.test(lines[i]) && !/^\d+\.\s/.test(lines[i])
    ) {
      para += "\n" + lines[i];
      i++;
    }
    blocks.push({ type: "paragraph", text: para });
  }
  return blocks;
}

// ── Inline renderer ──
function renderInline(
  text: string,
  ctx: { agentName?: string; chatId?: string; myEmail: string | null }
): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Bold (**) first, then code (with file detection), then markdown links, then email, then italic (*)
  const INLINE_RE = /(\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})|\*([^*]+?)\*)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = INLINE_RE.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(<Fragment key={`t${key++}`}>{text.slice(lastIdx, match.index)}</Fragment>);
    }
    if (match[2] != null) {
      parts.push(<strong key={`b${key++}`} className="font-semibold">{match[2]}</strong>);
    } else if (match[3] != null) {
      // Check if the code block contains a file path → render as download link
      const codeText = match[3];
      const filePathMatch = codeText.match(/^(generated\/[\w._-]+\.(pdf|xlsx|csv)|\/static\/[\w._-]+\.(pdf|xlsx|csv))$/i);
      if (filePathMatch) {
        const fp = filePathMatch[1];
        const fname = fp.split("/").pop() || fp;
        const ext = filePathMatch[2] || filePathMatch[3] || "pdf";
        parts.push(<InlineFileLink key={`fl${key++}`} filename={fname} format={ext} />);
      } else {
        parts.push(
          <code key={`c${key++}`} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-brand">
            {codeText}
          </code>
        );
      }
    } else if (match[4] != null && match[5] != null) {
      // [text](url) markdown link
      const linkUrl = match[5];
      const linkText = match[4];
      if (linkUrl.match(/\.(pdf|xlsx|csv)/i)) {
        const fname = linkUrl.split("/").pop() || linkText;
        const ext = linkUrl.match(/\.(pdf|xlsx|csv)/i)?.[1] || "pdf";
        parts.push(<InlineFileLink key={`fl${key++}`} filename={fname} format={ext} />);
      } else {
        const apiBase = import.meta.env.VITE_API_BASE ?? "";
        const fullUrl = linkUrl.startsWith("/") ? `${apiBase.replace(/\/api$/, "")}${linkUrl}` : linkUrl;
        parts.push(
          <a key={`a${key++}`} href={fullUrl} target="_blank" rel="noopener noreferrer"
            className="text-brand hover:underline font-medium">{linkText}</a>
        );
      }
    } else if (match[6] != null) {
      parts.push(
        <MentionChip key={`m${key++}`} email={match[6]} agentName={ctx.agentName} chatId={ctx.chatId}
          isMe={ctx.myEmail !== null && match[6].toLowerCase() === ctx.myEmail} />
      );
    } else if (match[7] != null) {
      parts.push(<em key={`i${key++}`}>{match[7]}</em>);
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    parts.push(<Fragment key={`tail${key++}`}>{text.slice(lastIdx)}</Fragment>);
  }
  return parts.length > 0 ? parts : text;
}

// ── Data table ──
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 my-2">
      <table className="w-full text-xs" data-testid="rich-data-table">
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 text-slate-700 dark:text-slate-300">
                  {renderCellInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Render inline markdown inside table cells (bold, italic, code, links) */
function renderCellInline(text: string): React.ReactNode {
  // Handle markdown links [text](url), bold, italic, code, and bare URLs
  const CELL_RE = /(\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|`([^`]+)`|(https?:\/\/[^\s)<]+)|\*([^*]+?)\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = CELL_RE.exec(text)) !== null) {
    if (match.index > lastIdx) parts.push(<Fragment key={`ct${key++}`}>{text.slice(lastIdx, match.index)}</Fragment>);
    if (match[2] != null && match[3] != null) {
      // [text](url) markdown link
      const href = match[3];
      const label = match[2];
      parts.push(
        <a key={`cl${key++}`} href={href} target="_blank" rel="noopener noreferrer"
          className="text-brand hover:underline font-medium inline-flex items-center gap-1">
          {label}
          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      );
    } else if (match[4] != null) {
      parts.push(<strong key={`cb${key++}`} className="font-semibold">{match[4]}</strong>);
    } else if (match[5] != null) {
      parts.push(<code key={`cc${key++}`} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono text-brand">{match[5]}</code>);
    } else if (match[6] != null) {
      // Bare URL
      const url = match[6];
      const shortUrl = url.length > 40 ? url.slice(0, 37) + "..." : url;
      parts.push(
        <a key={`cu${key++}`} href={url} target="_blank" rel="noopener noreferrer"
          className="text-brand hover:underline font-medium inline-flex items-center gap-1">
          {shortUrl}
          <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      );
    } else if (match[7] != null) {
      parts.push(<em key={`ci${key++}`}>{match[7]}</em>);
    }
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) parts.push(<Fragment key={`ct${key++}`}>{text.slice(lastIdx)}</Fragment>);
  return parts.length > 0 ? parts : text;
}

// ── Action card (connect Google, etc.) ──
function ActionCard({ action, label, url, message }: { action: string; label: string; url: string; message: string }) {
  const isGoogle = action === "google_connect";
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.04] my-2" data-testid={`action-card-${action}`}>
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
        isGoogle ? "bg-gradient-to-br from-blue-500 to-red-500" : "bg-brand/10")}>
        {isGoogle ? (
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
        ) : (
          <Wrench className="w-5 h-5 text-brand" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-amber-700 dark:text-amber-400">{message}</p>
      </div>
      <a href={url} data-testid={`action-btn-${action}`}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-brand/40 hover:shadow-md transition-all shrink-0 no-underline">
        {isGoogle && (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
        )}
        {label}
      </a>
    </div>
  );
}

// ── Inline file download link (for paths inside text) ──
function InlineFileLink({ filename, format }: { filename: string; format: string }) {
  const API_BASE = import.meta.env.VITE_API_BASE ?? "";
  const fullUrl = `${API_BASE.replace(/\/api$/, "")}/api/static/${filename}`;
  const Icon = format === "xlsx" || format === "csv" ? FileSpreadsheet : FileText;
  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={filename}
      data-testid={`inline-download-${filename}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 mx-0.5 rounded-lg bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20 transition-colors text-xs font-semibold no-underline"
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{filename}</span>
      <Download className="w-3 h-3 opacity-60" />
    </a>
  );
}

// ── File download card ──
function FileDownloadCard({ url, filename, format }: { url: string; filename: string; format: string }) {
  const API_BASE = import.meta.env.VITE_API_BASE ?? "";
  const fullUrl = url.startsWith("http") ? url : `${API_BASE.replace(/\/api$/, '')}/api${url.startsWith("/") ? url : "/" + url}`;
  const Icon = format === "xlsx" || format === "csv" ? FileSpreadsheet : FileText;
  const colors = format === "xlsx"
    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400"
    : "bg-brand/10 border-brand/20 text-brand";
  return (
    <a
      href={fullUrl}
      target="_blank"
      rel="noopener noreferrer"
      download={filename}
      data-testid={`file-download-${filename}`}
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:shadow-md my-2 no-underline",
        colors
      )}
    >
      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", format === "xlsx" ? "bg-emerald-500/20" : "bg-brand/20")}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{filename}</p>
        <p className="text-[11px] text-slate-500 uppercase">{format.toUpperCase()} document</p>
      </div>
      <Download className="w-4 h-4 shrink-0 opacity-60" />
    </a>
  );
}

// ── Mention chip ──
function MentionChip({ email, agentName, chatId, isMe }: { email: string; agentName?: string; chatId?: string; isMe: boolean }) {
  const label = email.split("@")[0];
  const baseCls = cn(
    "inline-flex items-center gap-0.5 align-baseline mx-0.5 px-1.5 py-0 rounded-md text-[0.85em] font-medium transition-colors no-underline",
    isMe ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/25"
      : "bg-brand/10 text-brand hover:bg-brand/20"
  );
  const body = (<><AtSign className="w-3 h-3 opacity-70" /><span className="truncate max-w-[14ch]">{label}</span></>);
  if (!agentName || !chatId) return <span title={email} className={baseCls}>{body}</span>;
  return <Link to={`/agent/${agentName}/c/${chatId}`} title={`${email}${isMe ? " · this is you" : ""}`} className={baseCls}>{body}</Link>;
}
