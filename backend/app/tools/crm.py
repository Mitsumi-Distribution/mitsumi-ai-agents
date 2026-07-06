import json

from langchain_core.tools import tool

from app.core.mongo import mongo_db
from app.core.tool_cache import get_cached, set_cached


@tool
async def crm_search(query: str) -> str:
    """Search CRM for contacts, leads, or pipeline records."""
    cached = await get_cached("crm_search", {"query": query})
    if cached:
        return cached
    regex = {"$regex": query, "$options": "i"}
    cursor = mongo_db["crm_leads"].find(
        {"$or": [{"customer_name": regex}, {"principal": regex}, {"stage": regex}]},
        {"_id": 0},
    ).sort("lead_id", -1).limit(10)
    rows = await cursor.to_list(length=10)
    result = json.dumps({"query": query, "rows": rows}, default=str)
    await set_cached("crm_search", {"query": query}, result)
    return result


@tool
async def crm_update(lead_id: int, status: str, notes: str) -> str:
    """Update a lead status in CRM."""
    result = await mongo_db["crm_leads"].update_one({"lead_id": lead_id}, {"$set": {"stage": status, "notes": notes}})
    lead = await mongo_db["crm_leads"].find_one({"lead_id": lead_id}, {"_id": 0})
    return json.dumps({"updated": result.modified_count > 0, "lead": lead}, default=str)
