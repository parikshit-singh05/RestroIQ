from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class ColumnMappingSuggestion(BaseModel):
    canonical_field: str
    matched_header: Optional[str] = None
    confidence: float = 0.0
    required: bool = False
    description: str

class FilePreviewResponse(BaseModel):
    file_name: str
    file_format: str
    detected_headers: List[str]
    suggested_mapping: Dict[str, Optional[str]]
    column_suggestions: List[ColumnMappingSuggestion]
    preview_rows: List[Dict[str, Any]]
    total_estimated_rows: int
    detected_branches: List[str] = []
    requires_branch_selection: bool = False

class ValidationAnomaly(BaseModel):
    row_index: int
    field: str
    raw_value: Optional[str] = None
    message: str
    severity: str = "error" # "error" or "warning"

class ValidationSummaryResponse(BaseModel):
    is_valid: bool
    total_rows: int
    valid_rows: int
    invalid_rows: int
    error_count: int
    warning_count: int
    errors: List[ValidationAnomaly]
    warnings: List[ValidationAnomaly]
    date_range: Optional[Dict[str, str]] = None # {"start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "days": int}
    total_quantity: float = 0.0
    total_sales: float = 0.0
    unique_items_count: int = 0
    unique_branches_count: int = 0
    detected_branches: List[str] = []
    branch_resolution_status: str = "valid" # "valid", "unambiguous_single_branch", "ambiguous_selection_required"

class CommitUploadRequest(BaseModel):
    mapping: Dict[str, str] = Field(..., description="Canonical field -> uploaded CSV/XLSX header")
    branch_id: Optional[str] = Field(None, description="Explicit branch ID if file lacks branch column or has unrecognized branches")
    save_mapping_name: Optional[str] = Field(None, description="Optional name to save this mapping profile")

class CommitUploadResponse(BaseModel):
    upload_id: str
    import_job_id: str
    status: str
    storage_path: Optional[str] = None
    is_sample: bool = False
    total_rows: int
    valid_rows: int
    inserted_rows: int
    duplicate_rows: int
    invalid_rows: int
    date_range: Optional[Dict[str, str]] = None
    unique_items_added: int = 0
    message: str

class UploadRecordResponse(BaseModel):
    id: str
    restaurant_id: str
    file_name: str
    file_format: str
    file_size_bytes: int
    storage_path: Optional[str] = None
    is_sample: bool = False
    row_count: Optional[int] = None
    status: str
    created_at: Optional[str] = None

class DownloadUrlResponse(BaseModel):
    upload_id: str
    file_name: str
    storage_path: str
    download_url: str
    expires_in_seconds: int = 300

class PurgeSampleResponse(BaseModel):
    restaurant_id: str
    deleted_orders_count: int
    deleted_uploads_count: int
    message: str

class HistoricalOrderSummary(BaseModel):
    restaurant_id: str
    branch_id: Optional[str] = None
    total_line_items: int
    total_orders: int
    total_sales: float
    currency_symbol: str = "₹"
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    total_days: int = 0
    unique_items_count: int = 0
    active_branches_count: int = 0
    data_sufficiency: str # "adequate", "marginal", "insufficient"
    is_sample_active: bool = False
    sample_orders_count: int = 0
    top_items: List[Dict[str, Any]] = []
    daily_velocity: List[Dict[str, Any]] = []
