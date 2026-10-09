from pydantic import BaseModel
from typing import List, Optional, Any, Dict

class HealthCheck(BaseModel):
    status: str

class ForecastSummary(BaseModel):
    week: int
    total_predicted_orders: float
    average_predicted_orders: float
    highest_demand_category: str
    highest_demand_city: str

class InventoryRecommendation(BaseModel):
    week: int
    center_id: int
    meal_id: int
    predicted_orders: float
    prep_0pct: float
    prep_10pct: float
    prep_15pct: float
    prep_20pct: float
    potential_surplus_10pct: float
    potential_surplus_15pct: float
    potential_surplus_20pct: float

class CenterInfo(BaseModel):
    center_id: int
    city_code: int
    region_code: int
    center_type: str
    op_area: float
    simulated_city: str
    state: str
    latitude: float
    longitude: float

class MealInfo(BaseModel):
    meal_id: int
    category: str
    cuisine: str

class HistorySummary(BaseModel):
    week: int
    total_orders: float
    average_orders: float

