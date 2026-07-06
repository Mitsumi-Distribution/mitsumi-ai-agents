# Test Credentials — Mitsumi AI Agent Platform

## Super admin
- Email: francis@mitsumidistribution.com
- Password: <set via SUPERADMIN_PASSWORD in .env>
- Login: POST /api/auth/login/direct

## Preview URL
https://mitsumi-agent-test.preview.emergentagent.com

## LLM: AWS Bedrock (eu-west-3)
Default: Claude Haiku 4.5 | Sonnet 4.6 | Opus 4.7

## Google OAuth
- Client ID: <set via GOOGLE_OAUTH_CLIENT_ID in .env>
- Redirect URI: https://mitsumi-agent-test.preview.emergentagent.com/api/google/callback
- Scopes: Calendar, Calendar.Events, Gmail.Send, Gmail.Read, Gmail.Modify, UserInfo.Email
- Status: POST /api/google/status
- Connect: GET /api/google/auth-url → redirect → /api/google/callback

## Integrations
- AWS Bedrock, Resend, Tavily, Google OAuth configured

## Agent tools (30 total)
crm_search, crm_update, customer_analytics, order_search, sales_forecast, erp_query, send_email, calendar_event, web_search, file_gen, excel_export, document_search, schedule_meeting, data_comparison, task_creator, google_calendar_create, google_calendar_list, gmail_send, gmail_read, request_approval, mitsumi_pricing, rag_search, sales_pipeline_summary, quote_search, invoice_search, finance_aging_report, campaign_list, ticket_search, shipment_status, low_stock_report
