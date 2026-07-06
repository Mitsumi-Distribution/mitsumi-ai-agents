"""Mitsumi Distribution demo data seeder.

Idempotent: each collection only gets seeded when empty so repeated backend
restarts don't duplicate rows or overwrite manual edits.

Seeds the full catalogue used by department pages and agent tools:

- customers             master customer list (East Africa accounts)
- principals            vendor / principal relationships (DELL, HP, ...)
- crm_leads             pipeline leads (existing collection, expanded)
- sales_quotes          quotes awaiting acceptance
- sales_orders          closed/won orders
- erp_inventory         SKU / warehouse stock (existing, expanded)
- pricing_book          per-SKU price used by the mitsumi_pricing tool
- finance_invoices      AR invoices (paid / outstanding / overdue)
- marketing_campaigns   active + completed campaigns
- ops_tickets           support / logistics tickets
- ops_shipments         in-transit + delivered shipments
- knowledge_base        RAG corpus
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _days_ago(days: int) -> datetime:
    return _now() - timedelta(days=days)


def _days_ahead(days: int) -> datetime:
    return _now() + timedelta(days=days)


CUSTOMERS = [
    {"customer_id": "C-001", "name": "Acme Telecom Kenya", "country": "KE", "segment": "TELCO", "owner": "francis@mitsumidistribution.com", "credit_limit": 250_000, "credit_used": 98_000},
    {"customer_id": "C-002", "name": "Nairobi DataHub", "country": "KE", "segment": "DC", "owner": "francis@mitsumidistribution.com", "credit_limit": 500_000, "credit_used": 312_000},
    {"customer_id": "C-003", "name": "EastNet Logistics", "country": "KE", "segment": "SMB", "owner": "lydia@mitsumidistribution.com", "credit_limit": 120_000, "credit_used": 40_000},
    {"customer_id": "C-004", "name": "Mombasa Fiber", "country": "KE", "segment": "ISP", "owner": "lydia@mitsumidistribution.com", "credit_limit": 180_000, "credit_used": 60_000},
    {"customer_id": "C-005", "name": "Skyline ISP", "country": "KE", "segment": "ISP", "owner": "david@mitsumidistribution.com", "credit_limit": 400_000, "credit_used": 210_000},
    {"customer_id": "C-006", "name": "Kampala Cloud Works", "country": "UG", "segment": "DC", "owner": "david@mitsumidistribution.com", "credit_limit": 300_000, "credit_used": 175_000},
    {"customer_id": "C-007", "name": "Dar Health Network", "country": "TZ", "segment": "HEALTH", "owner": "grace@mitsumidistribution.com", "credit_limit": 220_000, "credit_used": 88_000},
    {"customer_id": "C-008", "name": "Kigali Government SOC", "country": "RW", "segment": "GOV", "owner": "grace@mitsumidistribution.com", "credit_limit": 600_000, "credit_used": 420_000},
    {"customer_id": "C-009", "name": "Addis Retail Group", "country": "ET", "segment": "RETAIL", "owner": "lydia@mitsumidistribution.com", "credit_limit": 140_000, "credit_used": 62_000},
    {"customer_id": "C-010", "name": "Juba Energy Authority", "country": "SS", "segment": "GOV", "owner": "francis@mitsumidistribution.com", "credit_limit": 350_000, "credit_used": 120_000},
    {"customer_id": "C-011", "name": "Zanzibar University", "country": "TZ", "segment": "EDU", "owner": "grace@mitsumidistribution.com", "credit_limit": 90_000, "credit_used": 30_000},
    {"customer_id": "C-012", "name": "Bujumbura Bank Holdings", "country": "BI", "segment": "BFSI", "owner": "david@mitsumidistribution.com", "credit_limit": 500_000, "credit_used": 370_000},
    {"customer_id": "C-013", "name": "Serengeti Safari Tech", "country": "TZ", "segment": "TRAVEL", "owner": "lydia@mitsumidistribution.com", "credit_limit": 80_000, "credit_used": 22_000},
    {"customer_id": "C-014", "name": "Kisumu Sugar Co-op", "country": "KE", "segment": "MFG", "owner": "francis@mitsumidistribution.com", "credit_limit": 110_000, "credit_used": 45_000},
    {"customer_id": "C-015", "name": "Arusha MedLabs", "country": "TZ", "segment": "HEALTH", "owner": "grace@mitsumidistribution.com", "credit_limit": 160_000, "credit_used": 80_000},
    {"customer_id": "C-016", "name": "Entebbe Airport IT", "country": "UG", "segment": "GOV", "owner": "david@mitsumidistribution.com", "credit_limit": 400_000, "credit_used": 150_000},
    {"customer_id": "C-017", "name": "Lamu Port Authority", "country": "KE", "segment": "GOV", "owner": "francis@mitsumidistribution.com", "credit_limit": 250_000, "credit_used": 95_000},
    {"customer_id": "C-018", "name": "Naivasha Horticulture", "country": "KE", "segment": "AGRI", "owner": "lydia@mitsumidistribution.com", "credit_limit": 70_000, "credit_used": 18_000},
    # UAE accounts
    {"customer_id": "C-019", "name": "Dubai Silicon Holdings", "country": "AE", "segment": "TECH", "owner": "amir@mitsumidistribution.com", "credit_limit": 600_000, "credit_used": 220_000},
    {"customer_id": "C-020", "name": "Abu Dhabi Smart Gov", "country": "AE", "segment": "GOV", "owner": "amir@mitsumidistribution.com", "credit_limit": 800_000, "credit_used": 340_000},
    {"customer_id": "C-021", "name": "Sharjah Energy Partners", "country": "AE", "segment": "ENERGY", "owner": "amir@mitsumidistribution.com", "credit_limit": 500_000, "credit_used": 180_000},
]


PRINCIPALS = [
    {"principal_id": "P-DELL", "name": "Dell Technologies", "tier": "Platinum", "categories": ["server", "storage", "networking"], "rebate_pct": 6.0, "active": True},
    {"principal_id": "P-HPE", "name": "Hewlett Packard Enterprise", "tier": "Gold", "categories": ["server", "storage"], "rebate_pct": 5.0, "active": True},
    {"principal_id": "P-HP", "name": "HP Inc.", "tier": "Gold", "categories": ["print", "pc"], "rebate_pct": 4.5, "active": True},
    {"principal_id": "P-MS", "name": "Microsoft", "tier": "LSP", "categories": ["license", "cloud"], "rebate_pct": 3.0, "active": True},
    {"principal_id": "P-ARUBA", "name": "Aruba (HPE Networking)", "tier": "Gold", "categories": ["networking", "wifi"], "rebate_pct": 5.5, "active": True},
    {"principal_id": "P-LENOVO", "name": "Lenovo", "tier": "Silver", "categories": ["server", "pc"], "rebate_pct": 4.0, "active": True},
    {"principal_id": "P-CISCO", "name": "Cisco", "tier": "Silver", "categories": ["networking", "security"], "rebate_pct": 3.5, "active": True},
    {"principal_id": "P-FORTINET", "name": "Fortinet", "tier": "Gold", "categories": ["security"], "rebate_pct": 5.0, "active": True},
    {"principal_id": "P-APC", "name": "APC by Schneider", "tier": "Silver", "categories": ["power"], "rebate_pct": 3.5, "active": True},
    {"principal_id": "P-VEEAM", "name": "Veeam", "tier": "Gold", "categories": ["backup"], "rebate_pct": 6.0, "active": True},
]


CRM_LEADS = [
    {"lead_id": 1, "customer_id": "C-001", "customer_name": "Acme Telecom Kenya", "principal": "DELL", "stage": "open", "amount": 45000, "owner": "francis@mitsumidistribution.com", "probability": 0.2, "notes": "Server refresh Q3", "created_at": _days_ago(2)},
    {"lead_id": 2, "customer_id": "C-002", "customer_name": "Nairobi DataHub", "principal": "DELL", "stage": "proposal", "amount": 76000, "owner": "francis@mitsumidistribution.com", "probability": 0.5, "notes": "Needs storage cluster", "created_at": _days_ago(7)},
    {"lead_id": 3, "customer_id": "C-003", "customer_name": "EastNet Logistics", "principal": "HP", "stage": "open", "amount": 22000, "owner": "lydia@mitsumidistribution.com", "probability": 0.2, "notes": "Branch office rollout", "created_at": _days_ago(1)},
    {"lead_id": 4, "customer_id": "C-004", "customer_name": "Mombasa Fiber", "principal": "Microsoft", "stage": "qualified", "amount": 15000, "owner": "lydia@mitsumidistribution.com", "probability": 0.35, "notes": "E5 upsell", "created_at": _days_ago(4)},
    {"lead_id": 5, "customer_id": "C-005", "customer_name": "Skyline ISP", "principal": "DELL", "stage": "open", "amount": 98000, "owner": "david@mitsumidistribution.com", "probability": 0.25, "notes": "Core datacenter expansion", "created_at": _days_ago(9)},
    {"lead_id": 6, "customer_id": "C-006", "customer_name": "Kampala Cloud Works", "principal": "HPE", "stage": "negotiation", "amount": 132000, "owner": "david@mitsumidistribution.com", "probability": 0.7, "notes": "Primary/DR pair", "created_at": _days_ago(12)},
    {"lead_id": 7, "customer_id": "C-007", "customer_name": "Dar Health Network", "principal": "Lenovo", "stage": "proposal", "amount": 58000, "owner": "grace@mitsumidistribution.com", "probability": 0.5, "notes": "Clinic workstations + server", "created_at": _days_ago(5)},
    {"lead_id": 8, "customer_id": "C-008", "customer_name": "Kigali Government SOC", "principal": "Fortinet", "stage": "negotiation", "amount": 245000, "owner": "grace@mitsumidistribution.com", "probability": 0.65, "notes": "SOC hardware + licences", "created_at": _days_ago(18)},
    {"lead_id": 9, "customer_id": "C-009", "customer_name": "Addis Retail Group", "principal": "HP", "stage": "open", "amount": 34000, "owner": "lydia@mitsumidistribution.com", "probability": 0.2, "notes": "POS refresh", "created_at": _days_ago(3)},
    {"lead_id": 10, "customer_id": "C-010", "customer_name": "Juba Energy Authority", "principal": "Cisco", "stage": "qualified", "amount": 187000, "owner": "francis@mitsumidistribution.com", "probability": 0.4, "notes": "Pipeline SCADA networking", "created_at": _days_ago(10)},
    {"lead_id": 11, "customer_id": "C-011", "customer_name": "Zanzibar University", "principal": "Microsoft", "stage": "won", "amount": 42000, "owner": "grace@mitsumidistribution.com", "probability": 1.0, "notes": "Staff + student licensing", "created_at": _days_ago(25), "closed_at": _days_ago(2)},
    {"lead_id": 12, "customer_id": "C-012", "customer_name": "Bujumbura Bank Holdings", "principal": "Veeam", "stage": "proposal", "amount": 95000, "owner": "david@mitsumidistribution.com", "probability": 0.55, "notes": "Backup + immutable repo", "created_at": _days_ago(14)},
    {"lead_id": 13, "customer_id": "C-013", "customer_name": "Serengeti Safari Tech", "principal": "Aruba", "stage": "open", "amount": 27000, "owner": "lydia@mitsumidistribution.com", "probability": 0.2, "notes": "Lodge wifi upgrade", "created_at": _days_ago(6)},
    {"lead_id": 14, "customer_id": "C-014", "customer_name": "Kisumu Sugar Co-op", "principal": "APC", "stage": "won", "amount": 31000, "owner": "francis@mitsumidistribution.com", "probability": 1.0, "notes": "UPS + PDU refresh", "created_at": _days_ago(30), "closed_at": _days_ago(5)},
    {"lead_id": 15, "customer_id": "C-015", "customer_name": "Arusha MedLabs", "principal": "HP", "stage": "lost", "amount": 19000, "owner": "grace@mitsumidistribution.com", "probability": 0.0, "notes": "Lost to local reseller on price", "created_at": _days_ago(40), "closed_at": _days_ago(10)},
    {"lead_id": 16, "customer_id": "C-016", "customer_name": "Entebbe Airport IT", "principal": "Cisco", "stage": "proposal", "amount": 156000, "owner": "david@mitsumidistribution.com", "probability": 0.5, "notes": "Perimeter + access switches", "created_at": _days_ago(8)},
    {"lead_id": 17, "customer_id": "C-017", "customer_name": "Lamu Port Authority", "principal": "DELL", "stage": "qualified", "amount": 72000, "owner": "francis@mitsumidistribution.com", "probability": 0.4, "notes": "Customs server upgrade", "created_at": _days_ago(11)},
    {"lead_id": 18, "customer_id": "C-001", "customer_name": "Acme Telecom Kenya", "principal": "Aruba", "stage": "negotiation", "amount": 48000, "owner": "francis@mitsumidistribution.com", "probability": 0.65, "notes": "Head office wifi 6 rollout", "created_at": _days_ago(15)},
    {"lead_id": 19, "customer_id": "C-002", "customer_name": "Nairobi DataHub", "principal": "Veeam", "stage": "won", "amount": 62000, "owner": "francis@mitsumidistribution.com", "probability": 1.0, "notes": "Backup licences renewal", "created_at": _days_ago(35), "closed_at": _days_ago(1)},
    {"lead_id": 20, "customer_id": "C-005", "customer_name": "Skyline ISP", "principal": "Fortinet", "stage": "open", "amount": 51000, "owner": "david@mitsumidistribution.com", "probability": 0.2, "notes": "DDoS mitigation", "created_at": _days_ago(2)},
    {"lead_id": 21, "customer_id": "C-018", "customer_name": "Naivasha Horticulture", "principal": "Microsoft", "stage": "qualified", "amount": 14000, "owner": "lydia@mitsumidistribution.com", "probability": 0.35, "notes": "M365 Business Premium", "created_at": _days_ago(3)},
    {"lead_id": 22, "customer_id": "C-008", "customer_name": "Kigali Government SOC", "principal": "Veeam", "stage": "open", "amount": 38000, "owner": "grace@mitsumidistribution.com", "probability": 0.2, "notes": "Gov backup add-on", "created_at": _days_ago(1)},
    {"lead_id": 23, "customer_id": "C-012", "customer_name": "Bujumbura Bank Holdings", "principal": "Fortinet", "stage": "negotiation", "amount": 118000, "owner": "david@mitsumidistribution.com", "probability": 0.7, "notes": "Branch firewall refresh", "created_at": _days_ago(20)},
    {"lead_id": 24, "customer_id": "C-006", "customer_name": "Kampala Cloud Works", "principal": "DELL", "stage": "qualified", "amount": 89000, "owner": "david@mitsumidistribution.com", "probability": 0.45, "notes": "Object storage add-on", "created_at": _days_ago(6)},
    {"lead_id": 25, "customer_id": "C-010", "customer_name": "Juba Energy Authority", "principal": "APC", "stage": "proposal", "amount": 46000, "owner": "francis@mitsumidistribution.com", "probability": 0.5, "notes": "Field site power", "created_at": _days_ago(9)},
    # UAE leads
    {"lead_id": 26, "customer_id": "C-019", "customer_name": "Dubai Silicon Holdings", "principal": "DELL", "stage": "negotiation", "amount": 285000, "owner": "amir@mitsumidistribution.com", "probability": 0.7, "notes": "Multi-site server refresh", "created_at": _days_ago(10)},
    {"lead_id": 27, "customer_id": "C-020", "customer_name": "Abu Dhabi Smart Gov", "principal": "Fortinet", "stage": "proposal", "amount": 420000, "owner": "amir@mitsumidistribution.com", "probability": 0.55, "notes": "Next-gen firewall fleet", "created_at": _days_ago(14)},
    {"lead_id": 28, "customer_id": "C-021", "customer_name": "Sharjah Energy Partners", "principal": "HPE", "stage": "qualified", "amount": 190000, "owner": "amir@mitsumidistribution.com", "probability": 0.4, "notes": "SCADA servers", "created_at": _days_ago(6)},
]


SALES_QUOTES = [
    {"quote_id": "Q-2026-0101", "customer_id": "C-002", "customer_name": "Nairobi DataHub", "principal": "DELL", "amount": 76000, "status": "sent", "valid_until": _days_ahead(14), "created_at": _days_ago(5), "owner": "francis@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0102", "customer_id": "C-006", "customer_name": "Kampala Cloud Works", "principal": "HPE", "amount": 132000, "status": "accepted", "valid_until": _days_ahead(20), "created_at": _days_ago(10), "owner": "david@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0103", "customer_id": "C-008", "customer_name": "Kigali Government SOC", "principal": "Fortinet", "amount": 245000, "status": "sent", "valid_until": _days_ahead(21), "created_at": _days_ago(12), "owner": "grace@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0104", "customer_id": "C-007", "customer_name": "Dar Health Network", "principal": "Lenovo", "amount": 58000, "status": "sent", "valid_until": _days_ahead(10), "created_at": _days_ago(4), "owner": "grace@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0105", "customer_id": "C-012", "customer_name": "Bujumbura Bank Holdings", "principal": "Veeam", "amount": 95000, "status": "sent", "valid_until": _days_ahead(18), "created_at": _days_ago(12), "owner": "david@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0106", "customer_id": "C-016", "customer_name": "Entebbe Airport IT", "principal": "Cisco", "amount": 156000, "status": "sent", "valid_until": _days_ahead(9), "created_at": _days_ago(6), "owner": "david@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0107", "customer_id": "C-018", "customer_name": "Naivasha Horticulture", "principal": "Microsoft", "amount": 14000, "status": "draft", "valid_until": _days_ahead(25), "created_at": _days_ago(1), "owner": "lydia@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0108", "customer_id": "C-001", "customer_name": "Acme Telecom Kenya", "principal": "Aruba", "amount": 48000, "status": "sent", "valid_until": _days_ahead(7), "created_at": _days_ago(13), "owner": "francis@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0109", "customer_id": "C-009", "customer_name": "Addis Retail Group", "principal": "HP", "amount": 34000, "status": "draft", "valid_until": _days_ahead(30), "created_at": _days_ago(2), "owner": "lydia@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0110", "customer_id": "C-017", "customer_name": "Lamu Port Authority", "principal": "DELL", "amount": 72000, "status": "sent", "valid_until": _days_ahead(15), "created_at": _days_ago(9), "owner": "francis@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0111", "customer_id": "C-010", "customer_name": "Juba Energy Authority", "principal": "APC", "amount": 46000, "status": "sent", "valid_until": _days_ahead(20), "created_at": _days_ago(7), "owner": "francis@mitsumidistribution.com"},
    {"quote_id": "Q-2026-0112", "customer_id": "C-005", "customer_name": "Skyline ISP", "principal": "Fortinet", "amount": 51000, "status": "draft", "valid_until": _days_ahead(28), "created_at": _days_ago(1), "owner": "david@mitsumidistribution.com"},
]


SALES_ORDERS = [
    {"order_id": "SO-2026-2201", "customer_id": "C-011", "customer_name": "Zanzibar University", "principal": "Microsoft", "amount": 42000, "status": "fulfilled", "closed_at": _days_ago(2), "owner": "grace@mitsumidistribution.com"},
    {"order_id": "SO-2026-2202", "customer_id": "C-014", "customer_name": "Kisumu Sugar Co-op", "principal": "APC", "amount": 31000, "status": "fulfilled", "closed_at": _days_ago(5), "owner": "francis@mitsumidistribution.com"},
    {"order_id": "SO-2026-2203", "customer_id": "C-002", "customer_name": "Nairobi DataHub", "principal": "Veeam", "amount": 62000, "status": "fulfilled", "closed_at": _days_ago(1), "owner": "francis@mitsumidistribution.com"},
    {"order_id": "SO-2026-2204", "customer_id": "C-001", "customer_name": "Acme Telecom Kenya", "principal": "DELL", "amount": 88000, "status": "fulfilled", "closed_at": _days_ago(22), "owner": "francis@mitsumidistribution.com"},
    {"order_id": "SO-2026-2205", "customer_id": "C-004", "customer_name": "Mombasa Fiber", "principal": "Aruba", "amount": 29000, "status": "fulfilled", "closed_at": _days_ago(18), "owner": "lydia@mitsumidistribution.com"},
    {"order_id": "SO-2026-2206", "customer_id": "C-005", "customer_name": "Skyline ISP", "principal": "DELL", "amount": 102000, "status": "fulfilled", "closed_at": _days_ago(45), "owner": "david@mitsumidistribution.com"},
    {"order_id": "SO-2026-2207", "customer_id": "C-003", "customer_name": "EastNet Logistics", "principal": "HP", "amount": 19000, "status": "fulfilled", "closed_at": _days_ago(12), "owner": "lydia@mitsumidistribution.com"},
    {"order_id": "SO-2026-2208", "customer_id": "C-007", "customer_name": "Dar Health Network", "principal": "Lenovo", "amount": 45000, "status": "fulfilled", "closed_at": _days_ago(30), "owner": "grace@mitsumidistribution.com"},
    {"order_id": "SO-2026-2209", "customer_id": "C-008", "customer_name": "Kigali Government SOC", "principal": "Cisco", "amount": 210000, "status": "fulfilled", "closed_at": _days_ago(55), "owner": "grace@mitsumidistribution.com"},
    {"order_id": "SO-2026-2210", "customer_id": "C-012", "customer_name": "Bujumbura Bank Holdings", "principal": "Fortinet", "amount": 87000, "status": "fulfilled", "closed_at": _days_ago(50), "owner": "david@mitsumidistribution.com"},
    {"order_id": "SO-2026-2211", "customer_id": "C-006", "customer_name": "Kampala Cloud Works", "principal": "DELL", "amount": 140000, "status": "fulfilled", "closed_at": _days_ago(9), "owner": "david@mitsumidistribution.com"},
    {"order_id": "SO-2026-2212", "customer_id": "C-013", "customer_name": "Serengeti Safari Tech", "principal": "Aruba", "amount": 18000, "status": "fulfilled", "closed_at": _days_ago(15), "owner": "lydia@mitsumidistribution.com"},
    {"order_id": "SO-2026-2213", "customer_id": "C-015", "customer_name": "Arusha MedLabs", "principal": "HP", "amount": 23000, "status": "fulfilled", "closed_at": _days_ago(38), "owner": "grace@mitsumidistribution.com"},
    {"order_id": "SO-2026-2214", "customer_id": "C-017", "customer_name": "Lamu Port Authority", "principal": "Aruba", "amount": 34000, "status": "fulfilled", "closed_at": _days_ago(28), "owner": "francis@mitsumidistribution.com"},
    {"order_id": "SO-2026-2215", "customer_id": "C-010", "customer_name": "Juba Energy Authority", "principal": "APC", "amount": 51000, "status": "fulfilled", "closed_at": _days_ago(70), "owner": "francis@mitsumidistribution.com"},
    # UAE orders
    {"order_id": "SO-2026-2216", "customer_id": "C-019", "customer_name": "Dubai Silicon Holdings", "principal": "DELL", "amount": 210000, "status": "fulfilled", "closed_at": _days_ago(14), "owner": "amir@mitsumidistribution.com"},
    {"order_id": "SO-2026-2217", "customer_id": "C-020", "customer_name": "Abu Dhabi Smart Gov", "principal": "Microsoft", "amount": 96000, "status": "fulfilled", "closed_at": _days_ago(8), "owner": "amir@mitsumidistribution.com"},
]


ERP_INVENTORY = [
    {"sku": "DELL-R750", "product_name": "Dell PowerEdge R750", "principal": "DELL", "quantity": 22, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 10},
    {"sku": "DELL-R650", "product_name": "Dell PowerEdge R650", "principal": "DELL", "quantity": 14, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 8},
    {"sku": "DELL-PS5500", "product_name": "Dell PowerStore 5500", "principal": "DELL", "quantity": 3, "warehouse": "Nairobi-WH-A", "eta_days": 14, "reorder_point": 4},
    {"sku": "HPE-DL380", "product_name": "HPE ProLiant DL380 Gen11", "principal": "HPE", "quantity": 10, "warehouse": "Nairobi-WH-A", "eta_days": 2, "reorder_point": 6},
    {"sku": "HPE-MSA2060", "product_name": "HPE MSA 2060 SAN", "principal": "HPE", "quantity": 5, "warehouse": "Kampala-WH-B", "eta_days": 7, "reorder_point": 4},
    {"sku": "ARUBA-6300", "product_name": "Aruba Switch 6300", "principal": "Aruba", "quantity": 38, "warehouse": "Kampala-WH-B", "eta_days": 5, "reorder_point": 15},
    {"sku": "ARUBA-AP635", "product_name": "Aruba AP-635 Wifi 6E", "principal": "Aruba", "quantity": 120, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 40},
    {"sku": "MS-E5", "product_name": "Microsoft 365 E5 License", "principal": "Microsoft", "quantity": 500, "warehouse": "License-Pool", "eta_days": 0, "reorder_point": 100},
    {"sku": "MS-E3", "product_name": "Microsoft 365 E3 License", "principal": "Microsoft", "quantity": 900, "warehouse": "License-Pool", "eta_days": 0, "reorder_point": 200},
    {"sku": "MS-AZURE-RI", "product_name": "Azure Reserved Instance Credit", "principal": "Microsoft", "quantity": 200, "warehouse": "License-Pool", "eta_days": 0, "reorder_point": 50},
    {"sku": "LEN-SR650", "product_name": "Lenovo ThinkSystem SR650", "principal": "Lenovo", "quantity": 12, "warehouse": "Nairobi-WH-A", "eta_days": 7, "reorder_point": 6},
    {"sku": "LEN-THINKPAD-X1", "product_name": "Lenovo ThinkPad X1 Carbon", "principal": "Lenovo", "quantity": 45, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 20},
    {"sku": "CISCO-C9300", "product_name": "Cisco Catalyst 9300", "principal": "Cisco", "quantity": 7, "warehouse": "Nairobi-WH-A", "eta_days": 10, "reorder_point": 5},
    {"sku": "CISCO-ISR4321", "product_name": "Cisco ISR 4321", "principal": "Cisco", "quantity": 9, "warehouse": "Kampala-WH-B", "eta_days": 3, "reorder_point": 4},
    {"sku": "FORT-600F", "product_name": "FortiGate 600F", "principal": "Fortinet", "quantity": 6, "warehouse": "Nairobi-WH-A", "eta_days": 5, "reorder_point": 4},
    {"sku": "FORT-100F", "product_name": "FortiGate 100F", "principal": "Fortinet", "quantity": 18, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 8},
    {"sku": "APC-SMX3000", "product_name": "APC Smart-UPS X 3000VA", "principal": "APC", "quantity": 15, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 6},
    {"sku": "APC-PDU-AP7841", "product_name": "APC Metered PDU AP7841", "principal": "APC", "quantity": 22, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 8},
    {"sku": "HP-LJM404", "product_name": "HP LaserJet Pro M404", "principal": "HP", "quantity": 30, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 10},
    {"sku": "HP-ELITEDESK-800", "product_name": "HP EliteDesk 800 G9", "principal": "HP", "quantity": 28, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 12},
    {"sku": "VEEAM-BU-ENT", "product_name": "Veeam Backup Enterprise Plus", "principal": "Veeam", "quantity": 60, "warehouse": "License-Pool", "eta_days": 0, "reorder_point": 20},
    {"sku": "VEEAM-O365", "product_name": "Veeam Backup for M365", "principal": "Veeam", "quantity": 400, "warehouse": "License-Pool", "eta_days": 0, "reorder_point": 100},
    {"sku": "DELL-OPTI-7010", "product_name": "Dell OptiPlex 7010", "principal": "DELL", "quantity": 35, "warehouse": "Nairobi-WH-A", "eta_days": 0, "reorder_point": 12},
    {"sku": "ARUBA-2930F", "product_name": "Aruba 2930F Switch", "principal": "Aruba", "quantity": 4, "warehouse": "Kampala-WH-B", "eta_days": 12, "reorder_point": 6},
    {"sku": "HPE-SY480", "product_name": "HPE Synergy 480 Gen11", "principal": "HPE", "quantity": 2, "warehouse": "Nairobi-WH-A", "eta_days": 20, "reorder_point": 3},
]


PRICING_BOOK = [
    {"sku": "DELL-R750", "list_price": 9200, "cost": 6900, "currency": "USD", "principal": "DELL"},
    {"sku": "DELL-R650", "list_price": 7600, "cost": 5700, "currency": "USD", "principal": "DELL"},
    {"sku": "DELL-PS5500", "list_price": 38000, "cost": 29000, "currency": "USD", "principal": "DELL"},
    {"sku": "DELL-OPTI-7010", "list_price": 820, "cost": 620, "currency": "USD", "principal": "DELL"},
    {"sku": "HPE-DL380", "list_price": 9700, "cost": 7400, "currency": "USD", "principal": "HPE"},
    {"sku": "HPE-MSA2060", "list_price": 18500, "cost": 13900, "currency": "USD", "principal": "HPE"},
    {"sku": "HPE-SY480", "list_price": 22000, "cost": 17000, "currency": "USD", "principal": "HPE"},
    {"sku": "ARUBA-6300", "list_price": 2800, "cost": 2050, "currency": "USD", "principal": "Aruba"},
    {"sku": "ARUBA-AP635", "list_price": 640, "cost": 480, "currency": "USD", "principal": "Aruba"},
    {"sku": "ARUBA-2930F", "list_price": 1400, "cost": 1060, "currency": "USD", "principal": "Aruba"},
    {"sku": "MS-E5", "list_price": 57, "cost": 48, "currency": "USD", "principal": "Microsoft"},
    {"sku": "MS-E3", "list_price": 36, "cost": 30, "currency": "USD", "principal": "Microsoft"},
    {"sku": "MS-AZURE-RI", "list_price": 100, "cost": 92, "currency": "USD", "principal": "Microsoft"},
    {"sku": "LEN-SR650", "list_price": 8400, "cost": 6200, "currency": "USD", "principal": "Lenovo"},
    {"sku": "LEN-THINKPAD-X1", "list_price": 1700, "cost": 1290, "currency": "USD", "principal": "Lenovo"},
    {"sku": "CISCO-C9300", "list_price": 7800, "cost": 6000, "currency": "USD", "principal": "Cisco"},
    {"sku": "CISCO-ISR4321", "list_price": 2900, "cost": 2200, "currency": "USD", "principal": "Cisco"},
    {"sku": "FORT-600F", "list_price": 14500, "cost": 10800, "currency": "USD", "principal": "Fortinet"},
    {"sku": "FORT-100F", "list_price": 3100, "cost": 2400, "currency": "USD", "principal": "Fortinet"},
    {"sku": "APC-SMX3000", "list_price": 2400, "cost": 1750, "currency": "USD", "principal": "APC"},
    {"sku": "APC-PDU-AP7841", "list_price": 980, "cost": 720, "currency": "USD", "principal": "APC"},
    {"sku": "HP-LJM404", "list_price": 410, "cost": 310, "currency": "USD", "principal": "HP"},
    {"sku": "HP-ELITEDESK-800", "list_price": 930, "cost": 700, "currency": "USD", "principal": "HP"},
    {"sku": "VEEAM-BU-ENT", "list_price": 1200, "cost": 920, "currency": "USD", "principal": "Veeam"},
    {"sku": "VEEAM-O365", "list_price": 22, "cost": 17, "currency": "USD", "principal": "Veeam"},
]


FINANCE_INVOICES = [
    {"invoice_id": "INV-2026-0501", "customer_id": "C-001", "customer_name": "Acme Telecom Kenya", "amount": 88000, "issued_at": _days_ago(40), "due_at": _days_ago(10), "status": "overdue", "days_overdue": 10},
    {"invoice_id": "INV-2026-0502", "customer_id": "C-002", "customer_name": "Nairobi DataHub", "amount": 62000, "issued_at": _days_ago(5), "due_at": _days_ahead(25), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0503", "customer_id": "C-003", "customer_name": "EastNet Logistics", "amount": 19000, "issued_at": _days_ago(20), "due_at": _days_ahead(10), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0504", "customer_id": "C-004", "customer_name": "Mombasa Fiber", "amount": 29000, "issued_at": _days_ago(22), "due_at": _days_ahead(8), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0505", "customer_id": "C-005", "customer_name": "Skyline ISP", "amount": 102000, "issued_at": _days_ago(60), "due_at": _days_ago(30), "status": "overdue", "days_overdue": 30},
    {"invoice_id": "INV-2026-0506", "customer_id": "C-006", "customer_name": "Kampala Cloud Works", "amount": 140000, "issued_at": _days_ago(12), "due_at": _days_ahead(18), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0507", "customer_id": "C-007", "customer_name": "Dar Health Network", "amount": 45000, "issued_at": _days_ago(35), "due_at": _days_ago(5), "status": "overdue", "days_overdue": 5},
    {"invoice_id": "INV-2026-0508", "customer_id": "C-008", "customer_name": "Kigali Government SOC", "amount": 210000, "issued_at": _days_ago(65), "due_at": _days_ago(35), "status": "overdue", "days_overdue": 35},
    {"invoice_id": "INV-2026-0509", "customer_id": "C-009", "customer_name": "Addis Retail Group", "amount": 23000, "issued_at": _days_ago(90), "due_at": _days_ago(60), "status": "paid", "paid_at": _days_ago(40), "days_overdue": 0},
    {"invoice_id": "INV-2026-0510", "customer_id": "C-010", "customer_name": "Juba Energy Authority", "amount": 51000, "issued_at": _days_ago(80), "due_at": _days_ago(50), "status": "paid", "paid_at": _days_ago(30), "days_overdue": 0},
    {"invoice_id": "INV-2026-0511", "customer_id": "C-011", "customer_name": "Zanzibar University", "amount": 42000, "issued_at": _days_ago(3), "due_at": _days_ahead(27), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0512", "customer_id": "C-012", "customer_name": "Bujumbura Bank Holdings", "amount": 87000, "issued_at": _days_ago(55), "due_at": _days_ago(25), "status": "overdue", "days_overdue": 25},
    {"invoice_id": "INV-2026-0513", "customer_id": "C-013", "customer_name": "Serengeti Safari Tech", "amount": 18000, "issued_at": _days_ago(18), "due_at": _days_ahead(12), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0514", "customer_id": "C-014", "customer_name": "Kisumu Sugar Co-op", "amount": 31000, "issued_at": _days_ago(6), "due_at": _days_ahead(24), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0515", "customer_id": "C-015", "customer_name": "Arusha MedLabs", "amount": 23000, "issued_at": _days_ago(45), "due_at": _days_ago(15), "status": "overdue", "days_overdue": 15},
    {"invoice_id": "INV-2026-0516", "customer_id": "C-016", "customer_name": "Entebbe Airport IT", "amount": 34000, "issued_at": _days_ago(8), "due_at": _days_ahead(22), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0517", "customer_id": "C-017", "customer_name": "Lamu Port Authority", "amount": 34000, "issued_at": _days_ago(30), "due_at": _days_ahead(0), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0518", "customer_id": "C-018", "customer_name": "Naivasha Horticulture", "amount": 14000, "issued_at": _days_ago(100), "due_at": _days_ago(70), "status": "paid", "paid_at": _days_ago(55), "days_overdue": 0},
    {"invoice_id": "INV-2026-0519", "customer_id": "C-005", "customer_name": "Skyline ISP", "amount": 36000, "issued_at": _days_ago(110), "due_at": _days_ago(80), "status": "overdue", "days_overdue": 80},
    {"invoice_id": "INV-2026-0520", "customer_id": "C-001", "customer_name": "Acme Telecom Kenya", "amount": 22000, "issued_at": _days_ago(2), "due_at": _days_ahead(28), "status": "outstanding", "days_overdue": 0},
    # UAE invoices
    {"invoice_id": "INV-2026-0521", "customer_id": "C-019", "customer_name": "Dubai Silicon Holdings", "amount": 210000, "issued_at": _days_ago(15), "due_at": _days_ahead(15), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0522", "customer_id": "C-020", "customer_name": "Abu Dhabi Smart Gov", "amount": 96000, "issued_at": _days_ago(9), "due_at": _days_ahead(21), "status": "outstanding", "days_overdue": 0},
    {"invoice_id": "INV-2026-0523", "customer_id": "C-021", "customer_name": "Sharjah Energy Partners", "amount": 55000, "issued_at": _days_ago(50), "due_at": _days_ago(20), "status": "overdue", "days_overdue": 20},
]


MARKETING_CAMPAIGNS = [
    {"campaign_id": "CMP-2026-11", "name": "TELCO DELL Refresh Q1", "channel": "email", "principal": "DELL", "status": "active", "leads_generated": 48, "pipeline_value": 520000, "spend_usd": 4500, "start_at": _days_ago(20), "end_at": _days_ahead(10), "owner": "lydia@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-12", "name": "EA Banking Security Summit", "channel": "event", "principal": "Fortinet", "status": "active", "leads_generated": 72, "pipeline_value": 880000, "spend_usd": 18500, "start_at": _days_ago(5), "end_at": _days_ahead(2), "owner": "grace@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-13", "name": "Microsoft E5 Upgrade Push", "channel": "webinar", "principal": "Microsoft", "status": "active", "leads_generated": 33, "pipeline_value": 190000, "spend_usd": 2100, "start_at": _days_ago(10), "end_at": _days_ahead(20), "owner": "lydia@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-14", "name": "Veeam Ransomware Readiness", "channel": "linkedin", "principal": "Veeam", "status": "active", "leads_generated": 41, "pipeline_value": 310000, "spend_usd": 3200, "start_at": _days_ago(14), "end_at": _days_ahead(14), "owner": "david@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-15", "name": "Aruba Wifi 6E Roadshow", "channel": "event", "principal": "Aruba", "status": "completed", "leads_generated": 58, "pipeline_value": 420000, "spend_usd": 9800, "start_at": _days_ago(60), "end_at": _days_ago(25), "owner": "david@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-16", "name": "HP Print-as-a-Service SMB", "channel": "email", "principal": "HP", "status": "active", "leads_generated": 19, "pipeline_value": 95000, "spend_usd": 1200, "start_at": _days_ago(7), "end_at": _days_ahead(21), "owner": "lydia@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-17", "name": "Cisco Gov SOC Workshop", "channel": "workshop", "principal": "Cisco", "status": "planned", "leads_generated": 0, "pipeline_value": 0, "spend_usd": 0, "start_at": _days_ahead(15), "end_at": _days_ahead(17), "owner": "grace@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-18", "name": "APC Power Resilience MFG", "channel": "email", "principal": "APC", "status": "active", "leads_generated": 12, "pipeline_value": 84000, "spend_usd": 800, "start_at": _days_ago(3), "end_at": _days_ahead(27), "owner": "francis@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-19", "name": "Lenovo Healthcare Mobility", "channel": "linkedin", "principal": "Lenovo", "status": "active", "leads_generated": 26, "pipeline_value": 145000, "spend_usd": 1850, "start_at": _days_ago(11), "end_at": _days_ahead(19), "owner": "grace@mitsumidistribution.com"},
    {"campaign_id": "CMP-2026-20", "name": "HPE Hybrid Cloud DC Tour", "channel": "event", "principal": "HPE", "status": "planned", "leads_generated": 0, "pipeline_value": 0, "spend_usd": 0, "start_at": _days_ahead(25), "end_at": _days_ahead(30), "owner": "david@mitsumidistribution.com"},
    # UAE campaigns
    {"campaign_id": "CMP-2026-21", "name": "GITEX Dubai Showcase", "channel": "event", "principal": "DELL", "status": "active", "leads_generated": 65, "pipeline_value": 720000, "spend_usd": 24000, "start_at": _days_ago(4), "end_at": _days_ahead(3), "owner": "amir@mitsumidistribution.com", "country": "AE"},
    {"campaign_id": "CMP-2026-22", "name": "UAE Gov Zero-Trust Briefing", "channel": "workshop", "principal": "Fortinet", "status": "planned", "leads_generated": 0, "pipeline_value": 0, "spend_usd": 0, "start_at": _days_ahead(10), "end_at": _days_ahead(11), "owner": "amir@mitsumidistribution.com", "country": "AE"},
]


OPS_TICKETS = [
    {"ticket_id": "TCK-7801", "customer_id": "C-002", "customer_name": "Nairobi DataHub", "subject": "PowerStore replication lag", "priority": "high", "status": "in_progress", "assignee": "ops-t2@mitsumidistribution.com", "created_at": _days_ago(3)},
    {"ticket_id": "TCK-7802", "customer_id": "C-005", "customer_name": "Skyline ISP", "subject": "Core switch port flap", "priority": "critical", "status": "open", "assignee": "ops-t3@mitsumidistribution.com", "created_at": _days_ago(0)},
    {"ticket_id": "TCK-7803", "customer_id": "C-001", "customer_name": "Acme Telecom Kenya", "subject": "Firmware advisory rollout", "priority": "medium", "status": "in_progress", "assignee": "ops-t1@mitsumidistribution.com", "created_at": _days_ago(5)},
    {"ticket_id": "TCK-7804", "customer_id": "C-006", "customer_name": "Kampala Cloud Works", "subject": "DR failover drill prep", "priority": "medium", "status": "open", "assignee": "ops-t2@mitsumidistribution.com", "created_at": _days_ago(2)},
    {"ticket_id": "TCK-7805", "customer_id": "C-008", "customer_name": "Kigali Government SOC", "subject": "Fortigate HA split-brain", "priority": "critical", "status": "in_progress", "assignee": "ops-t3@mitsumidistribution.com", "created_at": _days_ago(1)},
    {"ticket_id": "TCK-7806", "customer_id": "C-012", "customer_name": "Bujumbura Bank Holdings", "subject": "Branch VPN degraded", "priority": "high", "status": "open", "assignee": "ops-t2@mitsumidistribution.com", "created_at": _days_ago(2)},
    {"ticket_id": "TCK-7807", "customer_id": "C-010", "customer_name": "Juba Energy Authority", "subject": "UPS battery replacement", "priority": "low", "status": "resolved", "assignee": "ops-t1@mitsumidistribution.com", "created_at": _days_ago(8), "resolved_at": _days_ago(1)},
    {"ticket_id": "TCK-7808", "customer_id": "C-007", "customer_name": "Dar Health Network", "subject": "Server boot failure", "priority": "high", "status": "resolved", "assignee": "ops-t2@mitsumidistribution.com", "created_at": _days_ago(4), "resolved_at": _days_ago(1)},
    {"ticket_id": "TCK-7809", "customer_id": "C-016", "customer_name": "Entebbe Airport IT", "subject": "Access switch config audit", "priority": "medium", "status": "open", "assignee": "ops-t1@mitsumidistribution.com", "created_at": _days_ago(1)},
    {"ticket_id": "TCK-7810", "customer_id": "C-013", "customer_name": "Serengeti Safari Tech", "subject": "Guest wifi captive portal", "priority": "low", "status": "open", "assignee": "ops-t1@mitsumidistribution.com", "created_at": _days_ago(6)},
    {"ticket_id": "TCK-7811", "customer_id": "C-014", "customer_name": "Kisumu Sugar Co-op", "subject": "PDU monitoring offline", "priority": "medium", "status": "in_progress", "assignee": "ops-t1@mitsumidistribution.com", "created_at": _days_ago(3)},
    {"ticket_id": "TCK-7812", "customer_id": "C-003", "customer_name": "EastNet Logistics", "subject": "Printer fleet onboarding", "priority": "low", "status": "open", "assignee": "ops-t1@mitsumidistribution.com", "created_at": _days_ago(9)},
    {"ticket_id": "TCK-7813", "customer_id": "C-017", "customer_name": "Lamu Port Authority", "subject": "WAN latency spike", "priority": "high", "status": "in_progress", "assignee": "ops-t2@mitsumidistribution.com", "created_at": _days_ago(0)},
    {"ticket_id": "TCK-7814", "customer_id": "C-018", "customer_name": "Naivasha Horticulture", "subject": "M365 tenant migration", "priority": "medium", "status": "open", "assignee": "ops-t1@mitsumidistribution.com", "created_at": _days_ago(2)},
    {"ticket_id": "TCK-7815", "customer_id": "C-011", "customer_name": "Zanzibar University", "subject": "Classroom access point dead", "priority": "medium", "status": "resolved", "assignee": "ops-t1@mitsumidistribution.com", "created_at": _days_ago(7), "resolved_at": _days_ago(2)},
    # UAE tickets
    {"ticket_id": "TCK-7816", "customer_id": "C-019", "customer_name": "Dubai Silicon Holdings", "subject": "Storage array replication alarm", "priority": "high", "status": "in_progress", "assignee": "ops-uae@mitsumidistribution.com", "created_at": _days_ago(1)},
    {"ticket_id": "TCK-7817", "customer_id": "C-020", "customer_name": "Abu Dhabi Smart Gov", "subject": "Firewall cluster failover test", "priority": "medium", "status": "open", "assignee": "ops-uae@mitsumidistribution.com", "created_at": _days_ago(3)},
]


OPS_SHIPMENTS = [
    {"shipment_id": "SHP-2026-9001", "order_id": "SO-2026-2203", "customer_name": "Nairobi DataHub", "carrier": "DHL", "status": "delivered", "shipped_at": _days_ago(3), "eta": _days_ago(1), "tracking": "JD014600005874321"},
    {"shipment_id": "SHP-2026-9002", "order_id": "SO-2026-2211", "customer_name": "Kampala Cloud Works", "carrier": "DHL", "status": "in_transit", "shipped_at": _days_ago(2), "eta": _days_ahead(3), "tracking": "JD014600005874477"},
    {"shipment_id": "SHP-2026-9003", "order_id": "SO-2026-2205", "customer_name": "Mombasa Fiber", "carrier": "AeroKenya", "status": "delivered", "shipped_at": _days_ago(19), "eta": _days_ago(17), "tracking": "AK-KEN-00213"},
    {"shipment_id": "SHP-2026-9004", "order_id": "SO-2026-2212", "customer_name": "Serengeti Safari Tech", "carrier": "DHL", "status": "in_transit", "shipped_at": _days_ago(1), "eta": _days_ahead(4), "tracking": "JD014600005874519"},
    {"shipment_id": "SHP-2026-9005", "order_id": "SO-2026-2208", "customer_name": "Dar Health Network", "carrier": "DHL", "status": "delivered", "shipped_at": _days_ago(31), "eta": _days_ago(28), "tracking": "JD014600005874190"},
    {"shipment_id": "SHP-2026-9006", "order_id": "SO-2026-2214", "customer_name": "Lamu Port Authority", "carrier": "AeroKenya", "status": "in_transit", "shipped_at": _days_ago(0), "eta": _days_ahead(2), "tracking": "AK-KEN-00228"},
    {"shipment_id": "SHP-2026-9007", "order_id": "SO-2026-2207", "customer_name": "EastNet Logistics", "carrier": "Wells Fargo", "status": "delivered", "shipped_at": _days_ago(13), "eta": _days_ago(11), "tracking": "WF-2026-0037"},
    {"shipment_id": "SHP-2026-9008", "order_id": "SO-2026-2204", "customer_name": "Acme Telecom Kenya", "carrier": "DHL", "status": "delivered", "shipped_at": _days_ago(23), "eta": _days_ago(21), "tracking": "JD014600005873988"},
    {"shipment_id": "SHP-2026-9009", "order_id": "SO-2026-2202", "customer_name": "Kisumu Sugar Co-op", "carrier": "Wells Fargo", "status": "delivered", "shipped_at": _days_ago(6), "eta": _days_ago(4), "tracking": "WF-2026-0041"},
    {"shipment_id": "SHP-2026-9010", "order_id": "SO-2026-2201", "customer_name": "Zanzibar University", "carrier": "digital-delivery", "status": "delivered", "shipped_at": _days_ago(2), "eta": _days_ago(2), "tracking": "DIG-LIC-11"},
    {"shipment_id": "SHP-2026-9011", "order_id": "SO-2026-2209", "customer_name": "Kigali Government SOC", "carrier": "Kenya Airways Cargo", "status": "delivered", "shipped_at": _days_ago(56), "eta": _days_ago(53), "tracking": "KQ-CG-4402"},
    {"shipment_id": "SHP-2026-9012", "order_id": "SO-2026-2210", "customer_name": "Bujumbura Bank Holdings", "carrier": "DHL", "status": "delivered", "shipped_at": _days_ago(51), "eta": _days_ago(48), "tracking": "JD014600005873214"},
    # UAE shipments
    {"shipment_id": "SHP-2026-9013", "order_id": "SO-2026-2216", "customer_name": "Dubai Silicon Holdings", "carrier": "Emirates SkyCargo", "status": "delivered", "shipped_at": _days_ago(15), "eta": _days_ago(13), "tracking": "EK-CARGO-77312"},
    {"shipment_id": "SHP-2026-9014", "order_id": "SO-2026-2217", "customer_name": "Abu Dhabi Smart Gov", "carrier": "digital-delivery", "status": "delivered", "shipped_at": _days_ago(8), "eta": _days_ago(8), "tracking": "DIG-LIC-22"},
]


KNOWLEDGE_BASE = [
    {"source": "pricing_policy.md", "text": "DELL enterprise deals over 50k USD require regional approval via the Mitsumi pricing desk before a final quote is issued."},
    {"source": "credit_policy.md", "text": "Customers with overdue invoices above 30 days are automatically placed on credit hold; finance must approve any new POs until cleared."},
    {"source": "inventory_guide.md", "text": "Core server skus are stocked in Nairobi WH-A; Kampala WH-B handles networking spares, and License-Pool covers Microsoft and Veeam subscriptions."},
    {"source": "marketing_playbook.md", "text": "TELCO lead campaigns convert best with multi-touch outreach: email intro, technical webinar, 1-on-1 demo within 21 days."},
    {"source": "principal_rebates.md", "text": "DELL rebate is tiered quarterly, capped at 6% for Platinum partners; HPE and Aruba rebates settle monthly at 5% and 5.5% respectively."},
    {"source": "sla_response.md", "text": "P1 ops tickets have a 1-hour response SLA and 4-hour mitigation target; P2 tickets have a 4-hour response SLA."},
    {"source": "channel_conflict.md", "text": "Where two Mitsumi sellers target the same account, first-registered lead wins; ties escalate to the head of sales."},
    {"source": "shipping_regions.md", "text": "DHL covers Kenya, Uganda, Rwanda; Kenya Airways Cargo covers the EA region air freight; local couriers handle in-country Nairobi last-mile."},
    {"source": "deal_registration.md", "text": "DELL and Fortinet deal registration must be filed within 5 business days of customer qualification to retain special pricing."},
    {"source": "veeam_bundles.md", "text": "Preferred Veeam bundle: BU-ENT + M365 protection; 18% average gross margin in East Africa."},
    {"source": "ms_licensing.md", "text": "Microsoft CSP license moves are invoiced monthly; annual commitments produce a 7% margin uplift vs. monthly commitments."},
    {"source": "ops_runbook.md", "text": "For FortiGate HA split-brain, disable the slave heartbeat, reconfirm session-pickup is disabled on link-down, then re-enable heartbeat."},
]


async def seed_mitsumi(db) -> None:
    """Populate Mitsumi Distribution demo data. Safe to re-run."""
    from app.core.scope import REGIONS, region_for_country

    await _ensure_indexes(db)

    # Build customer_id -> (region, country) lookup so we can enrich every
    # child row (leads, orders, invoices, tickets, shipments) with a
    # consistent scope without duplicating the data in each dict above.
    id_to_country = {row["customer_id"]: row["country"] for row in CUSTOMERS}

    def _enrich(rows: list[dict]) -> list[dict]:
        out: list[dict] = []
        for raw in rows:
            row = dict(raw)
            country = row.get("country") or id_to_country.get(row.get("customer_id") or "") or "KE"
            row["country"] = country.upper()
            row["region"] = region_for_country(row["country"]) or "africa"
            out.append(row)
        return out

    # Seed master: regions + countries
    regions_col = db["regions"]
    if await regions_col.count_documents({}) == 0:
        region_rows = [
            {"key": region, "label": region.title(), "countries": countries}
            for region, countries in REGIONS.items()
        ]
        if region_rows:
            await regions_col.insert_many(region_rows)

    plan = [
        ("customers", _enrich(CUSTOMERS)),
        ("principals", [dict(p) for p in PRINCIPALS]),
        ("crm_leads", _enrich(CRM_LEADS)),
        ("sales_quotes", _enrich(SALES_QUOTES)),
        ("sales_orders", _enrich(SALES_ORDERS)),
        ("erp_inventory", [dict(r) for r in ERP_INVENTORY]),
        ("pricing_book", [dict(r) for r in PRICING_BOOK]),
        ("finance_invoices", _enrich(FINANCE_INVOICES)),
        ("marketing_campaigns", _enrich(MARKETING_CAMPAIGNS)),
        ("ops_tickets", _enrich(OPS_TICKETS)),
        ("ops_shipments", _enrich([
            {**row, "customer_id": _shipment_to_customer(row)}
            for row in OPS_SHIPMENTS
        ])),
        ("knowledge_base", [dict(r) for r in KNOWLEDGE_BASE]),
    ]
    for name, rows in plan:
        collection = db[name]
        if await collection.count_documents({}) == 0 and rows:
            await collection.insert_many(rows)


def _shipment_to_customer(shipment: dict) -> str:
    """Resolve a customer_id for a shipment using its customer_name."""
    name = shipment.get("customer_name")
    for c in CUSTOMERS:
        if c["name"] == name:
            return c["customer_id"]
    return ""


async def _ensure_indexes(db) -> None:
    await db["customers"].create_index("customer_id", unique=True)
    await db["principals"].create_index("principal_id", unique=True)
    await db["crm_leads"].create_index("lead_id", unique=True)
    await db["crm_leads"].create_index("stage")
    await db["sales_quotes"].create_index("quote_id", unique=True)
    await db["sales_orders"].create_index("order_id", unique=True)
    await db["sales_orders"].create_index("closed_at")
    await db["erp_inventory"].create_index("sku", unique=True)
    await db["pricing_book"].create_index("sku", unique=True)
    await db["finance_invoices"].create_index("invoice_id", unique=True)
    await db["finance_invoices"].create_index("status")
    await db["marketing_campaigns"].create_index("campaign_id", unique=True)
    await db["marketing_campaigns"].create_index("status")
    await db["ops_tickets"].create_index("ticket_id", unique=True)
    await db["ops_tickets"].create_index("status")
    await db["ops_shipments"].create_index("shipment_id", unique=True)
    await db["knowledge_base"].create_index("source", unique=True)
    await db["regions"].create_index("key", unique=True)
    for col in ("customers", "crm_leads", "sales_quotes", "sales_orders",
                "finance_invoices", "marketing_campaigns", "ops_tickets", "ops_shipments"):
        await db[col].create_index("country")
        await db[col].create_index("region")
