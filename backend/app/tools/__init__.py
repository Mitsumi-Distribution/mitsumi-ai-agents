from app.tools.crm import crm_search, crm_update
from app.tools.departments import (
    campaign_list,
    finance_aging_report,
    invoice_search,
    low_stock_report,
    quote_search,
    sales_pipeline_summary,
    shipment_status,
    ticket_search,
)
from app.tools.analytics import customer_analytics, order_search, sales_forecast
from app.tools.email_calendar import calendar_event, send_email
from app.tools.erp import erp_query
from app.tools.file_gen import file_gen, excel_export
from app.tools.document_tool import document_search
from app.tools.orchestration import schedule_meeting, data_comparison, task_creator
from app.tools.google_tools import google_calendar_create, google_calendar_list, gmail_send, gmail_read
from app.tools.approval import request_approval
from app.tools.mitsumi_api import mitsumi_pricing
from app.tools.rag import rag_search
from app.tools.web_search import web_search

ALL_TOOLS = [
    crm_search,
    crm_update,
    customer_analytics,
    order_search,
    sales_forecast,
    erp_query,
    send_email,
    calendar_event,
    web_search,
    file_gen,
    excel_export,
    document_search,
    schedule_meeting,
    data_comparison,
    task_creator,
    google_calendar_create,
    google_calendar_list,
    gmail_send,
    gmail_read,
    request_approval,
    mitsumi_pricing,
    rag_search,
    sales_pipeline_summary,
    quote_search,
    invoice_search,
    finance_aging_report,
    campaign_list,
    ticket_search,
    shipment_status,
    low_stock_report,
]
