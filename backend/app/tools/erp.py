import json

from langchain_core.tools import tool

from app.core.mongo import mongo_db


@tool
async def erp_query(query: str) -> str:
    """Query ERP inventory or purchase order data."""
    regex = {"$regex": query, "$options": "i"}
    cursor = mongo_db["erp_inventory"].find(
        {"$or": [{"sku": regex}, {"product_name": regex}, {"warehouse": regex}]},
        {"_id": 0},
    ).sort("quantity", -1).limit(10)
    rows = await cursor.to_list(length=10)
    return json.dumps({"query": query, "rows": rows}, default=str)
