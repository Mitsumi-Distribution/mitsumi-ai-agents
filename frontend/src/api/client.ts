import { useSessionStore } from "../store/session";
import {
  AgentChatMessage,
  AgentChatRecord,
  AuditEntry,
  CurrentUser,
  DepartmentKey,
  DepartmentOverview,
  PlatformUser,
  RegionInfo,
  RoleDefinition,
  TaskRecord,
  ToolRun,
  UserPreferences
} from "../types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const token = useSessionStore.getState().token;
  const response = await fetch(`${API_BASE}${url}`, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let detail = `API request failed: ${response.status}`;
    try {
      const body = (await response.json()) as { detail?: string };
      if (body?.detail) detail = body.detail;
    } catch {
      /* ignore body parse issues */
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user?: CurrentUser;
  error?: string;
};

export async function directLogin(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login/direct", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function fetchMe(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/auth/me");
}

export async function requestLoginOtp(email: string, password: string): Promise<{ message: string; otp_expires_minutes: number }> {
  return apiFetch<{ message: string; otp_expires_minutes: number }>("/auth/login/request-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
}

export async function verifyLoginOtp(email: string, otp: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });
}

export async function requestResetOtp(email: string): Promise<{ message: string; otp_expires_minutes: number }> {
  return apiFetch<{ message: string; otp_expires_minutes: number }>("/auth/password/request-reset-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  });
}

export async function verifyResetOtp(
  email: string,
  otp: string
): Promise<{ reset_token: string; reset_token_expires_minutes: number }> {
  return apiFetch<{ reset_token: string; reset_token_expires_minutes: number }>("/auth/password/verify-reset-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp })
  });
}

export async function resetPassword(email: string, reset_token: string, new_password: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/password/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, reset_token, new_password })
  });
}

export async function listChats(agent: string, query?: string): Promise<AgentChatRecord[]> {
  const suffix = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
  return apiFetch<AgentChatRecord[]>(`/agent/${agent}/chats${suffix}`);
}

export async function createChat(agent: string): Promise<AgentChatRecord> {
  return apiFetch<AgentChatRecord>(`/agent/${agent}/chats`, { method: "POST" });
}

export type ChatDetail = AgentChatRecord & {
  messages: AgentChatMessage[];
};

export async function getChat(chatId: string): Promise<ChatDetail> {
  return apiFetch<ChatDetail>(`/chats/${chatId}`);
}

export async function renameChat(chatId: string, title: string): Promise<AgentChatRecord> {
  return apiFetch<AgentChatRecord>(`/chats/${chatId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title })
  });
}

export async function pinChat(chatId: string, pinned: boolean): Promise<AgentChatRecord> {
  return apiFetch<AgentChatRecord>(`/chats/${chatId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned })
  });
}

