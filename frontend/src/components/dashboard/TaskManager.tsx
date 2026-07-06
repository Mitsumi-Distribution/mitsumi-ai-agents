import { CircleDot, CircleCheck, CircleDashed, CircleAlert } from "lucide-react";
import { ReactNode } from "react";
import { useTask } from "../../hooks/useTask";
import { Badge, BadgeTone } from "../ui/Badge";

const statusTone: Record<string, BadgeTone> = {
  running: "brand",
  pending: "warning",
  done: "success",
  failed: "danger"
};

const statusIcon: Record<string, ReactNode> = {
  running: <CircleDot className="w-4 h-4" />,
  pending: <CircleDashed className="w-4 h-4" />,
  done: <CircleCheck className="w-4 h-4" />,
  failed: <CircleAlert className="w-4 h-4" />
};

export function TaskManager() {
  const { tasks } = useTask();
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white">
            Active Tasks
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {tasks.length} tasks in the queue
          </p>
        </div>
      </div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {tasks.map((task) => {
          const tone = statusTone[task.status] ?? "neutral";
          return (
            <li key={task.id} className="py-3 flex items-center gap-3 first:pt-0 last:pb-0">
              <span className="text-slate-400">{statusIcon[task.status] ?? <CircleDot className="w-4 h-4" />}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                  {task.title}
                </p>
                <p className="text-xs font-mono text-slate-400">#{task.id}</p>
              </div>
              <Badge tone={tone} className="capitalize shrink-0">
                {task.status}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
