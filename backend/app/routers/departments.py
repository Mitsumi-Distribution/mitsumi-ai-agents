"""Department overview endpoints.

Every query is scoped to the caller's region/country via `scope_filter`.
Super admins may pass ?region=... or ?country=... to drill down.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.auth import get_current_user_full
from app.core.audit import record as audit_record
from app.core.mongo import mongo_db, user_has_module
from app.core.scope import scope_filter

router = APIRouter(prefix="/department", tags=["departments"])

DEPARTMENTS = {"sales", "marketing", "finance", "ops"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _serialize(doc: dict[str, Any]) -> dict[str, Any]:
    clean = {k: v for k, v in doc.items() if k != "_id"}
    for key, value in list(clean.items()):
        if isinstance(value, datetime):
            clean[key] = value.astimezone(timezone.utc).isoformat()
    return clean


async def _ensure_access(name: str, user: dict) -> None:
    if name not in DEPARTMENTS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown department")
    if not (user_has_module(user, f"department:{name}") or user_has_module(user, f"agent:{name}")):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not allowed")


async def _fetch_list(
    collection: str,
    *,
    scope: dict,
    sort=None,
    limit: int = 10,
    extra: dict | None = None,
) -> list[dict]:
    filt = {**scope, **(extra or {})}
    cursor = mongo_db[collection].find(filt, {"_id": 0})
    if sort:
        cursor = cursor.sort(sort)
    docs = await cursor.to_list(length=limit)
    return [_serialize(doc) for doc in docs]


async def _sum(collection: str, scope: dict, match_extra: dict | None = None, field: str = "amount") -> tuple[int, int]:
    match = {**scope, **(match_extra or {})}
    rows = await mongo_db[collection].aggregate([
        {"$match": match},
        {"$group": {"_id": None, "total": {"$sum": f"${field}"}, "count": {"$sum": 1}}},
    ]).to_list(length=1)
    if not rows:
        return 0, 0
    return rows[0]["total"], rows[0]["count"]


# ---------- SALES ----------------------------------------------------------
async def _sales_overview(scope: dict) -> dict:
    leads_col = mongo_db["crm_leads"]
    orders_col = mongo_db["sales_orders"]

    open_stages = ["open", "qualified", "proposal", "negotiation"]

    stage_rows = await leads_col.aggregate([
        {"$match": {**scope, "stage": {"$in": open_stages}}},
        {"$group": {
            "_id": "$stage",
            "value": {"$sum": "$amount"},
            "count": {"$sum": 1},
            "weighted": {"$sum": {"$multiply": ["$amount", {"$ifNull": ["$probability", 0]}]}},
        }},
    ]).to_list(length=20)
    pipeline_value = sum(row["value"] for row in stage_rows)
    weighted_value = sum(row["weighted"] for row in stage_rows)

    won_value, won_count = await _sum("crm_leads", scope, {"stage": "won"})
    orders_total, orders_count = await _sum("sales_orders", scope)

    top_deals = await _fetch_list(
        "crm_leads", scope=scope, sort=[("amount", -1)], limit=5,
        extra={"stage": {"$in": open_stages}},
    )
    recent_orders = await _fetch_list("sales_orders", scope=scope, sort=[("closed_at", -1)], limit=5)

    return {
        "kpis": {
            "pipeline_value": pipeline_value,
            "weighted_pipeline": round(weighted_value, 2),
            "won_deals_count": won_count,
            "won_deals_value": won_value,
            "orders_total_value": orders_total,
            "orders_count": orders_count,
        },
        "stage_breakdown": [
            {"stage": r["_id"], "count": r["count"], "value": r["value"]}
            for r in sorted(stage_rows, key=lambda x: x["value"], reverse=True)
        ],
        "top_deals": top_deals,
        "recent_orders": recent_orders,
    }


# ---------- MARKETING ------------------------------------------------------
async def _marketing_overview(scope: dict) -> dict:
    campaigns_col = mongo_db["marketing_campaigns"]

    agg = await campaigns_col.aggregate([
        {"$match": scope},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "leads": {"$sum": "$leads_generated"},
            "pipeline": {"$sum": "$pipeline_value"},
            "spend": {"$sum": "$spend_usd"},
        }},
    ]).to_list(length=20)
    by_channel = await campaigns_col.aggregate([
        {"$match": scope},
        {"$group": {
            "_id": "$channel",
            "count": {"$sum": 1},
            "leads": {"$sum": "$leads_generated"},
            "pipeline": {"$sum": "$pipeline_value"},
            "spend": {"$sum": "$spend_usd"},
        }},
        {"$sort": {"pipeline": -1}},
    ]).to_list(length=20)

    active = await _fetch_list("marketing_campaigns", scope=scope, sort=[("start_at", -1)], limit=8, extra={"status": "active"})
    upcoming = await _fetch_list("marketing_campaigns", scope=scope, sort=[("start_at", 1)], limit=5, extra={"status": "planned"})

    total_leads = sum(r["leads"] for r in agg)
    total_pipeline = sum(r["pipeline"] for r in agg)
    total_spend = sum(r["spend"] for r in agg)
    active_count = next((r["count"] for r in agg if r["_id"] == "active"), 0)

    return {
        "kpis": {
            "active_campaigns": active_count,
            "total_leads": total_leads,
            "pipeline_influenced": total_pipeline,
            "total_spend": total_spend,
            "roi_ratio": round(total_pipeline / total_spend, 2) if total_spend else 0,
        },
        "status_breakdown": [{"status": r["_id"], "count": r["count"], "leads": r["leads"], "pipeline": r["pipeline"]} for r in agg],
        "channel_breakdown": [{"channel": r["_id"], "count": r["count"], "leads": r["leads"], "pipeline": r["pipeline"], "spend": r["spend"]} for r in by_channel],
        "active_campaigns": active,
        "upcoming_campaigns": upcoming,
    }


# ---------- FINANCE --------------------------------------------------------
async def _finance_overview(scope: dict) -> dict:
    outstanding_total, outstanding_count = await _sum("finance_invoices", scope, {"status": {"$in": ["outstanding", "overdue"]}})
    overdue_total, overdue_count = await _sum("finance_invoices", scope, {"status": "overdue"})
    paid_total, _ = await _sum("finance_invoices", scope, {"status": "paid"})
    revenue_total, _ = await _sum("sales_orders", scope)

    aging_buckets = [("current", 0, 0), ("1-30", 1, 30), ("31-60", 31, 60), ("60+", 61, 9999)]
    aging: list[dict] = []
    for label, lo, hi in aging_buckets:
        match: dict = {**scope, "status": {"$in": ["outstanding", "overdue"]}}
        if label == "current":
            match["days_overdue"] = 0
        else:
            match["days_overdue"] = {"$gte": lo, "$lte": hi}
        rows = await mongo_db["finance_invoices"].aggregate([
            {"$match": match},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}},
        ]).to_list(length=1)
        aging.append({
            "bucket": label,
            "total": rows[0]["total"] if rows else 0,
            "count": rows[0]["count"] if rows else 0,
        })

    top_overdue = await _fetch_list(
        "finance_invoices", scope=scope, sort=[("days_overdue", -1), ("amount", -1)], limit=5,
        extra={"status": "overdue"},
    )
    recent_invoices = await _fetch_list("finance_invoices", scope=scope, sort=[("issued_at", -1)], limit=8)

    return {
        "kpis": {
            "revenue_total": revenue_total,
            "outstanding_total": outstanding_total,
            "outstanding_count": outstanding_count,
            "overdue_total": overdue_total,
            "overdue_count": overdue_count,
            "paid_total": paid_total,
        },
        "aging": aging,
        "top_overdue": top_overdue,
        "recent_invoices": recent_invoices,
    }


# ---------- OPS ------------------------------------------------------------
async def _ops_overview(scope: dict) -> dict:
    tickets_col = mongo_db["ops_tickets"]
    shipments_col = mongo_db["ops_shipments"]
    inventory_col = mongo_db["erp_inventory"]

    ticket_status = await tickets_col.aggregate([
        {"$match": scope},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]).to_list(length=20)
    ticket_priority = await tickets_col.aggregate([
        {"$match": {**scope, "status": {"$in": ["open", "in_progress"]}}},
        {"$group": {"_id": "$priority", "count": {"$sum": 1}}},
    ]).to_list(length=20)

    shipments_status = await shipments_col.aggregate([
        {"$match": scope},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]).to_list(length=20)

    low_stock = await inventory_col.aggregate([
        {"$match": {"$expr": {"$lte": ["$quantity", "$reorder_point"]}}},
        {"$project": {"_id": 0}},
        {"$sort": {"quantity": 1}},
        {"$limit": 8},
    ]).to_list(length=8)

    open_tickets = await _fetch_list(
        "ops_tickets", scope=scope, sort=[("priority", -1), ("created_at", -1)], limit=8,
        extra={"status": {"$in": ["open", "in_progress"]}},
    )
    in_transit = await _fetch_list(
        "ops_shipments", scope=scope, sort=[("eta", 1)], limit=8, extra={"status": "in_transit"}
    )

    open_count = sum(r["count"] for r in ticket_status if r["_id"] in ("open", "in_progress"))

    return {
        "kpis": {
            "tickets_open": open_count,
            "tickets_total": sum(r["count"] for r in ticket_status),
            "shipments_in_transit": next((r["count"] for r in shipments_status if r["_id"] == "in_transit"), 0),
            "shipments_delivered": next((r["count"] for r in shipments_status if r["_id"] == "delivered"), 0),
            "sku_low_stock": len(low_stock),
        },
        "tickets_by_status": [{"status": r["_id"], "count": r["count"]} for r in ticket_status],
        "tickets_by_priority": [{"priority": r["_id"], "count": r["count"]} for r in ticket_priority],
        "open_tickets": open_tickets,
        "shipments_in_transit": in_transit,
        "low_stock": low_stock,
    }


OVERVIEW_BUILDERS = {
    "sales": _sales_overview,
    "marketing": _marketing_overview,
    "finance": _finance_overview,
    "ops": _ops_overview,
}


@router.get("/{name}/overview")
async def department_overview(
    name: str,
    region: str | None = Query(default=None),
    country: str | None = Query(default=None),
    user=Depends(get_current_user_full),
) -> dict:
    await _ensure_access(name, user)
    scope = scope_filter(user, region_override=region, country_override=country)
    # Record scope overrides for auditability — only when a super-admin
    # actually narrows the default view (avoids logging every dashboard tick).
    if (region or country) and user.get("is_super_admin"):
        await audit_record(
            "department.scope_override",
            actor=user,
            target=name,
            metadata={"region": region, "country": country},
        )
    builder = OVERVIEW_BUILDERS[name]
    payload = await builder(scope)
    payload["department"] = name
    payload["scope"] = {"region": scope.get("region"), "country": scope.get("country")}
    payload["generated_at"] = _now().isoformat()
    return payload
