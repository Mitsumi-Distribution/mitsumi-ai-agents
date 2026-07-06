"""Document interaction tool — searches uploaded files in the current chat.

Uses a context var instead of a module global so concurrent WS connections
don't clash.
"""

import json
import contextvars
from langchain_core.tools import tool

# Per-request chat_id set by the WS handler before each agent run
_chat_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("doc_chat_id", default="")


def set_current_chat_id(chat_id: str) -> None:
    _chat_id_var.set(chat_id)


@tool
async def document_search(query: str) -> str:
    """Search through documents uploaded to this conversation. Use this when the user
    asks about content from their uploaded files, mentions a document, or says
    'summarize this document', 'what does the file say', etc."""
    from app.core.documents import search_documents, list_documents
    chat_id = _chat_id_var.get("")
    if not chat_id:
        return json.dumps({"error": "No chat context", "results": []})

    # If query is generic (summarize, document, file), get all doc content
    generic_terms = {"document", "file", "upload", "summarize", "summary", "attached", "this"}
    q_lower = query.lower().strip()
    is_generic = any(t in q_lower for t in generic_terms) or len(q_lower) < 10

    if is_generic:
        # Return first chunks of ALL uploaded docs
        docs = await list_documents(chat_id)
        if not docs:
            return json.dumps({"query": query, "results": [], "note": "No documents uploaded to this conversation."})
        from app.core.mongo import mongo_db
        all_chunks = []
        for doc in docs:
            full = await mongo_db["chat_documents"].find_one(
                {"chat_id": chat_id, "filename": doc["filename"]},
                {"_id": 0, "filename": 1, "chunks": 1}
            )
            if full and full.get("chunks"):
                for i, chunk in enumerate(full["chunks"]):
                    all_chunks.append({
                        "filename": full["filename"],
                        "chunk_index": i,
                        "text": chunk,
                    })
        return json.dumps({
            "query": query,
            "total_results": len(all_chunks),
            "results": all_chunks[:10],  # cap at 10 chunks
            "note": f"Returning all content from {len(docs)} uploaded document(s). Summarize or analyze as requested."
        }, default=str)

    # Specific query — search by text match
    results = await search_documents(chat_id, query, top_k=5)
    return json.dumps({
        "query": query,
        "total_results": len(results),
        "results": results,
        "note": f"Found {len(results)} matching chunk(s)." if results else "No matching content."
    }, default=str)
