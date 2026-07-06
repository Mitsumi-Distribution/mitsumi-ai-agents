import { Bot, LineChart, Megaphone, Wallet } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Badge, BadgeTone } from "../ui/Badge";
import { cn } from "../../lib/cn";

type AgentStatus = "online" | "pending" | "offline";

type AgentDef = {
  name: string;
  slug: string;
  description: string;
  status: AgentStatus;
  icon: ReactNode;
};

const agents: AgentDef[] = [
  {
    name: "Sales",
    slug: "sales",
    description: "Pipeline, quotes, CRM follow-ups.",
    status: "online",
    icon: <LineChart className="w-5 h-5" />
  },
  {
    name: "Marketing",
    slug: "marketing",
    description: "Campaigns, copy, audience insights.",
    status: "online",
    icon: <Megaphone className="w-5 h-5" />
  },
  {
    name: "Finance",
    slug: "finance",
    description: "Invoicing, pricing, reconciliation.",
    status: "online",
    icon: <Wallet className="w-5 h-5" />
  },
  {
    name: "Operations",
    slug: "ops",
    description: "Fulfilment, logistics, inventory.",
    status: "online",
    icon: <Bot className="w-5 h-5" />
  }
];

const statusMap: Record<AgentStatus, { tone: BadgeTone; label: string; pulse: boolean }> = {
  online: { tone: "success", label: "Online", pulse: true },
  pending: { tone: "warning", label: "Pending", pulse: false },
  offline: { tone: "neutral", label: "Offline", pulse: false }
};

export function AgentStatusBar() {
  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-base font-display font-semibold text-slate-900 dark:text-white">
            Departments
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Jump into a dedicated department view or open its agent.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 stagger">
        {agents.map((agent) => {
          const status = statusMap[agent.status];
          return (
            <Link
              key={agent.slug}
              to={`/department/${agent.slug}`}
              data-testid={`dashboard-agent-${agent.slug}-card`}
              className={cn(
                "group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-5 shadow-sm hover:shadow-lg hover:border-brand/40 hover:-translate-y-0.5 transition-all duration-200 ease-out animate-fade-up focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-100 dark:focus-visible:ring-offset-slate-950"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 rounded-xl bg-brand-subtle dark:bg-brand-glow text-brand flex items-center justify-center">
                  {agent.icon}
                </div>
                <Badge tone={status.tone} dot pulse={status.pulse}>
                  {status.label}
                </Badge>
              </div>
              <h3 className="mt-4 text-base font-display font-semibold text-slate-900 dark:text-white">
                {agent.name}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {agent.description}
              </p>
              <p className="mt-4 text-xs font-medium text-brand flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                View department →
              </p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
