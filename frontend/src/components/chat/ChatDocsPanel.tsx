import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, FileText, FileUp, Loader2, Paperclip, Plus, StickyNote, Trash2, X } from "lucide-react";
import { addChatNote, deleteChatNote, listChatArtifacts, listChatNotes, type ArtifactsList, type ChatNote } from "../../api/client";
import { useToast } from "../../store/toast";
import { formatDateTime } from "../../lib/format";
import { cn } from "../../lib/cn";

type Props = {
  chatId: string;
  agentName: string;
};

export function ChatDocsPanel({ chatId, agentName }: Props) {
  const toast = useToast();
  const [tab, setTab] = useState<"docs" | "notes">("docs");
  const [artifacts, setArtifacts] = useState<ArtifactsList | null>(null);
  const [notes, setNotes] = useState<ChatNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!chatId) return;
    setLoading(true);
    Promise.all([
      listChatArtifacts(chatId).catch(() => ({ uploaded: [], generated: [] })),
      listChatNotes(chatId).catch(() => []),
    ]).then(([arts, nts]) => {
      setArtifacts(arts);
      setNotes(nts);
    }).finally(() => setLoading(false));
  }, [chatId]);

  async function handleAddNote() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const note = await addChatNote(chatId, newNote.trim());
      setNotes((p) => [note, ...p]);
      setNewNote("");
      toast.success("Note saved");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteNote(content: string) {
    try {
      await deleteChatNote(chatId, content);
      setNotes((p) => p.filter((n) => n.content !== content));
    } catch {}
  }

  const API_BASE = (import.meta.env.VITE_API_BASE ?? "").replace(/\/api$/, "");
  const allDocs = [...(artifacts?.uploaded || []), ...(artifacts?.generated || [])];
  const noteCount = notes.length;
  const docCount = allDocs.length;

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-900" data-testid="chat-docs-panel">
      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 px-3 pt-3 gap-1">
        <button onClick={() => setTab("docs")} data-testid="docs-tab-docs"
          className={cn("px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors",
            tab === "docs" ? "bg-brand/10 text-brand border-b-2 border-brand" : "text-slate-500 hover:text-slate-700")}>
          <Paperclip className="w-3 h-3 inline mr-1" />Docs ({docCount})
        </button>
        <button onClick={() => setTab("notes")} data-testid="docs-tab-notes"
          className={cn("px-3 py-1.5 text-xs font-semibold rounded-t-lg transition-colors",
            tab === "notes" ? "bg-brand/10 text-brand border-b-2 border-brand" : "text-slate-500 hover:text-slate-700")}>
          <StickyNote className="w-3 h-3 inline mr-1" />Notes ({noteCount})
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
        </div>
      ) : tab === "docs" ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {allDocs.length === 0 ? (
            <div className="text-center py-8">
              <FileUp className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No documents yet</p>
              <p className="text-[10px] text-slate-400 mt-1">Upload files in the chat composer</p>
            </div>
          ) : (
            allDocs.map((doc, i) => {
              const fname = doc.filename || doc.name || "file";
              const ext = fname.split(".").pop()?.toLowerCase() || "";
              const Icon = ext === "xlsx" || ext === "csv" ? FileSpreadsheet : FileText;
              const isGenerated = doc.source === "generated" || doc.url;
              const downloadUrl = doc.url ? `${API_BASE}/api${doc.url}` : null;
              return (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand/30 transition-colors"
                  data-testid={`artifact-${fname}`}>
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    isGenerated ? "bg-brand/10 text-brand" : "bg-emerald-500/10 text-emerald-600")}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate text-slate-800 dark:text-slate-200">{fname}</p>
                    <p className="text-[10px] text-slate-400">
                      {isGenerated ? "Generated" : `Uploaded · ${doc.chunk_count || "?"} chunks`}
                    </p>
                  </div>
                  {downloadUrl && (
                    <a href={downloadUrl} target="_blank" rel="noopener" download={fname}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-brand hover:bg-brand/10 transition-colors">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Add note form */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex gap-2">
              <input value={newNote} onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                placeholder="Add a note…" data-testid="note-input"
                className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-xs" />
              <button onClick={handleAddNote} disabled={saving || !newNote.trim()} data-testid="note-save-btn"
                className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center shrink-0 disabled:opacity-30">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          {/* Notes list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {notes.length === 0 ? (
              <div className="text-center py-8">
                <StickyNote className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No notes yet</p>
              </div>
            ) : (
              notes.map((note, i) => (
                <div key={i} className="group px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand/30 transition-colors"
                  data-testid={`note-${i}`}>
                  <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{note.content}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-400">{formatDateTime(note.created_at)}</span>
                    <button onClick={() => handleDeleteNote(note.content)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-danger transition-all">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
