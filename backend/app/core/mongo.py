from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings
from app.core.security import hash_password, normalize_email
from app.core.seed_mitsumi import seed_mitsumi

mongo_client = AsyncIOMotorClient(settings.MONGODB_URL)
mongo_db: AsyncIOMotorDatabase = mongo_client[settings.MONGODB_DB]

# Full capability set exposed to the super_admin role. Add new modules here as they land.
ALL_MODULES = [
    "dashboard",
    "tasks",
    "tool_results",
    "agent:sales",
    "agent:marketing",
    "agent:finance",
    "agent:ops",
    "department:sales",
    "department:marketing",
    "department:finance",
    "department:ops",
    "settings",
    "settings:regions",
    "settings:roles",
    "settings:users",
    "preferences",
    "user_management",
    "billing",
    "audit_logs",
]


async def seed_mongo() -> None:
    users = mongo_db["users"]
    chats = mongo_db["chats"]
    messages = mongo_db["messages"]
    auth_otps = mongo_db["auth_otps"]
    reset_tokens = mongo_db["reset_tokens"]

    await users.create_index("email", unique=True)
    await chats.create_index([("user_id", 1), ("agent_name", 1), ("is_deleted", 1), ("pinned", -1), ("updated_at", -1)])
    await messages.create_index([("chat_id", 1), ("created_at", 1)])
    await auth_otps.create_index("email")
    await auth_otps.create_index("purpose")
    await auth_otps.create_index("expires_at", expireAfterSeconds=0)
    await reset_tokens.create_index("email")
    await reset_tokens.create_index("expires_at", expireAfterSeconds=0)

    await _upsert_superadmin(users)

    # Full Mitsumi demo catalogue: customers, principals, leads, quotes, orders,
    # inventory, pricing, invoices, campaigns, tickets, shipments, knowledge base.
    # Idempotent per-collection, safe to re-run on every boot.
    await seed_mitsumi(mongo_db)


async def _upsert_superadmin(users) -> None:
    email = normalize_email(settings.SUPERADMIN_EMAIL)
    update = {
        "$set": {
            "email": email,
            "name": settings.SUPERADMIN_NAME,
            "roles": ["super_admin"],
            "modules": ALL_MODULES,
            "is_super_admin": True,
        },
        "$setOnInsert": {
            "password_hash": hash_password(settings.SUPERADMIN_PASSWORD),
        },
    }
    await users.update_one({"email": email}, update, upsert=True)


def user_has_module(user: dict, module: str) -> bool:
    if user.get("is_super_admin"):
        return True
    modules = user.get("modules") or []
    return module in modules
