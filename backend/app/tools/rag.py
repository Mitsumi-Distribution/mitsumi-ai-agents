import json

from langchain_core.tools import tool

from app.core.mongo import mongo_db
from app.core.tool_cache import get_cached, set_cached


@tool
async def rag_search(query: str) -> str:
    """Search Mitsumi internal knowledge base for policies, playbooks, runbooks, SLA terms,
    pricing rules, rebate info, shipping procedures, and deal registration rules.
    Returns matching documents from the company knowledge base."""
    cached = await get_cached("rag_search", {"query": query})
    if cached:
        return cached
    q = (query or "").strip()
    if not q:
        return json.dumps({"query": query, "results": [], "note": "Empty query — no results."})
    cursor = mongo_db["knowledge_base"].find(
        {"text": {"$regex": q, "$options": "i"}},
        {"_id": 0},
    ).limit(5)
    rows = await cursor.to_list(length=5)
    if not rows:
        cursor = mongo_db["knowledge_base"].find({}, {"_id": 0}).limit(5)
        rows = await cursor.to_list(length=5)
    # Format results clearly so the LLM doesn't re-search
    formatted = []
    for r in rows:
        formatted.append({
            "source": r.get("source", "unknown"),
            "content": r.get("text", ""),
        })
    result = json.dumps({
        "query": query,
        "total_results": len(formatted),
        "results": formatted,
        "note": f"Found {len(formatted)} document(s). Use this information to answer the user's question directly."
    }, default=str)
    await set_cached("rag_search", {"query": query}, result, ttl=600)
    return result
