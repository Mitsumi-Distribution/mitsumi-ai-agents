"""Dynamic regions + countries master — DB-backed with in-memory cache.

Replaces the static `REGIONS` dict in `scope.py`. The module seeds defaults
(Africa + UAE) on startup if the collection is empty, then maintains an
in-memory cache that `scope.py` reads from synchronously.

The cache is refreshed:
- On startup (via `seed_and_refresh`)
- After any CRUD mutation (via `refresh_cache`)
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from app.core.mongo import mongo_db

log = logging.getLogger("regions_db")

# ---- Default seed -----------------------------------------------------------
DEFAULT_REGIONS: list[dict[str, Any]] = [
    {
        "key": "africa",
        "label": "Africa",
        "countries": [
            {"code": "KE", "name": "Kenya"},
            {"code": "UG", "name": "Uganda"},
            {"code": "TZ", "name": "Tanzania"},
            {"code": "RW", "name": "Rwanda"},
            {"code": "ET", "name": "Ethiopia"},
            {"code": "SS", "name": "South Sudan"},
            {"code": "BI", "name": "Burundi"},
        ],
    },
    {
        "key": "uae",
        "label": "UAE",
        "countries": [
            {"code": "AE", "name": "United Arab Emirates"},
        ],
    },
]


# ---- In-memory cache (populated on startup) ---------------------------------
_CACHE: dict[str, Any] = {
    "regions": {},            # region_key -> [{"code","name"}, ...]
    "country_to_region": {},  # code -> region_key
    "updated_at": None,
}


def regions_map() -> dict[str, list[dict]]:
    return _CACHE["regions"]


def all_region_keys() -> list[str]:
    return list(_CACHE["regions"].keys())


def all_country_codes() -> list[str]:
    return list(_CACHE["country_to_region"].keys())


def country_to_region() -> dict[str, str]:
    return _CACHE["country_to_region"]


def region_for_country(code: str | None) -> str | None:
    if not code:
        return None
    return _CACHE["country_to_region"].get(code.upper())


# ---- CRUD -------------------------------------------------------------------


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_region(doc: dict) -> dict:
    return {
        "key": doc["key"],
        "label": doc.get("label") or doc["key"].title(),
        "countries": [
            {"code": c["code"].upper(), "name": c["name"]}
            for c in (doc.get("countries") or [])
        ],
    }


async def list_regions() -> list[dict]:
    cursor = mongo_db["app_regions"].find({}, {"_id": 0}).sort("label", 1)
    docs = await cursor.to_list(length=200)
    return [_normalize_region(d) for d in docs]


async def get_region(key: str) -> dict | None:
    doc = await mongo_db["app_regions"].find_one({"key": key}, {"_id": 0})
    return _normalize_region(doc) if doc else None


async def create_region(*, key: str, label: str, countries: list[dict] | None = None) -> dict:
    key = key.strip().lower()
    if not key:
        raise ValueError("Region key is required")
    existing = await mongo_db["app_regions"].find_one({"key": key})
    if existing:
        raise ValueError("Region already exists")
    doc = {
        "key": key,
        "label": label or key.title(),
        "countries": [{"code": c["code"].upper(), "name": c["name"]} for c in (countries or [])],
        "created_at": _now(),
        "updated_at": _now(),
    }
    await mongo_db["app_regions"].insert_one(doc)
    await refresh_cache()
    return _normalize_region(doc)


async def update_region(key: str, *, label: str | None = None, countries: list[dict] | None = None) -> dict | None:
    update: dict[str, Any] = {"updated_at": _now()}
    if label is not None:
        update["label"] = label
    if countries is not None:
        update["countries"] = [{"code": c["code"].upper(), "name": c["name"]} for c in countries]
    await mongo_db["app_regions"].update_one({"key": key}, {"$set": update})
    await refresh_cache()
    return await get_region(key)


async def delete_region(key: str, *, cascade: bool = False) -> dict:
    """Remove a region.

    When `cascade=False` (default) this is a plain delete. Users and domain
    records that point at the region are left untouched (they simply become
    orphaned from any region map).

    When `cascade=True` we also scrub the region from every domain collection
    (records with a matching region are deleted, since they were scoped to it
    and have no valid home any more). Users are *never* deleted — their
    `region` field is nulled instead so the account survives.

    Returns a dict:
        {
            "deleted": bool,
            "affected": {collection_name: count, ...},  # records deleted
            "users_nulled": int,
        }
    """
    result = await mongo_db["app_regions"].delete_one({"key": key})
    deleted = bool(result.deleted_count)
    affected: dict[str, int] = {}
    users_nulled = 0
    if deleted and cascade:
        scoped_collections = (
            "customers", "crm_leads", "sales_quotes", "sales_orders",
            "finance_invoices", "marketing_campaigns", "ops_tickets", "ops_shipments",
            "tasks", "agent_tasks",
        )
        for col in scoped_collections:
            res = await mongo_db[col].delete_many({"region": key})
            if res.deleted_count:
                affected[col] = res.deleted_count
        # Null region on users so accounts aren't lost.
        u_res = await mongo_db["users"].update_many(
            {"region": key}, {"$set": {"region": None, "country": None}}
        )
        users_nulled = u_res.modified_count
    await refresh_cache()
    return {"deleted": deleted, "affected": affected, "users_nulled": users_nulled}


async def add_country(region_key: str, *, code: str, name: str) -> dict | None:
    code = code.upper().strip()
    if not code or not name:
        raise ValueError("Country code and name are required")
    region = await get_region(region_key)
    if not region:
        raise ValueError("Region not found")
    if any(c["code"] == code for c in region["countries"]):
        raise ValueError("Country already in region")
    countries = region["countries"] + [{"code": code, "name": name}]
    return await update_region(region_key, countries=countries)


async def remove_country(region_key: str, *, code: str) -> dict | None:
    region = await get_region(region_key)
    if not region:
        raise ValueError("Region not found")
    countries = [c for c in region["countries"] if c["code"] != code.upper()]
    return await update_region(region_key, countries=countries)


# ---- Startup seed + cache ---------------------------------------------------


async def seed_and_refresh() -> None:
    try:
        count = await mongo_db["app_regions"].estimated_document_count()
        if count == 0:
            for r in DEFAULT_REGIONS:
                await mongo_db["app_regions"].insert_one(
                    {
                        "key": r["key"],
                        "label": r["label"],
                        "countries": [{"code": c["code"].upper(), "name": c["name"]} for c in r["countries"]],
                        "created_at": _now(),
                        "updated_at": _now(),
                    }
                )
            log.info("Seeded %d default regions", len(DEFAULT_REGIONS))
        await mongo_db["app_regions"].create_index("key", unique=True)
    except Exception as exc:  # pragma: no cover
        log.warning("region seed failed: %s", exc)
    await refresh_cache()


async def refresh_cache() -> None:
    regions = await list_regions()
    _CACHE["regions"] = {r["key"]: r["countries"] for r in regions}
    _CACHE["country_to_region"] = {
        c["code"]: r["key"] for r in regions for c in r["countries"]
    }
    _CACHE["updated_at"] = _now()
