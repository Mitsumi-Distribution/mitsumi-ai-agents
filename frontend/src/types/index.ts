export type WsEvent =
  | { type: "token"; content: string }
  | { type: "tool_call"; tool: string; input: Record<string, unknown>; call_id?: string }
  | { type: "tool_result"; tool: string; output: unknown; call_id?: string; latency_ms?: number; rows?: number }
  | { type: "status"; state: "paused" | "running" | "stopped"; message?: string }
  | { type: "plan"; content: string; tool_calls?: Array<{ name: string; args?: Record<string, unknown> }> }
  | { type: "title"; chat_id: string; value: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  tool_events?: Array<{ type: "tool_call" | "tool_result"; tool: string; input?: unknown; output?: unknown }>;
  created_at?: string;
};

export type AgentChatRecord = {
  id: string;
  user_id: string;
  agent_name: string;
  title: string;
  pinned: boolean;
  last_message_preview: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  is_deleted?: boolean;
};

export type DepartmentKey = "sales" | "marketing" | "finance" | "ops";

export type DepartmentKpis = Record<string, number | string>;

export type DepartmentOverview = {
  department: DepartmentKey;
  generated_at: string;
  kpis: DepartmentKpis;
  stage_breakdown?: { stage: string; count: number; value: number }[];
  top_deals?: Record<string, unknown>[];
  recent_orders?: Record<string, unknown>[];
  status_breakdown?: { status: string; count: number; leads: number; pipeline: number }[];
  channel_breakdown?: { channel: string; count: number; leads: number; pipeline: number; spend: number }[];
  active_campaigns?: Record<string, unknown>[];
  upcoming_campaigns?: Record<string, unknown>[];
  aging?: { bucket: string; total: number; count: number }[];
  top_overdue?: Record<string, unknown>[];
  recent_invoices?: Record<string, unknown>[];
  tickets_by_status?: { status: string; count: number }[];
  tickets_by_priority?: { priority: string; count: number }[];
  open_tickets?: Record<string, unknown>[];
  shipments_in_transit?: Record<string, unknown>[];
  low_stock?: Record<string, unknown>[];
};

export type CurrentUser = {
  email: string;
  name: string;
  roles: string[];
  modules: string[];
  is_super_admin: boolean;
  region?: string | null;
  country?: string | null;
  status?: string;
  server_flags?: {
    llm_ready: boolean;
    resend_ready: boolean;
    tavily_ready: boolean;
    google_ready: boolean;
  };
};

export type RegionInfo = {
  key: string;
  label: string;
  countries: { code: string; name: string }[];
};

export type RoleDefinition = {
  key: string;
  label: string;
  scope: "global" | "region" | "country";
  can_invite: string[];
  permissions: string[];
};

export type PlatformUser = {
  id: string;
  email: string;
  name: string;
  roles: string[];
  region: string | null;
  country: string | null;
  modules: string[];
  is_super_admin: boolean;
  status: string;
  created_at?: string;
};

export type TaskRecord = {
  id: string;
  title: string;
  notes: string;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high" | "critical";
  department?: string | null;
  agent_prompt?: string;
  tools?: string[];
  agent_result?: string;
  agent_job_id?: string | null;
  due_at?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ToolRun = {
  chat: { chat_id: string; agent_name: string; title: string };
  tool_name: string;
  status: string;
  created_at: string;
  args: unknown;
  result_preview: string;
};

export type AgentJobStatus = "pending" | "running" | "succeeded" | "failed" | "cancelled";

export type AgentJob = {
  id: string;
  kind: string;
  department: string | null;
  title: string;
  status: AgentJobStatus;
  progress: number;
  logs: { at: string; message: string }[];
  result: unknown | null;
  error: string | null;
  params: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export type AuditEntry = {
  id: string;
  action: string;
  actor_email: string | null;
  actor_name: string | null;
  actor_roles: string[];
  target: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type UserPreferences = {
  theme: "light" | "dark" | "system";
  timezone: string;
  notifications: { email: boolean; in_app: boolean };
  default_region?: string | null;
  default_country?: string | null;
};

export type AgentToolInfo = {
  name: string;
  label?: string;
  description: string;
};

export type QuickAction = {
  label: string;
  prompt: string;
};

export type ModelSpec = {
  key: string;
  id: string;
  name: string;
  tier: string;
  description: string;
  input_cost_per_1m: number;
  output_cost_per_1m: number;
  max_tokens: number;
  supports_tools: boolean;
};

export type ModelConfig = {
  catalogue: Record<string, Omit<ModelSpec, 'key'>>;
  assignments: Record<string, string>;
  default: string;
};

export type CountryCatalogEntry = {
  code: string;
  name: string;
};
