"""New tools for enhanced Mitsumi agents.

customer_analytics — aggregate customer performance metrics
order_search      — search sales orders
sales_forecast    — weighted pipeline forecast with trends
"""

from __future__ import annotations

import json

from langchain_core.tools import tool

from app.core.mongo import mongo_db


def _dumps(v) -> str:
    return json.dumps(v, default=str)


@tool
async def customer_analytics(customer_name: str) -> str:
    """Get a 360-degree view of a customer: open deals, invoices, tickets, shipments and overall health score."""
    regex = {"$regex": customer_name, "$options": "i"}
    leads = await mongo_db["crm_leads"].find({"customer_name": regex}, {"_id": 0}).to_list(length=20)
    invoices = await mongo_db["finance_invoices"].find({"customer_name": regex}, {"_id": 0}).to_list(length=20)
    tickets = await mongo_db["ops_tickets"].find({"customer_name": regex}, {"_id": 0}).to_list(length=10)
    shipments = await mongo_db["ops_shipments"].find({"customer_name": regex}, {"_id": 0}).to_list(length=10)

    total_pipeline = sum(l.get("amount", 0) for l in leads if l.get("stage") not in ("closed_won", "closed_lost"))
    total_invoiced = sum(i.get("amount", 0) for i in invoices)
    outstanding = sum(i.get("amount", 0) for i in invoices if i.get("status") in ("outstanding", "overdue"))
    open_tickets = sum(1 for t in tickets if t.get("status") not in ("resolved", "closed"))
    in_transit = sum(1 for s in shipments if s.get("status") in ("in_transit", "shipped"))

    health = "good"
    if outstanding > total_invoiced * 0.4:
        health = "at_risk"
    if open_tickets > 3:
        health = "needs_attention"

    return _dumps({
        "customer": customer_name,
        "health": health,
        "pipeline_value": total_pipeline,
        "total_invoiced": total_invoiced,
        "outstanding_ar": outstanding,
        "open_deals": len([l for l in leads if l.get("stage") not in ("closed_won", "closed_lost")]),
        "open_tickets": open_tickets,
        "shipments_in_transit": in_transit,
        "deals": leads[:5],
        "recent_invoices": invoices[:5],
        "recent_tickets": tickets[:3],
    })


@tool
async def order_search(query: str) -> str:
    """Search sales orders by customer, order ID, status or product. Returns matching orders with line items."""
    q = (query or "").strip()
    filt = {}
    if q:
        filt = {"$or": [
            {"order_id": {"$regex": q, "$options": "i"}},
            {"customer_name": {"$regex": q, "$options": "i"}},
            {"status": {"$regex": q, "$options": "i"}},
            {"products": {"$regex": q, "$options": "i"}},
        ]}
    rows = await mongo_db["sales_orders"].find(filt, {"_id": 0}).sort("created_at", -1).limit(10).to_list(length=10)
    total_value = sum(r.get("total", 0) for r in rows)
    return _dumps({"query": query, "rows": rows, "total_value": total_value, "count": len(rows)})


@tool
async def sales_forecast(period: str = "quarter") -> str:
    """Generate a weighted sales forecast. Groups by stage with probability-weighted values and trends."""
    pipeline = await mongo_db["crm_leads"].aggregate([
        {"$match": {"stage": {"$in": ["open", "qualified", "proposal", "negotiation"]}}},
        {"$group": {
            "_id": "$stage",
            "count": {"$sum": 1},
            "value": {"$sum": "$amount"},
            "weighted": {"$sum": {"$multiply": ["$amount", {"$ifNull": ["$probability", 0]}]}},
            "avg_probability": {"$avg": {"$ifNull": ["$probability", 0]}},
        }},
        {"$sort": {"weighted": -1}},
    ]).to_list(length=20)

    total_value = sum(row["value"] for row in pipeline)
    total_weighted = sum(row["weighted"] for row in pipeline)
    best_case = total_value
    worst_case = total_weighted * 0.6
    expected = total_weighted

    # Top deals by weighted value
    top_deals = await mongo_db["crm_leads"].find(
        {"stage": {"$in": ["open", "qualified", "proposal", "negotiation"]}},
        {"_id": 0, "lead_id": 1, "customer_name": 1, "amount": 1, "stage": 1, "probability": 1, "principal": 1},
    ).sort("amount", -1).limit(5).to_list(length=5)

    return _dumps({
        "period": period,
        "total_pipeline": total_value,
        "weighted_forecast": round(expected, 2),
        "best_case": round(best_case, 2),
        "worst_case": round(worst_case, 2),
        "by_stage": [
            {
                "stage": row["_id"],
                "deals": row["count"],
                "value": row["value"],
                "weighted": round(row["weighted"], 2),
                "avg_probability": round(row["avg_probability"] * 100, 1),
            }
            for row in pipeline
        ],
        "top_deals": top_deals,
    })
