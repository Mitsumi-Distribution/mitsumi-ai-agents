"""Department-specific tools backed by the seeded Mitsumi Mongo collections."""

from __future__ import annotations

import json

from langchain_core.tools import tool

from app.core.mongo import mongo_db
from app.core.tool_cache import get_cached, set_cached


def _dumps(value) -> str:
    return json.dumps(value, default=str)


@tool
async def sales_pipeline_summary() -> str:
    """Return current sales pipeline totals grouped by stage, plus overall weighted value."""
    pipeline = await mongo_db["crm_leads"].aggregate([
        {"$match": {"stage": {"$in": ["open", "qualified", "proposal", "negotiation"]}}},
        {"$group": {
            "_id": "$stage",
            "count": {"$sum": 1},
            "value": {"$sum": "$amount"},
            "weighted": {"$sum": {"$multiply": ["$amount", {"$ifNull": ["$probability", 0]}]}},
        }},
        {"$sort": {"value": -1}},
    ]).to_list(length=20)
    total_value = sum(row["value"] for row in pipeline)
    total_weighted = sum(row["weighted"] for row in pipeline)
    return _dumps({
        "total_pipeline_value": total_value,
        "weighted_pipeline_value": round(total_weighted, 2),
        "by_stage": [
            {"stage": row["_id"], "count": row["count"], "value": row["value"], "weighted": round(row["weighted"], 2)}
            for row in pipeline
        ],
    })


@tool
async def quote_search(query: str) -> str:
    """Search sales quotes by customer, principal, or quote id. Returns up to 10 matches."""
    q = (query or "").strip()
    filt = {}
    if q:
        filt = {"$or": [
            {"quote_id": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"principal": {"$regex": q, "$options": "i"}},
            {"status": {"$regex": q, "$options": "i"}},
        ]}
    rows = await mongo_db["sales_quotes"].find(filt, {"_id": 0}).sort("created_at", -1).limit(10).to_list(length=10)
    return _dumps({"query": query, "rows": rows})


@tool
async def invoice_search(query: str) -> str:
    """Search AR invoices by customer, status (paid/outstanding/overdue) or invoice id."""
    cached = await get_cached("invoice_search", {"query": query})
    if cached:
        return cached
    q = (query or "").strip()
    filt = {}
    if q:
        filt = {"$or": [
            {"invoice_id": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"status": {"$regex": q, "$options": "i"}},
        ]}
    rows = await mongo_db["finance_invoices"].find(filt, {"_id": 0}).sort("issued_at", -1).limit(10).to_list(length=10)
    result = _dumps({"query": query, "rows": rows})
    await set_cached("invoice_search", {"query": query}, result)
    return result


@tool
async def finance_aging_report() -> str:
    """Return AR aging buckets (current, 1-30, 31-60, 60+ days) with totals and invoice counts."""
    buckets = [("current", 0, 0), ("1-30", 1, 30), ("31-60", 31, 60), ("60+", 61, 9999)]
    report = []
    for label, lo, hi in buckets:
        match: dict = {"status": {"$in": ["outstanding", "overdue"]}}
        if label == "current":
            match["days_overdue"] = 0
        else:
            match["days_overdue"] = {"$gte": lo, "$lte": hi}
        rows = await mongo_db["finance_invoices"].aggregate([
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]).to_list(length=1)
        report.append({
            "bucket": label,
            "total": rows[0]["total"] if rows else 0,
            "count": rows[0]["count"] if rows else 0,
        })
    return _dumps({"aging": report})


@tool
async def campaign_list(status: str = "active") -> str:
    """List marketing campaigns filtered by status (active, planned, completed, or 'all')."""
    filt = {} if status.lower() == "all" else {"status": status.lower()}
    rows = await mongo_db["marketing_campaigns"].find(filt, {"_id": 0}).sort("start_at", -1).limit(20).to_list(length=20)
    return _dumps({"status_filter": status, "rows": rows})


@tool
async def ticket_search(query: str) -> str:
    """Search ops tickets by customer, subject, priority, status or ticket id."""
    q = (query or "").strip()
    filt = {}
    if q:
        filt = {"$or": [
            {"ticket_id": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"subject": {"$regex": q, "$options": "i"}},
            {"priority": {"$regex": q, "$options": "i"}},
            {"status": {"$regex": q, "$options": "i"}},
        ]}
    rows = await mongo_db["ops_tickets"].find(filt, {"_id": 0}).sort("created_at", -1).limit(10).to_list(length=10)
    return _dumps({"query": query, "rows": rows})


@tool
async def shipment_status(query: str) -> str:
    """Look up shipments by tracking number, order id, customer or status."""
    q = (query or "").strip()
    filt = {}
    if q:
        filt = {"$or": [
            {"shipment_id": {"$regex": q, "$options": "i"}},
            {"order_id": {"$regex": q, "$options": "i"}},
            {"tracking": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"status": {"$regex": q, "$options": "i"}},
            {"carrier": {"$regex": q, "$options": "i"}},
        ]}
    rows = await mongo_db["ops_shipments"].find(filt, {"_id": 0}).sort("shipped_at", -1).limit(10).to_list(length=10)
    return _dumps({"query": query, "rows": rows})


@tool
async def low_stock_report(threshold_multiplier: float = 1.0) -> str:
    """List SKUs whose quantity is at or below their reorder point."""
    pipeline = [
        {"$match": {"$expr": {"$lte": ["$quantity", {"$multiply": ["$reorder_point", max(0.1, float(threshold_multiplier))]}]}}},
        {"$project": {"_id": 0}},
        {"$sort": {"quantity": 1}},
        {"$limit": 20},
    ]
    rows = await mongo_db["erp_inventory"].aggregate(pipeline).to_list(length=20)
    return _dumps({"threshold_multiplier": threshold_multiplier, "rows": rows})
