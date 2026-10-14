from typing import Optional, List, Any, Dict
from fastapi import APIRouter, HTTPException, Query
from app.schemas import data_schemas
from app.services.data_service import data_service

router = APIRouter()

def _as_int(val, default=None):
    return val if isinstance(val, int) else default

def _as_str(val, default=None):
    return val if isinstance(val, str) else default

@router.get("/health", response_model=data_schemas.HealthCheck)
def health_check():
    return {"status": "ok"}

@router.get("/history", response_model=List[data_schemas.HistorySummary])
def get_history():
    try:
        return data_service.get_history_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/summary", response_model=List[data_schemas.ForecastSummary])
def get_summary():
    try:
        return data_service.get_forecast_summary()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/inventory", response_model=List[data_schemas.InventoryRecommendation])
def get_inventory(
    week: Optional[int] = Query(None, description="Filter by week (e.g. 146)"),
    center_id: Optional[int] = Query(None, description="Filter by center ID"),
    category: Optional[str] = Query(None, description="Filter by meal category"),
    limit: int = Query(5000, ge=1, le=50000, description="Maximum records to return"),
    skip: int = Query(0, ge=0, description="Records to skip for pagination")
):
    try:
        return data_service.get_inventory(
            week=_as_int(week),
            center_id=_as_int(center_id),
            category=_as_str(category),
            limit=_as_int(limit, 5000),
            skip=_as_int(skip, 0)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/forecasts/detailed")
def get_detailed_forecasts(
    week: Optional[int] = Query(None, description="Filter by week (146-155)"),
    center_id: Optional[int] = Query(None, description="Filter by center ID"),
    meal_id: Optional[int] = Query(None, description="Filter by meal ID"),
    city: Optional[str] = Query(None, description="Filter by simulated city"),
    category: Optional[str] = Query(None, description="Filter by category"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine"),
    limit: int = Query(1000, ge=1, le=50000, description="Maximum records to return"),
    skip: int = Query(0, ge=0, description="Records to skip for pagination")
):
    try:
        return data_service.get_detailed_forecasts(
            week=_as_int(week),
            center_id=_as_int(center_id),
            meal_id=_as_int(meal_id),
            city=_as_str(city),
            category=_as_str(category),
            cuisine=_as_str(cuisine),
            limit=_as_int(limit, 1000),
            skip=_as_int(skip, 0)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/centers", response_model=List[data_schemas.CenterInfo])
def get_centers():
    try:
        return data_service.get_centers()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/meals", response_model=List[data_schemas.MealInfo])
def get_meals():
    try:
        return data_service.get_meals()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics")
def get_analytics(
    start_week: Optional[int] = Query(None),
    end_week: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    center_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    cuisine: Optional[str] = Query(None)
):
    try:
        return data_service.get_analytics(
            start_week=_as_int(start_week),
            end_week=_as_int(end_week),
            city=_as_str(city),
            center_id=_as_int(center_id),
            category=_as_str(category),
            cuisine=_as_str(cuisine)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/centers/analysis")
def get_centers_analysis():
    try:
        return data_service.get_centers_analysis()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/meals/analysis")
def get_meals_analysis(
    week: Optional[int] = Query(None),
    city: Optional[str] = Query(None),
    center_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    cuisine: Optional[str] = Query(None)
):
    try:
        return data_service.get_meals_analysis(
            week=_as_int(week),
            city=_as_str(city),
            center_id=_as_int(center_id),
            category=_as_str(category),
            cuisine=_as_str(cuisine)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
