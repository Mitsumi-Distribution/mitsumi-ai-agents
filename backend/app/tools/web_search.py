import json

from langchain_core.tools import tool

from app.core.config import settings


@tool
async def web_search(query: str) -> str:
    """Search public web for Mitsumi-relevant market intelligence, competitor info, product specs, or industry news."""
    if not settings.TAVILY_API_KEY:
        return json.dumps({"query": query, "error": "Tavily API key not configured", "results": []})
    try:
        from tavily import AsyncTavilyClient
        client = AsyncTavilyClient(api_key=settings.TAVILY_API_KEY)
        response = await client.search(
            query=f"Mitsumi Distribution East Africa {query}",
            max_results=5,
            search_depth="basic",
        )
        results = [
            {"title": r.get("title", ""), "url": r.get("url", ""), "snippet": r.get("content", "")[:300]}
            for r in response.get("results", [])
        ]
        return json.dumps({"query": query, "provider": "tavily", "results": results})
    except Exception as exc:
        return json.dumps({"query": query, "error": str(exc), "results": []})
