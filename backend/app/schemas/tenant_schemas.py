from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime

class UserProfile(BaseModel):
    id: str
    email: str
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None

class RestaurantCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Restaurant / organization name")
    currency: str = Field("INR", max_length=10, description="ISO currency code")
    timezone: str = Field("Asia/Kolkata", max_length=50, description="Operating timezone")
    operational_model: str = Field("dine_in_and_delivery", description="Operating format")

class RestaurantResponse(BaseModel):
    id: str
    name: str
    slug: str
    currency: str = "INR"
    currency_symbol: str = "₹"
    timezone: str = "Asia/Kolkata"
    operational_model: str = "dine_in_and_delivery"
    user_role: Optional[str] = None
    created_at: Optional[str] = None

class BranchCreate(BaseModel):
    branch_code: str = Field(..., min_length=1, max_length=50, description="Unique identifier for branch (e.g. IND-01)")
    branch_name: str = Field(..., min_length=2, max_length=150, description="Branch display name")
    city: str = Field(..., min_length=2, max_length=100)
    state: Optional[str] = None
    is_primary: bool = False

class BranchResponse(BaseModel):
    id: str
    restaurant_id: str
    branch_code: str
    branch_name: str
    city: str
    state: Optional[str] = None
    is_active: bool = True
    is_primary: bool = False
    operating_days: str = "mon,tue,wed,thu,fri,sat,sun"
    created_at: Optional[str] = None

class MemberInvite(BaseModel):
    email: str
    role: str = Field("analyst", description="Role: 'admin' or 'analyst'")

class MemberResponse(BaseModel):
    id: str
    restaurant_id: str
    user_id: str
    email: Optional[str] = None
    full_name: Optional[str] = None
    role: str
    created_at: Optional[str] = None

class RestaurantSettingsResponse(BaseModel):
    restaurant_id: str
    default_prep_buffer: int = 10
    default_forecasting_frequency: str = "daily"
    auto_forecast_on_upload: bool = True
    updated_at: Optional[str] = None

class RestaurantSettingsUpdate(BaseModel):
    default_prep_buffer: Optional[int] = Field(None, description="0, 10, 15, or 20")
    default_forecasting_frequency: Optional[str] = Field(None, description="'daily' or 'weekly'")
    auto_forecast_on_upload: Optional[bool] = None

class TenantContext(BaseModel):
    user_id: str
    email: str
    restaurant_id: str
    role: str
    raw_jwt: Optional[str] = None

