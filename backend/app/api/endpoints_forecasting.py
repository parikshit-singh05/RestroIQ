"""
RestroIQ 3.0 — Forecasting API Endpoints
Provides tenant-isolated, role-guarded endpoints for generating and retrieving
daily and weekly demand predictions, evaluation metrics, and operational buffer settings.
"""

from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from app.core.security import require_tenant_access
from app.schemas.tenant_schemas import TenantContext
from app.services.forecasting_service import forecasting_service
from app.schemas.forecasting_schemas import (
    ForecastGenerationRequest,
    ForecastResultsQueryResponse,
    ForecastRunSummary,
    ModelEvaluationSchema,
    TenantSettingsSchema,
    UpdateTenantSettingsRequest,
    BranchClosureCreate,
    BranchClosureSchema
)

router = APIRouter(prefix="/tenant", tags=["Tenant Forecasting"])


# ------------------------------------------------------------------------------
# 1. Generate Forecast
# ------------------------------------------------------------------------------

@router.post(
    "/restaurants/{restaurant_id}/forecasts/generate",
    response_model=ForecastResultsQueryResponse
)
def generate_forecast_endpoint(
    restaurant_id: str,
    request: ForecastGenerationRequest,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """Generates an adaptive forecast using restaurant's historical POS records."""
    try:
        return forecasting_service.generate_forecast(
            restaurant_id=restaurant_id,
            request=request,
            user_jwt=context.raw_jwt
        )
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Forecasting error: {str(e)}")


# ------------------------------------------------------------------------------
# 2. Latest & Historical Forecast Runs
# ------------------------------------------------------------------------------

@router.get(
    "/restaurants/{restaurant_id}/forecasts/latest",
    response_model=Optional[ForecastResultsQueryResponse]
)
def get_latest_forecast_endpoint(
    restaurant_id: str,
    branch_id: Optional[str] = Query(None),
    frequency: str = Query("daily"),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """Retrieves the most recent forecast results for the specified outlet and frequency."""
    runs = forecasting_service.list_forecast_runs(
        restaurant_id=restaurant_id, branch_id=branch_id, user_jwt=context.raw_jwt
    )
    matching = [r for r in runs if r.frequency == frequency]
    if not matching:
        # If no forecast exists yet, generate baseline forecast automatically
        try:
            return forecasting_service.generate_forecast(
                restaurant_id=restaurant_id,
                request=ForecastGenerationRequest(branch_id=branch_id, frequency=frequency),
                user_jwt=context.raw_jwt
            )
        except Exception:
            return None

    latest_run = matching[0]
    return forecasting_service.get_forecast_results_by_run(
        restaurant_id=restaurant_id,
        run_id=latest_run.run_id,
        user_jwt=context.raw_jwt
    )


@router.get(
    "/restaurants/{restaurant_id}/forecasts/runs",
    response_model=List[ForecastRunSummary]
)
def list_forecast_runs_endpoint(
    restaurant_id: str,
    branch_id: Optional[str] = Query(None),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """Lists recent forecasting runs with model provenance and accuracy metrics."""
    return forecasting_service.list_forecast_runs(
        restaurant_id=restaurant_id, branch_id=branch_id, user_jwt=context.raw_jwt
    )


@router.get(
    "/restaurants/{restaurant_id}/forecasts/runs/{run_id}",
    response_model=ForecastResultsQueryResponse
)
def get_forecast_run_endpoint(
    restaurant_id: str,
    run_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """Retrieves detailed predictions and preparation targets for a specific forecast run."""
    results = forecasting_service.get_forecast_results_by_run(
        restaurant_id=restaurant_id,
        run_id=run_id,
        user_jwt=context.raw_jwt
    )
    if not results:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Forecast run {run_id} not found.")
    return results


# ------------------------------------------------------------------------------
# 3. Operational Settings & Buffer Preferences
# ------------------------------------------------------------------------------

@router.get(
    "/restaurants/{restaurant_id}/settings",
    response_model=TenantSettingsSchema
)
def get_tenant_settings_endpoint(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """Retrieves tenant forecasting frequency and preparation buffer defaults."""
    return forecasting_service.get_restaurant_settings(restaurant_id=restaurant_id, user_jwt=context.raw_jwt)


@router.put(
    "/restaurants/{restaurant_id}/settings",
    response_model=TenantSettingsSchema
)
def update_tenant_settings_endpoint(
    restaurant_id: str,
    update: UpdateTenantSettingsRequest,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """Updates preparation buffer default (0, 10, 15, 20%) or frequency."""
    return forecasting_service.update_restaurant_settings(
        restaurant_id=restaurant_id,
        update=update,
        user_jwt=context.raw_jwt
    )


# ------------------------------------------------------------------------------
# 4. Branch Operating Calendars & Closures
# ------------------------------------------------------------------------------

@router.post(
    "/restaurants/{restaurant_id}/branches/{branch_id}/closures",
    response_model=BranchClosureSchema
)
def register_branch_closure_endpoint(
    restaurant_id: str,
    branch_id: str,
    closure: BranchClosureCreate,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """Registers an explicit closure date (e.g. public holiday or maintenance day)."""
    return forecasting_service.add_branch_closure(
        restaurant_id=restaurant_id,
        branch_id=branch_id,
        closure=closure,
        user_jwt=context.raw_jwt
    )


@router.get(
    "/restaurants/{restaurant_id}/branches/{branch_id}/closures",
    response_model=List[BranchClosureSchema]
)
def list_branch_closures_endpoint(
    restaurant_id: str,
    branch_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """Lists registered closure dates for a branch."""
    return forecasting_service.list_branch_closures(
        restaurant_id=restaurant_id,
        branch_id=branch_id,
        user_jwt=context.raw_jwt
    )
