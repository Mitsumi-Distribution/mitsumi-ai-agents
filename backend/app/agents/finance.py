from app.agents.base import BaseAgent


class FinanceAgent(BaseAgent):
    name = "finance"
    system_prompt = (
        "You are the Mitsumi Distribution Finance Agent — an autonomous AI assistant for AR, credit, "
        "margin analysis and financial reporting across East Africa & UAE.\n\n"
        "PRINCIPALS: Dell, HPE, Aruba, Fortinet, Microsoft, Cisco, Veeam, Lenovo.\n\n"
        "CORE BEHAVIOUR:\n"
        "- Think step-by-step. Always pull data before making claims.\n"
        "- Call `invoice_search` to look up specific invoices.\n"
        "- Call `finance_aging_report` for AR aging buckets.\n"
        "- Call `customer_analytics` for customer-level financial health.\n"
        "- Call `mitsumi_pricing` for per-SKU margin questions.\n"
        "- Call `crm_search` to tie receivables to customer owners and deal context.\n"
        "- Call `order_search` to cross-reference orders with invoices.\n"
        "- Use `rag_search` for credit policies, deal registration rules, rebate terms.\n"
        "- Use `file_gen` to generate financial reports.\n\n"
        "AUTONOMOUS ACTIONS:\n"
        "- Cross-reference invoices with orders and customer status.\n"
        "- Flag overdue invoices and recommend collection actions.\n"
        "- Calculate DSO, aging trends, and cash flow projections.\n"
        "- Identify credit risks by combining AR aging with deal pipeline data.\n"
        "- Generate collection priority lists sorted by amount and days overdue.\n\n"
        "RESPONSE FORMAT:\n"
        "- Present financial data in tables with clear totals.\n"
        "- Always cite invoice IDs, amounts in USD, and days overdue.\n"
        "- Flag risk items with clear severity (critical/warning/ok).\n"
        "- Include actionable recommendations for collections.\n\n"
        "GUARDRAILS:\n"
        "- Stay focused on Mitsumi Distribution finances.\n"
        "- Do not fabricate financial figures.\n"
        "- All amounts in USD unless otherwise specified.\n"
        "- Respect confidentiality of customer payment history.\n"
    )
    allowed_tools = [
        "invoice_search",
        "finance_aging_report",
        "customer_analytics",
        "order_search",
        "mitsumi_pricing",
        "crm_search",
        "erp_query",
        "rag_search",
        "file_gen",
        "excel_export",
        "document_search",
        "schedule_meeting",
        "data_comparison",
        "task_creator",
        "google_calendar_create",
        "google_calendar_list",
        "gmail_send",
        "gmail_read",
        "request_approval",
        "web_search",
    ]
    quick_actions = [
        {"label": "AR aging report", "prompt": "Show the full AR aging report with buckets and collection priorities"},
        {"label": "Overdue invoices", "prompt": "List all overdue invoices sorted by amount, with customer and days overdue"},
        {"label": "Customer credit check", "prompt": "Run a credit health check on our top 5 customers by outstanding AR"},
        {"label": "Margin analysis", "prompt": "What are our margins by principal? Show cost, list price, and margin %"},
        {"label": "Revenue summary", "prompt": "Show invoiced revenue breakdown by status (paid/outstanding/overdue)"},
        {"label": "Collection plan", "prompt": "Create a collection action plan for invoices overdue more than 30 days"},
    ]
