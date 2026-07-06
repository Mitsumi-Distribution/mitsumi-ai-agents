"""Region + country scope rules.

Region / country master data is now stored in Mongo (`app_regions`) and
cached in `app.core.regions_db._CACHE`. See `seed_and_refresh()` in that
module — it runs at app startup and repopulates the cache.

For backwards compatibility this module re-exports the same names the rest
of the codebase used to import:
    REGIONS, ALL_REGIONS, ALL_COUNTRIES, COUNTRY_TO_REGION, region_for_country

These now read from the live cache (so CRUD mutations are immediately
reflected).

Role hierarchy (highest first):
    super_admin     -> all regions, all countries
    regional_head   -> one region, all countries in it
    regional_admin  -> one region, all countries in it
    country_admin   -> one country
    member          -> one country (read-mostly)
"""

from __future__ import annotations

from app.core import regions_db as _rdb


class _RegionsProxy:
    """Dict-like proxy onto `regions_db.regions_map()` so callers can still
    do `REGIONS["africa"]` or `for k, v in REGIONS.items()`."""

    def __getitem__(self, key: str) -> list[dict]:
        return _rdb.regions_map()[key]

    def get(self, key: str, default=None):
        return _rdb.regions_map().get(key, default)

    def keys(self):
        return _rdb.regions_map().keys()

    def values(self):
        return _rdb.regions_map().values()

    def items(self):
        return _rdb.regions_map().items()

    def __iter__(self):
        return iter(_rdb.regions_map())

    def __contains__(self, key: str) -> bool:
        return key in _rdb.regions_map()


REGIONS = _RegionsProxy()


def _all_regions() -> list[str]:
    return _rdb.all_region_keys()


def _all_countries() -> list[str]:
    return _rdb.all_country_codes()


def _country_to_region() -> dict[str, str]:
    return _rdb.country_to_region()


# Expose lazy properties at module level via a small descriptor-free shim:
# Python modules don't support attribute getters directly, so callers should
# prefer the functions. We still keep the old name accessible as a list (it
# captures a snapshot, so refresh once on first access is fine here).

class _ListProxy(list):
    def __init__(self, source):
        super().__init__()
        self._source = source

    def __iter__(self):
        return iter(self._source())

    def __contains__(self, value):
        return value in self._source()

    def __len__(self):
        return len(self._source())

    def __getitem__(self, index):
        return self._source()[index]


ALL_REGIONS = _ListProxy(_all_regions)
ALL_COUNTRIES = _ListProxy(_all_countries)


class _DictProxy(dict):
    def __init__(self, source):
        super().__init__()
        self._source = source

    def __iter__(self):
        return iter(self._source())

    def __contains__(self, value):
        return value in self._source()

    def __len__(self):
        return len(self._source())

    def __getitem__(self, key):
        return self._source()[key]

    def get(self, key, default=None):
        return self._source().get(key, default)

    def items(self):
        return self._source().items()

    def keys(self):
        return self._source().keys()

    def values(self):
        return self._source().values()


COUNTRY_TO_REGION = _DictProxy(_country_to_region)


def region_for_country(country_code: str | None) -> str | None:
    return _rdb.region_for_country(country_code)


# ---------- Roles ---------------------------------------------------------

ROLES: list[dict] = [
    {
        "key": "super_admin",
        "label": "Super Admin",
        "scope": "global",
        "can_invite": ["super_admin", "regional_head", "regional_admin", "country_admin", "member"],
        "permissions": ["*"],
    },
    {
        "key": "regional_head",
        "label": "Regional Head",
        "scope": "region",
        "can_invite": ["regional_admin", "country_admin", "member"],
        "permissions": [
            "department:read",
            "department:export",
            "user:invite",
            "user:manage_region",
            "agent:chat",
            "task:create",
        ],
    },
    {
        "key": "regional_admin",
        "label": "Regional Admin",
        "scope": "region",
        "can_invite": ["country_admin", "member"],
        "permissions": [
            "department:read",
            "user:invite",
            "user:manage_region",
            "agent:chat",
            "task:create",
        ],
    },
    {
        "key": "country_admin",
        "label": "Country Admin",
        "scope": "country",
        "can_invite": ["member"],
        "permissions": [
            "department:read",
            "user:invite",
            "user:manage_country",
            "agent:chat",
            "task:create",
        ],
    },
    {
        "key": "member",
        "label": "Member",
        "scope": "country",
        "can_invite": [],
        "permissions": ["department:read", "agent:chat", "task:create"],
    },
]

ROLE_KEYS = {role["key"] for role in ROLES}
ADMIN_ROLES = {"super_admin", "regional_head", "regional_admin", "country_admin"}


def highest_role(roles: list[str] | None) -> str | None:
    if not roles:
        return None
    ranking = ["super_admin", "regional_head", "regional_admin", "country_admin", "member"]
    for r in ranking:
        if r in roles:
            return r
    return None


def can_invite(inviter_roles: list[str] | None, target_role: str) -> bool:
    inviter = highest_role(inviter_roles)
    if not inviter:
        return False
    role_def = next((r for r in ROLES if r["key"] == inviter), None)
    if not role_def:
        return False
    return target_role in role_def["can_invite"]


# ---------- Scope filter ---------------------------------------------------


def user_scope(user: dict) -> dict:
    """Return canonical scope info for a user document."""
    roles = user.get("roles") or []
    if user.get("is_super_admin") or "super_admin" in roles:
        return {"scope": "global", "region": None, "country": None, "roles": roles}
    if "regional_head" in roles or "regional_admin" in roles:
        return {"scope": "region", "region": user.get("region"), "country": None, "roles": roles}
    if "country_admin" in roles or "member" in roles:
        return {
            "scope": "country",
            "region": user.get("region") or region_for_country(user.get("country")),
            "country": user.get("country"),
            "roles": roles,
        }
    return {"scope": "global", "region": None, "country": None, "roles": roles}


def scope_filter(user: dict, *, region_override: str | None = None, country_override: str | None = None) -> dict:
    """Build the Mongo filter that enforces region/country scope for a user."""
    s = user_scope(user)
    filt: dict = {}

    if s["scope"] == "global":
        if country_override:
            filt["country"] = country_override.upper()
        elif region_override:
            filt["region"] = region_override.lower()
        return filt

    if s["scope"] == "region":
        filt["region"] = s["region"]
        if country_override and country_override.upper() in [
            c["code"] for c in _rdb.regions_map().get(s["region"] or "", [])
        ]:
            filt["country"] = country_override.upper()
        return filt

    if s["scope"] == "country":
        if s["country"]:
            filt["country"] = s["country"]
        elif s["region"]:
            filt["region"] = s["region"]
        return filt

    return filt
