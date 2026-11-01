import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from app.core.security import require_tenant_access
from app.schemas.tenant_schemas import TenantContext
from app.services.ingestion_service import ingestion_service
from app.schemas.ingestion_schemas import (
    FilePreviewResponse,
    ValidationSummaryResponse,
    CommitUploadResponse,
    HistoricalOrderSummary
)

router = APIRouter(prefix="/tenant", tags=["Tenant Ingestion"])


@router.post(
    "/restaurants/{restaurant_id}/uploads/preview",
    response_model=FilePreviewResponse
)
async def preview_upload_file(
    restaurant_id: str,
    file: UploadFile = File(...),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Parses headers and the first 10 rows of a CSV or XLSX file.
    Suggests automated column mappings using synonym dictionaries and fuzzy matching.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

        preview = ingestion_service.preview_file(content=content, file_name=file.filename or "data.csv")
        return preview
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Failed to preview file: {str(e)}")


@router.post(
    "/restaurants/{restaurant_id}/uploads/validate",
    response_model=ValidationSummaryResponse
)
async def validate_upload_file(
    restaurant_id: str,
    file: UploadFile = File(...),
    mapping: str = Form(..., description="JSON string mapping canonical fields to uploaded headers"),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Validates uploaded CSV/XLSX file against the specified column mapping.
    Runs 10 anomaly checks: date parsing, positive quantity, pricing sanity, and branch matching.
    """
    try:
        mapping_dict = json.loads(mapping)
        content = await file.read()
        headers, rows, _, _ = ingestion_service.read_file_headers_and_rows(content, file.filename or "data.csv")
        validation = ingestion_service.validate_dataset(headers, rows, mapping_dict)
        return validation
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON format for mapping parameter.")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post(
    "/restaurants/{restaurant_id}/uploads/commit",
    response_model=CommitUploadResponse
)
async def commit_upload_file(
    restaurant_id: str,
    file: UploadFile = File(...),
    mapping: str = Form(..., description="JSON string mapping canonical fields to uploaded headers"),
    branch_id: Optional[str] = Form(None, description="Optional branch ID if file lacks branch column"),
    save_mapping_name: Optional[str] = Form(None, description="Optional name to save mapping profile"),
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Validates and idempotently commits the uploaded sales data into normalized_order_items.
    Synchronizes the menu item catalog and preserves legitimate duplicate line items.
    Requires 'admin' or 'owner' role.
    """
    try:
        mapping_dict = json.loads(mapping)
        content = await file.read()
        res = ingestion_service.commit_dataset(
            restaurant_id=restaurant_id,
            user_id=context.user_id,
            user_jwt=getattr(context, "raw_jwt", None),
            file_name=file.filename or "sales.csv",
            file_content=content,
            mapping=mapping_dict,
            fallback_branch_id=branch_id,
            save_mapping_name=save_mapping_name
        )
        return res
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON format for mapping parameter.")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ingestion failed: {str(e)}")


@router.post(
    "/restaurants/{restaurant_id}/uploads/load-sample",
    response_model=CommitUploadResponse
)
def load_sample_pos_data(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Convenience endpoint for onboarding: loads the synthetic 16-week POS dataset
    for 'The Spice Garden Cafe & Bistro' into this restaurant workspace.
    Requires 'admin' or 'owner' role.
    """
    try:
        return ingestion_service.load_sample_dataset(
            restaurant_id=restaurant_id,
            user_id=context.user_id,
            user_jwt=getattr(context, "raw_jwt", None)
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get(
    "/restaurants/{restaurant_id}/uploads"
)
def list_uploads(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Returns upload history and processing status for the restaurant.
    """
    return ingestion_service.list_uploads(restaurant_id)


@router.get(
    "/restaurants/{restaurant_id}/orders/summary",
    response_model=HistoricalOrderSummary
)
def get_orders_summary(
    restaurant_id: str,
    branch_id: Optional[str] = Query(None, description="Optional branch ID filter"),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Computes tenant operational headline numbers: total orders, gross sales,
    active days, unique dishes, data sufficiency verdict, and daily velocity.
    """
    return ingestion_service.get_historical_summary(
        restaurant_id=restaurant_id,
        branch_id=branch_id,
        user_jwt=getattr(context, "raw_jwt", None)
    )
