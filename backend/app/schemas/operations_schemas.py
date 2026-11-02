"""
RestroIQ 3.0 — Operations Schemas
Defines request and response schemas for Phase 4:
- Restaurant Analytics
- Inventory Preparation & Buffer Planning
- Menu Intelligence & Lifecycle Management
- Extended Branch Management
- Restaurant Profile & Team RBAC Management
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, field_validator


# ==============================================================================
# 1. RESTAURANT ANALYTICS SCHEMAS
# ==============================================================================

class AnalyticsTimelinePoint(BaseModel):
    date: str
    revenue: float
    orders: int
    units_sold: float


class CategorySalesItem(BaseModel):
    category: str
    revenue: float
    quantity: float
    percentage: float


class TopSellingItem(BaseModel):
    item_name: str
    category: str
    quantity: float
    revenue: float
    average_unit_price: float


class SlowMovingItem(BaseModel):
    item_name: str
    category: str
    quantity: float
    revenue: float
    days_since_last_sale: int


class BranchComparisonItem(BaseModel):
    branch_id: str
    branch_name: str
    city: str
    total_revenue: float
    total_orders: int
    average_order_value: float


class DayOfWeekDistribution(BaseModel):
    day_name: str
    day_index: int  # 0 = Monday, 6 = Sunday
    orders: int
    revenue: float


class PromotionAnalysis(BaseModel):
    has_promotions: bool
    promo_orders_count: int
    promo_revenue: float
    regular_orders_count: int
    regular_revenue: float
    promo_aov: float
    regular_aov: float
    promo_share_pct: float


class ModelAccuracySummary(BaseModel):
    model_name: str
    baseline_name: str
    test_mae: Optional[float] = None
    test_rmse: Optional[float] = None
    test_wape: Optional[float] = None
    sufficiency_verdict: str
    evaluation_window: Optional[str] = None


class TenantAnalyticsResponse(BaseModel):
    restaurant_id: str
    branch_id: Optional[str] = None
    currency: str = "INR"
    currency_symbol: str = "₹"
    total_revenue: float
    total_orders: int
    average_order_value: float
    total_units_sold: float
    timeline: List[AnalyticsTimelinePoint] = []
    category_distribution: List[CategorySalesItem] = []
    top_selling_items: List[TopSellingItem] = []
    slow_moving_items: List[SlowMovingItem] = []
    branch_comparison: List[BranchComparisonItem] = []
    day_of_week_distribution: List[DayOfWeekDistribution] = []
    promotion_analysis: PromotionAnalysis
    model_accuracy: Optional[ModelAccuracySummary] = None
    data_sufficiency: str = "adequate"


# ==============================================================================
# 2. INVENTORY PREPARATION & BUFFER SCHEMAS
# ==============================================================================

class InventoryPrepItem(BaseModel):
    item_name: str
    category: str
    predicted_units: float
    prep_0pct: int
    prep_10pct: int
    prep_15pct: int
    prep_20pct: int
    demand_tier: str  # "high", "normal", "low"
    historical_daily_avg: float = 0.0


class ForecastVsActualPoint(BaseModel):
    date: str
    item_name: str
    category: str
    forecasted: float
    actual: float
    variance: float
    variance_pct: float


class PrepTargetsSummary(BaseModel):
    prep_0: int
    prep_10: int
    prep_15: int
    prep_20: int


class TenantInventoryResponse(BaseModel):
    restaurant_id: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    forecast_run_id: Optional[str] = None
    frequency: str = "daily"
    forecast_start_date: Optional[str] = None
    forecast_end_date: Optional[str] = None
    default_buffer: int = 10
    total_predicted_units: float = 0.0
    prep_targets_summary: PrepTargetsSummary
    items: List[InventoryPrepItem] = []
    forecast_vs_actual: List[ForecastVsActualPoint] = []
    inventory_tracking_disclaimer: str = (
        "Physical on-hand warehouse stock balances and waste tracking require active ERP inventory sync. "
        "Showing predictive kitchen batch preparation requirements based on machine learning demand forecasts."
    )


# ==============================================================================
# 3. MENU INTELLIGENCE & MANAGEMENT SCHEMAS
# ==============================================================================

class MenuItemDetail(BaseModel):
    id: Optional[str] = None
    item_name: str
    category: str
    sku: Optional[str] = None
    price: Optional[float] = None
    introduced_date: Optional[str] = None
    discontinued_date: Optional[str] = None
    total_historical_sales: float = 0.0
    total_historical_revenue: float = 0.0
    velocity_rank: str = "steady"  # "high", "steady", "slow"
    latest_forecast_daily: Optional[float] = None
    is_active: bool = True


class MenuItemCreate(BaseModel):
    item_name: str
    category: str = "General"
    sku: Optional[str] = None
    price: Optional[float] = None
    introduced_date: Optional[str] = None


class MenuItemUpdate(BaseModel):
    category: Optional[str] = None
    sku: Optional[str] = None
    price: Optional[float] = None
    introduced_date: Optional[str] = None
    discontinued_date: Optional[str] = None
    is_active: Optional[bool] = None


class TenantMenuResponse(BaseModel):
    restaurant_id: str
    categories: List[str] = []
    total_items: int = 0
    items: List[MenuItemDetail] = []


# ==============================================================================
# 4. EXTENDED BRANCH SCHEMAS
# ==============================================================================

class BranchDetailResponse(BaseModel):
    id: str
    restaurant_id: str
    branch_code: str
    branch_name: str
    city: str
    state: Optional[str] = None
    is_active: bool = True
    is_primary: bool = False
    operating_days: str = "mon,tue,wed,thu,fri,sat,sun"
    total_orders: int = 0
    total_revenue: float = 0.0
    closures_count: int = 0
    created_at: Optional[str] = None


class BranchUpdate(BaseModel):
    branch_name: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    is_active: Optional[bool] = None
    is_primary: Optional[bool] = None
    operating_days: Optional[str] = None


# ==============================================================================
# 5. RESTAURANT PROFILE & TEAM MANAGEMENT SCHEMAS
# ==============================================================================

class RestaurantProfileUpdate(BaseModel):
    name: Optional[str] = None
    cuisine: Optional[str] = None
    currency: Optional[str] = None
    timezone: Optional[str] = None
    operational_model: Optional[str] = None


class MemberRoleUpdate(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        r = v.lower().strip()
        if r not in ("owner", "admin", "analyst"):
            raise ValueError("Role must be 'owner', 'admin', or 'analyst'")
        return r

