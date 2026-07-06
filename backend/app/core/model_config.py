"""Bedrock model catalogue and per-department model configuration.

Keeps a single source of truth for which Claude models are available,
their capabilities and cost tier. The `model_config` MongoDB collection
stores per-department overrides (otherwise `DEFAULT_MODEL` is used).
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
from app.core.mongo import mongo_db

# ── Model catalogue (Claude on Bedrock only) ────────────────────────────
MODELS = {
    "haiku": {
        "id": "eu.anthropic.claude-haiku-4-5-20251001-v1:0",
        "name": "Claude Haiku 4.5",
        "tier": "fast",
        "description": "Ultra-fast responses, lowest cost. Great for simple lookups and quick answers.",
        "input_cost_per_1m": 0.80,
        "output_cost_per_1m": 4.00,
        "max_tokens": 4096,
        "supports_tools": True,
    },
    "sonnet": {
        "id": "eu.anthropic.claude-sonnet-4-6",
        "name": "Claude Sonnet 4.6",
        "tier": "balanced",
        "description": "Best balance of speed, quality and cost. Recommended for most tasks.",
        "input_cost_per_1m": 3.00,
        "output_cost_per_1m": 15.00,
        "max_tokens": 8192,
        "supports_tools": True,
    },
    "opus": {
        "id": "eu.anthropic.claude-opus-4-7",
        "name": "Claude Opus 4.7",
        "tier": "powerful",
        "description": "Most capable. Deep reasoning, complex analysis, multi-step planning.",
        "input_cost_per_1m": 15.00,
        "output_cost_per_1m": 75.00,
        "max_tokens": 8192,
        "supports_tools": True,
    },
}

DEFAULT_MODEL = "haiku"

DEPARTMENT_DEFAULTS = {
    "sales": "haiku",
    "marketing": "haiku",
    "finance": "haiku",
    "ops": "haiku",
}

# ── Runtime cache (refreshed on PATCH) ──────────────────────────────────
_config_cache: dict[str, str] = {}


async def _load_config() -> dict[str, str]:
    """Load per-department model overrides from Mongo."""
    global _config_cache
    doc = await mongo_db["model_config"].find_one({"_id": "departments"})
    if doc:
        _config_cache = {k: v for k, v in doc.items() if k != "_id" and k != "updated_at"}
    else:
        _config_cache = {}
    return _config_cache


async def get_department_model(department: str) -> dict:
    """Return the resolved model spec for a department."""
    if not _config_cache:
        await _load_config()
    key = _config_cache.get(department, DEPARTMENT_DEFAULTS.get(department, DEFAULT_MODEL))
    if key not in MODELS:
        key = DEFAULT_MODEL
    return {"key": key, **MODELS[key]}


async def get_all_department_models() -> dict:
    """Return the model assignment for every department + the catalogue."""
    if not _config_cache:
        await _load_config()
    assignments = {}
    for dept in ["sales", "marketing", "finance", "ops"]:
        key = _config_cache.get(dept, DEPARTMENT_DEFAULTS.get(dept, DEFAULT_MODEL))
        if key not in MODELS:
            key = DEFAULT_MODEL
        assignments[dept] = key
    return {
        "catalogue": {k: v for k, v in MODELS.items()},
        "assignments": assignments,
        "default": DEFAULT_MODEL,
    }


async def set_department_model(department: str, model_key: str) -> dict:
    """Set the model for a department. Returns the updated assignments."""
    if model_key not in MODELS:
        raise ValueError(f"Unknown model key: {model_key}. Choose from: {list(MODELS.keys())}")
    if department not in ("sales", "marketing", "finance", "ops"):
        raise ValueError(f"Unknown department: {department}")
    await mongo_db["model_config"].update_one(
        {"_id": "departments"},
        {"$set": {department: model_key, "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    await _load_config()
    return await get_all_department_models()


def get_bedrock_model_id(model_key: str) -> str:
    """Resolve a model key (haiku/sonnet/opus) to a Bedrock model ID."""
    spec = MODELS.get(model_key)
    if not spec:
        return MODELS[DEFAULT_MODEL]["id"]
    return spec["id"]


def get_max_tokens(model_key: str) -> int:
    spec = MODELS.get(model_key)
    if not spec:
        return MODELS[DEFAULT_MODEL]["max_tokens"]
    return spec["max_tokens"]
