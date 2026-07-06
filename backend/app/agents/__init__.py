from app.agents.finance import FinanceAgent
from app.agents.marketing import MarketingAgent
from app.agents.ops import OpsAgent
from app.agents.sales import SalesAgent

AGENT_REGISTRY = {
    "sales": SalesAgent,
    "marketing": MarketingAgent,
    "finance": FinanceAgent,
    "ops": OpsAgent,
}
