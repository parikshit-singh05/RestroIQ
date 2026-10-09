from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from typing import List, Any, Dict
from app.schemas import data_schemas
from app.services.data_service import data_service

router = APIRouter()

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
def get_inventory(week: int = Query(None, description="Filter by week"), limit: int = Query(1000, ge=1, le=50000)):
    try:
        return data_service.get_inventory(week=week, limit=limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/forecasts/detailed")
def get_detailed_forecasts(week: int = Query(None), limit: int = Query(1000, ge=1, le=50000)):
    try:
        return data_service.get_detailed_forecasts(week=week, limit=limit)
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
    start_week: int = Query(None),
    end_week: int = Query(None),
    city: str = Query(None),
    center_id: int = Query(None),
    category: str = Query(None),
    cuisine: str = Query(None)
):
    try:
        return data_service.get_analytics(start_week, end_week, city, center_id, category, cuisine)
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
    return data_service.get_meals_analysis(week, city, center_id, category, cuisine)
