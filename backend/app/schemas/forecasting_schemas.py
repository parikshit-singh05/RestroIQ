"""
RestroIQ 3.0 — Forecasting Schemas
Defines request and response models for the Dynamic Multi-Model Forecasting Engine.
"""

from typing import Optional, List, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator
from datetime import date, datetime


class ForecastGenerationRequest(BaseModel):
    branch_id: Optional[str] = Field(None, description="Optional branch UUID. If omitted, uses default/primary branch.")
    frequency: str = Field("daily", description="Forecasting frequency: 'daily' or 'weekly'.")
    horizon_steps: Optional[int] = Field(None, description="Number of steps (days or weeks) to forecast.")
    menu_item_ids: Optional[List[str]] = Field(None, description="Optional list of specific menu items to forecast.")
    force_baseline: bool = Field(False, description="If true, forces Moving Average/Seasonal Naive baseline.")

    @field_validator("frequency")
    @classmethod
    def validate_frequency(cls, v: str) -> str:
        freq = v.lower().strip()
        if freq not in ("daily", "weekly"):
            raise ValueError("Frequency must be 'daily' or 'weekly'")
        return freq

    @field_validator("horizon_steps")
    @classmethod
    def validate_horizon(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 90):
            raise ValueError("horizon_steps must be between 1 and 90")
        return v


class ForecastJobResponse(BaseModel):
    job_id: str
    restaurant_id: str
    branch_id: Optional[str] = None
    frequency: str = "daily"
    horizon_steps: int = 14
    status: str = "completed"
    error_details: Optional[Dict[str, Any]] = None
    created_at: str


class ModelEvaluationSchema(BaseModel):
    model_name: str
    baseline_name: str
    test_mae: Optional[float] = None
    test_rmse: Optional[float] = None
    test_wape: Optional[float] = None
    baseline_mae: Optional[float] = None
    baseline_wape: Optional[float] = None
    sufficiency_verdict: str = Field("adequate", description="'adequate', 'marginal', or 'insufficient'")
    training_sample_count: int = 0
    training_start_date: Optional[str] = None
    training_end_date: Optional[str] = None
    evaluation_start_date: Optional[str] = None
    evaluation_end_date: Optional[str] = None
    comparison_summary: Optional[str] = None


class ForecastItemPrediction(BaseModel):
    item_name: str
    category: str = "General"
    forecast_date: str
    predicted_orders: float
    prep_0pct: int
    prep_10pct: int
    prep_15pct: int
    prep_20pct: int
    model_type: str


class DataSufficiencyInfo(BaseModel):
    verdict: str = Field("adequate", description="'adequate', 'marginal', or 'insufficient'")
    history_days: int = 0
    history_weeks: int = 0
    distinct_dates_count: int = 0
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    min_required_days: int = 14
    min_required_weeks: int = 4
    warning_message: Optional[str] = None
    is_sufficient: bool = True


class ForecastRunSummary(BaseModel):
    run_id: str
    forecast_job_id: Optional[str] = None
    restaurant_id: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    model_type: str
    frequency: str
    start_date: str
    end_date: str
    total_predicted_orders: float
    unique_items_count: int
    created_at: str
    evaluation: Optional[ModelEvaluationSchema] = None
    data_sufficiency: DataSufficiencyInfo


class ForecastResultsQueryResponse(BaseModel):
    run_id: str
    restaurant_id: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    frequency: str
    start_date: str
    end_date: str
    model_type: str
    default_buffer: int = 10
    evaluation: Optional[ModelEvaluationSchema] = None
    data_sufficiency: DataSufficiencyInfo
    historical_series: List[Dict[str, Any]] = []
    forecast_series: List[ForecastItemPrediction] = []
    aggregated_timeline: List[Dict[str, Any]] = []
    category_breakdown: Dict[str, float] = {}


class TenantSettingsSchema(BaseModel):
    restaurant_id: str
    default_prep_buffer: int = 10
    default_forecasting_frequency: str = "daily"
    auto_forecast_on_upload: bool = True
    timezone: str = "Asia/Kolkata"
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class UpdateTenantSettingsRequest(BaseModel):
    default_prep_buffer: Optional[int] = Field(None, description="0, 10, 15, or 20")
    default_forecasting_frequency: Optional[str] = Field(None, description="'daily' or 'weekly'")
    auto_forecast_on_upload: Optional[bool] = None
    timezone: Optional[str] = None

    @field_validator("default_prep_buffer")
    @classmethod
    def validate_buffer(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v not in (0, 10, 15, 20):
            raise ValueError("default_prep_buffer must be 0, 10, 15, or 20")
        return v

    @field_validator("default_forecasting_frequency")
    @classmethod
    def validate_frequency(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v.lower() not in ("daily", "weekly"):
            raise ValueError("default_forecasting_frequency must be 'daily' or 'weekly'")
        return v.lower() if v else None


class BranchClosureCreate(BaseModel):
    closure_date: str
    reason: Optional[str] = "Holiday/Maintenance"


class BranchClosureSchema(BaseModel):
    id: str
    restaurant_id: str
    branch_id: str
    closure_date: str
    reason: str
    created_at: str

