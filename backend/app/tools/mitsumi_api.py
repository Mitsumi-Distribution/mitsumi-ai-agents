import json

from langchain_core.tools import tool

from app.core.mongo import mongo_db
from app.core.tool_cache import get_cached, set_cached


@tool
async def mitsumi_pricing(query: str) -> str:
    """Look up Mitsumi product pricing. Search by SKU, principal name (Dell, HPE, Fortinet, etc.),
    or product description. Returns list price, cost, and margin for matching products."""
    cached = await get_cached("mitsumi_pricing", {"query": query})
    if cached:
        return cached

    q = query.strip()
    # Try exact SKU match first
    doc = await mongo_db["pricing_book"].find_one({"sku": q.upper()}, {"_id": 0})
    if doc:
        result = _format_single(doc)
        await set_cached("mitsumi_pricing", {"query": query}, result)
        return result

    # Fuzzy search by SKU, principal, or description
    regex = {"$regex": q, "$options": "i"}
    cursor = mongo_db["pricing_book"].find(
        {"$or": [{"sku": regex}, {"principal": regex}, {"description": regex}, {"category": regex}]},
        {"_id": 0},
    ).limit(10)
    matches = await cursor.to_list(length=10)

    if not matches:
        return json.dumps({"query": q, "rows": [], "error": f"No products found matching '{q}'"})

    rows = []
    for doc in matches:
        lp = doc.get("list_price", 0)
        cost = doc.get("cost", 0)
        margin = lp - cost
        margin_pct = (margin / lp * 100) if lp else 0
        rows.append({
            "sku": doc.get("sku", ""),
            "principal": doc.get("principal", ""),
            "description": doc.get("description", ""),
            "list_price": lp,
            "cost": cost,
            "margin": round(margin, 2),
            "margin_pct": round(margin_pct, 1),
            "currency": doc.get("currency", "USD"),
        })

    result = json.dumps({"query": q, "rows": rows, "count": len(rows)})
    await set_cached("mitsumi_pricing", {"query": query}, result)
    return result


def _format_single(doc: dict) -> str:
    lp = doc.get("list_price", 0)
    cost = doc.get("cost", 0)
    margin = lp - cost
    margin_pct = (margin / lp * 100) if lp else 0
    return json.dumps({
        "sku": doc.get("sku"),
        "principal": doc.get("principal"),
        "description": doc.get("description", ""),
        "currency": doc.get("currency", "USD"),
        "list_price": lp,
        "cost": cost,
        "margin": round(margin, 2),
        "margin_pct": round(margin_pct, 1),
    })