export async function deleteChat(chatId: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/chats/${chatId}`, { method: "DELETE" });
}

export async function fetchDepartmentOverview(
  name: DepartmentKey,
  params?: { region?: string | null; country?: string | null }
): Promise<DepartmentOverview> {
  const search = new URLSearchParams();
  if (params?.region) search.set("region", params.region);
  if (params?.country) search.set("country", params.country);
  const qs = search.toString();
  return apiFetch<DepartmentOverview>(`/department/${name}/overview${qs ? `?${qs}` : ""}`);
}

// ---------- Settings / Regions / Roles ----------
export async function fetchRegions(): Promise<{ regions: RegionInfo[] }> {
  return apiFetch<{ regions: RegionInfo[] }>("/settings/regions");
}

export async function fetchCountryCatalog(): Promise<{ countries: import("../types").CountryCatalogEntry[] }> {
  return apiFetch("/settings/country-catalog");
}

export async function createRegion(payload: { key: string; label: string; countries?: { code: string; name: string }[] }): Promise<RegionInfo> {
  return apiFetch("/settings/regions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateRegion(key: string, payload: { label?: string; countries?: { code: string; name: string }[] }): Promise<RegionInfo> {
  return apiFetch(`/settings/regions/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteRegion(key: string, cascade = false): Promise<{ ok: boolean; cascade: boolean; affected: Record<string, number>; users_nulled: number }> {
  const qs = cascade ? "?cascade=true" : "";
  return apiFetch(`/settings/regions/${key}${qs}`, { method: "DELETE" });
}

export async function addRegionCountry(key: string, payload: { code: string; name: string }): Promise<RegionInfo> {
  return apiFetch(`/settings/regions/${key}/countries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function removeRegionCountry(key: string, code: string): Promise<RegionInfo> {
  return apiFetch(`/settings/regions/${key}/countries/${code}`, { method: "DELETE" });
}

export async function fetchRoles(): Promise<{ roles: RoleDefinition[] }> {
  return apiFetch<{ roles: RoleDefinition[] }>("/settings/roles");
}

export async function fetchAgentTools(name: string): Promise<{
  agent: string;
  tools: import("../types").AgentToolInfo[];
  defaults: string[];
  quick_actions: import("../types").QuickAction[];
  model: import("../types").ModelSpec;
}> {
  return apiFetch(`/agent/${name}/tools`);
}

export async function fetchModelConfig(): Promise<import("../types").ModelConfig> {
  return apiFetch("/settings/models");
}

export async function setDepartmentModel(department: string, modelKey: string): Promise<import("../types").ModelConfig> {
  return apiFetch("/settings/models", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ department, model_key: modelKey }),
  });
}

// ---------- Users ----------
export async function listUsers(params?: { q?: string; role?: string; region?: string; country?: string }): Promise<PlatformUser[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  if (params?.role) search.set("role", params.role);
  if (params?.region) search.set("region", params.region);
  if (params?.country) search.set("country", params.country);
  const qs = search.toString();
  return apiFetch<PlatformUser[]>(`/users${qs ? `?${qs}` : ""}`);
}

export type MentionCandidate = {
  email: string;
  name: string;
  region?: string | null;
  country?: string | null;
};

export async function searchMentionCandidates(q: string): Promise<MentionCandidate[]> {
  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  return apiFetch<MentionCandidate[]>(`/users/mention-search${qs.toString() ? `?${qs.toString()}` : ""}`);
}


export type InviteInput = {
  email: string;
  name?: string;
  role: string;
  region?: string | null;
  country?: string | null;
  modules?: string[];
};

export async function inviteUser(payload: InviteInput): Promise<{
  user: PlatformUser;
  email: { delivered: boolean; reason?: string; invite_url: string; email_id?: string };
  temp_password?: string | null;
}> {
  return apiFetch("/users/invite", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateUser(id: string, payload: Partial<InviteInput> & { status?: string }): Promise<PlatformUser> {
  return apiFetch<PlatformUser>(`/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteUser(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/users/${id}`, { method: "DELETE" });
}

// ---------- Preferences ----------
export async function fetchPreferences(): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/users/me/preferences");
}

export async function updatePreferences(payload: Partial<UserPreferences>): Promise<UserPreferences> {
  return apiFetch<UserPreferences>("/users/me/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

// ---------- Tasks ----------
export async function listTasks(params?: { status?: string; department?: string }): Promise<TaskRecord[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.department) search.set("department", params.department);
  const qs = search.toString();
  return apiFetch<TaskRecord[]>(`/tasks${qs ? `?${qs}` : ""}`);
}

export async function createTask(payload: {
  title: string;
  notes?: string;
  priority?: string;
  status?: string;
  department?: string;
  agent_prompt?: string;
  tools?: string[];
  due_at?: string | null;
}): Promise<TaskRecord> {
  return apiFetch<TaskRecord>("/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function updateTask(id: string, payload: Partial<TaskRecord>): Promise<TaskRecord> {
  return apiFetch<TaskRecord>(`/tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function deleteTask(id: string): Promise<{ ok: boolean }> {
  return apiFetch<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" });
}

export async function runTaskWithAgent(id: string): Promise<{ task: TaskRecord; job: import("../types").AgentJob }> {
  return apiFetch(`/tasks/${id}/run`, { method: "POST" });
}

// ---------- Notifications ----------
export type NotificationRecord = {
  id: string;
  recipient_email: string;
  kind: "job" | "task" | "user" | "system";
  title: string;
  body: string;
  link?: string | null;
  metadata?: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

export async function listNotifications(params?: { skip?: number; limit?: number; unread_only?: boolean; kind?: string }): Promise<{
  items: NotificationRecord[];
  total: number;
  unread: number;
  skip: number;
  limit: number;
}> {
  const search = new URLSearchParams();
  if (params?.skip !== undefined) search.set("skip", String(params.skip));
  if (params?.limit !== undefined) search.set("limit", String(params.limit));
  if (params?.unread_only) search.set("unread_only", "true");
  if (params?.kind) search.set("kind", params.kind);
  const qs = search.toString();
  return apiFetch(`/notifications${qs ? `?${qs}` : ""}`);
}

export async function fetchUnreadCount(): Promise<{ unread: number }> {
  return apiFetch("/notifications/unread-count");
}

export async function markNotificationRead(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/notifications/${id}/read`, { method: "POST" });
}

export async function markAllNotificationsRead(): Promise<{ ok: boolean; updated: number }> {
  return apiFetch(`/notifications/read-all`, { method: "POST" });
}

export async function deleteNotification(id: string): Promise<{ ok: boolean }> {
  return apiFetch(`/notifications/${id}`, { method: "DELETE" });
}

// ---------- Tools ----------
export async function listRecentTools(limit = 40): Promise<ToolRun[]> {
  return apiFetch<ToolRun[]>(`/tools/recent?limit=${limit}`);
}

// ---------- Agent Tasks (long-running jobs) ----------
export async function listAgentJobKinds(): Promise<{ kinds: string[] }> {
  return apiFetch<{ kinds: string[] }>("/agent-tasks/kinds");
}

export async function listAgentJobs(params?: { status?: string; limit?: number }): Promise<import("../types").AgentJob[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.limit) search.set("limit", String(params.limit));
  const qs = search.toString();
  return apiFetch(`/agent-tasks${qs ? `?${qs}` : ""}`);
}

export async function enqueueAgentJob(payload: {
  kind: string;
  title: string;
  department?: string | null;
  params?: Record<string, unknown>;
}): Promise<import("../types").AgentJob> {
  return apiFetch("/agent-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

export async function cancelAgentJob(id: string): Promise<import("../types").AgentJob> {
  return apiFetch(`/agent-tasks/${id}/cancel`, { method: "POST" });
}

export async function retryAgentJob(id: string): Promise<import("../types").AgentJob> {
  return apiFetch(`/agent-tasks/${id}/retry`, { method: "POST" });
}

// ---------- Audit log ----------
export async function listAuditEntries(params?: { action?: string; actor?: string; limit?: number; skip?: number }): Promise<{ items: AuditEntry[]; total: number; skip: number; limit: number }> {
  const search = new URLSearchParams();
  if (params?.action) search.set("action", params.action);
  if (params?.actor) search.set("actor", params.actor);
  if (params?.limit) search.set("limit", String(params.limit));
  if (params?.skip) search.set("skip", String(params.skip));
  const qs = search.toString();
  return apiFetch(`/audit-log${qs ? `?${qs}` : ""}`);
}


// ---------- File Upload + Context ----------
export async function uploadFileToChat(chatId: string, file: File): Promise<{
  id: string; filename: string; file_size: number; text_length: number; chunk_count: number; preview: string;
}> {
  const token = useSessionStore.getState().token;
  const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000/api";
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}/chats/${chatId}/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as any).detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export type ContextInfo = {
  message_count: number;
  has_summary: boolean;
  summary_chars: number;
  document_count: number;
  document_chunks: number;
  estimated_tokens: number;
  documents: { filename: string; chunks: number }[];
};

export async function getChatContext(chatId: string): Promise<ContextInfo> {
  return apiFetch(`/chats/${chatId}/context`);
}


// ---------- Notes ----------
export type ChatNote = { chat_id: string; content: string; created_by: string; created_at: string };

export async function addChatNote(chatId: string, content: string): Promise<ChatNote> {
  return apiFetch(`/chats/${chatId}/notes`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

export async function listChatNotes(chatId: string): Promise<ChatNote[]> {
  return apiFetch(`/chats/${chatId}/notes`);
}

export async function deleteChatNote(chatId: string, content: string): Promise<{ ok: boolean }> {
  return apiFetch(`/chats/${chatId}/notes`, {
    method: "DELETE", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
}

// ---------- Artifacts ----------
export type ChatArtifact = { filename: string; format?: string; source?: string; url?: string; chunk_count?: number };
export type ArtifactsList = { uploaded: any[]; generated: ChatArtifact[] };

export async function listChatArtifacts(chatId: string): Promise<ArtifactsList> {
  return apiFetch(`/chats/${chatId}/artifacts`);
}
