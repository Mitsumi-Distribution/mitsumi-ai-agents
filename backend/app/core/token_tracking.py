"""Token usage tracking per department and model.

Stores per-call token counts in a `token_usage` MongoDB collection
and provides aggregation queries for the dashboard.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.core.mongo import mongo_db

COLLECTION = "token_usage"


async def record_usage(
    *,
    department: str,
    model_key: str,
    model_id: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    user_email: str = "",
    chat_id: str = "",
) -> None:
    """Record a single LLM call's token usage. Best-effort — never raises."""
    try:
        await mongo_db[COLLECTION].insert_one({
            "department": department,
            "model_key": model_key,
            "model_id": model_id,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": input_tokens + output_tokens,
            "user_email": user_email,
            "chat_id": chat_id,
            "created_at": datetime.now(timezone.utc),
        })
    except Exception:
        pass


async def get_usage_summary(days: int = 30) -> dict[str, Any]:
    """Aggregate token usage by department and model over the last N days."""
    from datetime import timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    pipeline = [
        {"$match": {"created_at": {"$gte": cutoff}}},
        {"$group": {
            "_id": {"department": "$department", "model_key": "$model_key"},
            "calls": {"$sum": 1},
            "input_tokens": {"$sum": "$input_tokens"},
            "output_tokens": {"$sum": "$output_tokens"},
            "total_tokens": {"$sum": "$total_tokens"},
        }},
        {"$sort": {"total_tokens": -1}},
    ]
    rows = await mongo_db[COLLECTION].aggregate(pipeline).to_list(length=50)
    total_input = sum(r["input_tokens"] for r in rows)
    total_output = sum(r["output_tokens"] for r in rows)
    return {
        "period_days": days,
        "total_calls": sum(r["calls"] for r in rows),
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_tokens": total_input + total_output,
        "by_department_model": [
            {
                "department": r["_id"]["department"],
                "model": r["_id"]["model_key"],
                "calls": r["calls"],
                "input_tokens": r["input_tokens"],
                "output_tokens": r["output_tokens"],
                "total_tokens": r["total_tokens"],
            }
            for r in rows
        ],
    }


async def ensure_indexes() -> None:
    try:
        await mongo_db[COLLECTION].create_index("created_at")
        await mongo_db[COLLECTION].create_index([("department", 1), ("model_key", 1)])
    except Exception:
        pass
