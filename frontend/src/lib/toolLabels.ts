// Friendly label per tool key. Mirrors TOOL_META in backend/app/routers/agents.py
export const TOOL_LABELS: Record<string, string> = {
  crm_search: "Find customers & leads",
  crm_update: "Update a CRM record",
  sales_pipeline_summary: "Sales pipeline summary",
  quote_search: "Find quotes",
  mitsumi_pricing: "Product pricing",
  invoice_search: "Find invoices",
  finance_aging_report: "AR aging report",
  campaign_list: "Marketing campaigns",
  ticket_search: "Find support tickets",
  shipment_status: "Shipment tracking",
  low_stock_report: "Low stock alerts",
  erp_query: "Query ERP data",
  rag_search: "Search company docs",
  file_gen: "Generate a document",
  send_email: "Send email",
  calendar_event: "Create calendar event",
  web_search: "Web search",
};

export function friendlyToolLabel(key: string): string {
  return TOOL_LABELS[key] ?? key.replace(/_/g, " ");
}
