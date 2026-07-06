import { FormEvent, useState } from "react";
import { Pencil, Pin, PinOff, Trash2, X } from "lucide-react";

type Props = {
  pinned: boolean;
  title: string;
  onRename: (title: string) => Promise<void> | void;
  onTogglePin: () => Promise<void> | void;
  onDelete: () => Promise<void> | void;
};

export function ChatRowMenu({ pinned, title, onRename, onTogglePin, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nextTitle, setNextTitle] = useState(title);

  async function submitRename(event: FormEvent) {
    event.preventDefault();
    const value = nextTitle.trim();
    if (!value || value === title) {
      setEditing(false);
      return;
    }
    await onRename(value);
    setEditing(false);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="w-7 h-7 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="sr-only">Open chat actions</span>
        ⋯
      </button>
      {open && (
        <div className="absolute z-20 right-0 top-8 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-1.5 space-y-1">
          {editing ? (
            <form onSubmit={submitRename} className="space-y-1 p-1">
              <input
                value={nextTitle}
                onChange={(e) => setNextTitle(e.target.value)}
                className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              <div className="flex justify-end gap-1">
                <button type="button" onClick={() => setEditing(false)} className="p-1 text-slate-400">
                  <X className="w-3.5 h-3.5" />
                </button>
                <button type="submit" className="text-[11px] px-2 py-1 rounded-md bg-brand text-white">
                  Save
                </button>
              </div>
            </form>
          ) : (
            <>
              <button
                type="button"
                className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditing(true);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                Rename
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await onTogglePin();
                  setOpen(false);
                }}
              >
                {pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                {pinned ? "Unpin" : "Pin"}
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md hover:bg-danger/10 text-danger"
                onClick={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  await onDelete();
                  setOpen(false);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
