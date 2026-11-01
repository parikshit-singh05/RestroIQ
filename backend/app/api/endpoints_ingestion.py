import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, Query
from app.core.security import require_tenant_access
from app.schemas.tenant_schemas import TenantContext
from app.services.tenant_service import tenant_service
from app.services.ingestion_service import ingestion_service
from app.schemas.ingestion_schemas import (
    FilePreviewResponse,
    ValidationSummaryResponse,
    CommitUploadResponse,
    HistoricalOrderSummary,
    DownloadUrlResponse,
    PurgeSampleResponse
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
    Reports if branch confirmation is mandatory.
    """
    try:
        content = await file.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

        preview = ingestion_service.preview_file(
            content=content,
            file_name=file.filename or "data.csv",
            restaurant_id=restaurant_id
        )
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
    branch_id: Optional[str] = Form(None, description="Explicit target branch ID"),
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Validates uploaded CSV/XLSX file against the specified column mapping.
    Enforces strict branch resolution: if multi-branch and file lacks branch column,
    requires explicit branch_id. Never silently assigns to primary branch.
    """
    try:
        mapping_dict = json.loads(mapping)
        content = await file.read()
        headers, rows, _, _ = ingestion_service.read_file_headers_and_rows(content, file.filename or "data.csv")
        
        # Load registered branches to verify branch existence
        branches = tenant_service.list_branches(restaurant_id)
        
        validation = ingestion_service.validate_dataset(
            headers=headers,
            rows=rows,
            mapping=mapping_dict,
            registered_branches=[b.model_dump() for b in branches],
            fallback_branch_id=branch_id
        )
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
    branch_id: Optional[str] = Form(None, description="Explicit branch ID confirmation"),
    save_mapping_name: Optional[str] = Form(None, description="Optional name to save mapping profile"),
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Validates and idempotently commits the uploaded sales data into normalized_order_items.
    Uploads raw file into private Supabase Storage bucket 'restaurant-uploads'
    under path {restaurant_id}/{upload_id}/{filename}.
    Never silently assigns records to primary branch when ambiguous.
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
            save_mapping_name=save_mapping_name,
            is_sample=False
        )
        return res
    except json.JSONDecodeError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON format for mapping parameter.")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Ingestion failed: {str(e)}")


@router.get(
    "/restaurants/{restaurant_id}/uploads/{upload_id}/download-url",
    response_model=DownloadUrlResponse
)
def get_upload_download_url(
    restaurant_id: str,
    upload_id: str,
    context: TenantContext = Depends(require_tenant_access("analyst"))
):
    """
    Generates a secure temporary signed URL to download the original uploaded
    file from the private Supabase Storage bucket.
    """
    try:
        return ingestion_service.get_upload_download_url(
            restaurant_id=restaurant_id,
            upload_id=upload_id,
            user_jwt=getattr(context, "raw_jwt", None)
        )
    except KeyError as ke:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ke))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


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
    Explicitly tags rows as 'synthetic_sample' for strict data isolation.
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


@router.delete(
    "/restaurants/{restaurant_id}/uploads/sample",
    response_model=PurgeSampleResponse
)
def purge_sample_data(
    restaurant_id: str,
    context: TenantContext = Depends(require_tenant_access("admin"))
):
    """
    Completely purges all synthetic sample orders and sample uploads from this restaurant workspace,
    leaving real restaurant uploads 100% uncontaminated.
    Requires 'admin' or 'owner' role.
    """
    try:
        return ingestion_service.purge_sample_data(
            restaurant_id=restaurant_id,
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
    active days, unique dishes, data sufficiency verdict, and sample data status.
    """
    return ingestion_service.get_historical_summary(
        restaurant_id=restaurant_id,
        branch_id=branch_id,
        user_jwt=getattr(context, "raw_jwt", None)
    )
