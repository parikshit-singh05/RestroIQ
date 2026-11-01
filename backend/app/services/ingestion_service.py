import os
import io
import re
import csv
import uuid
import hashlib
from datetime import datetime, date, timedelta, time, timezone
from typing import Optional, List, Dict, Any, Tuple
from collections import defaultdict

try:
    import openpyxl
except ImportError:
    openpyxl = None

from app.core.config import settings
from app.core.supabase import get_tenant_supabase_client
from app.services.tenant_service import tenant_service
from app.schemas.ingestion_schemas import (
    ColumnMappingSuggestion,
    FilePreviewResponse,
    ValidationAnomaly,
    ValidationSummaryResponse,
    CommitUploadResponse,
    HistoricalOrderSummary
)

# Canonical field definitions
CANONICAL_FIELDS_META = {
    "order_date": {
        "required": True,
        "type": "date",
        "description": "Date the order was placed / billed (YYYY-MM-DD or DD/MM/YYYY)",
        "synonyms": ["bill_date", "date", "transaction_date", "order_dt", "invoice_date", "order_date", "billdate", "orderdate", "sale_date"]
    },
    "item_name": {
        "required": True,
        "type": "string",
        "description": "Name or title of dish / beverage / menu item",
        "synonyms": ["dish_name", "item_name", "product", "item", "menu_item", "dish", "item_description", "itemname", "dishname", "product_name"]
    },
    "quantity": {
        "required": True,
        "type": "numeric",
        "description": "Portions / units ordered (must be > 0)",
        "synonyms": ["qty_sold", "quantity", "qty", "units", "quantity_ordered", "count", "sold_qty", "qtysold", "number_of_items"]
    },
    "order_id": {
        "required": False,
        "type": "string",
        "description": "Unique bill, receipt, or invoice number",
        "synonyms": ["bill_no", "order_id", "bill_number", "invoice_no", "ticket_no", "receipt_id", "order_ref", "billno", "invoice_id"]
    },
    "branch_code": {
        "required": False,
        "type": "string",
        "description": "Branch outlet name, code, or location",
        "synonyms": ["outlet_location", "branch", "outlet", "location", "branch_code", "branch_id", "store_id", "center_id", "outlet_name", "store"]
    },
    "order_time": {
        "required": False,
        "type": "time",
        "description": "Time of order placement (HH:MM:SS)",
        "synonyms": ["bill_time", "order_time", "time", "transaction_time", "ordertime", "billtime"]
    },
    "item_id": {
        "required": False,
        "type": "string",
        "description": "SKU, dish ID or item code",
        "synonyms": ["sku", "product_id", "item_code", "plu", "item_id", "itemcode", "dish_id"]
    },
    "category": {
        "required": False,
        "type": "string",
        "description": "Dish section (e.g. Starters, Main Course, Beverages)",
        "synonyms": ["menu_category", "category", "item_group", "group", "section", "cat", "item_category", "department"]
    },
    "unit_price": {
        "required": False,
        "type": "numeric",
        "description": "Base selling price per portion in local currency",
        "synonyms": ["rate_inr", "rate", "unit_price", "price", "item_price", "mrp", "rate_per_unit", "selling_price"]
    },
    "discount": {
        "required": False,
        "type": "numeric",
        "description": "Discount deduction applied to this line item",
        "synonyms": ["discount_amt", "discount", "disc", "discount_amount", "offer_deduction", "discount_val"]
    },
    "net_sales": {
        "required": False,
        "type": "numeric",
        "description": "Total final revenue for this line item",
        "synonyms": ["net_total", "net_sales", "total", "amount", "item_total", "gross_amount", "net_amount", "subtotal", "bill_amount"]
    },
    "promotion_tag": {
        "required": False,
        "type": "string",
        "description": "Active coupon or promotional campaign name",
        "synonyms": ["promo_code", "coupon", "campaign", "is_promotion", "promotion", "promo"]
    },
    "order_status": {
        "required": False,
        "type": "string",
        "description": "Order fulfillment status (completed, delivered, etc.)",
        "synonyms": ["status", "order_status", "order_state", "delivery_status"]
    }
}


def normalize_header(header: str) -> str:
    """Normalizes a raw CSV/XLSX header string for fuzzy matching."""
    s = header.strip().lower()
    s = re.sub(r"[^\w\s]", "_", s)
    s = re.sub(r"[\s_]+", "_", s)
    return s.strip("_")


class IngestionService:
    """
    Heterogeneous POS data parser, column auto-matcher, anomaly validator,
    and idempotent ingestion service for RestroIQ 3.0.
    """

    def __init__(self):
        # In-memory store for orders per restaurant (for offline testing & caching)
        # restaurant_id -> list of normalized order items
        self._orders: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        # restaurant_id -> list of uploads
        self._uploads: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        # restaurant_id -> list of saved column mappings
        self._mappings: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        # restaurant_id -> set of registered menu item names
        self._menu_items: Dict[str, Dict[str, Dict[str, Any]]] = defaultdict(dict)

    # --------------------------------------------------------------------------
    # 1. Parsing & Auto-Mapping
    # --------------------------------------------------------------------------

    def read_file_headers_and_rows(
        self,
        content: bytes,
        file_name: str,
        max_rows: Optional[int] = None
    ) -> Tuple[List[str], List[Dict[str, Any]], str, int]:
        """
        Parses raw bytes of CSV or XLSX into headers, row dicts, format name, and total rows.
        """
        file_ext = os.path.splitext(file_name)[1].lower()
        if file_ext in [".xlsx", ".xlsm", ".xltx"]:
            return self._read_xlsx(content, max_rows)
        else:
            return self._read_csv(content, max_rows)

    def _read_csv(
        self,
        content: bytes,
        max_rows: Optional[int] = None
    ) -> Tuple[List[str], List[Dict[str, Any]], str, int]:
        # Multi-encoding fallback
        text = None
        for enc in ["utf-8-sig", "utf-8", "latin-1", "cp1252"]:
            try:
                text = content.decode(enc)
                break
            except (UnicodeDecodeError, LookupError):
                continue

        if text is None:
            text = content.decode("utf-8", errors="replace")

        lines = text.splitlines()
        if not lines:
            raise ValueError("Uploaded file is empty.")

        # Detect delimiter
        first_line = lines[0]
        delimiter = ","
        for d in [",", "\t", ";", "|"]:
            if d in first_line:
                delimiter = d
                break

        reader = csv.reader(lines, delimiter=delimiter)
        raw_headers = next(reader, None)
        if not raw_headers:
            raise ValueError("Could not find header row in CSV.")

        headers = [h.strip() for h in raw_headers if h.strip()]
        rows: List[Dict[str, Any]] = []
        total_rows = 0

        for row_vals in reader:
            if not row_vals or not any(row_vals):
                continue
            total_rows += 1
            if max_rows is None or len(rows) < max_rows:
                row_dict = {}
                for idx, h in enumerate(headers):
                    val = row_vals[idx].strip() if idx < len(row_vals) else ""
                    row_dict[h] = val
                rows.append(row_dict)

        # If max_rows was specified, count the remaining lines
        if max_rows is not None:
            # We already have total_rows from the loop
            pass

        return headers, rows, "csv", total_rows

    def _read_xlsx(
        self,
        content: bytes,
        max_rows: Optional[int] = None
    ) -> Tuple[List[str], List[Dict[str, Any]], str, int]:
        if openpyxl is None:
            raise ImportError("openpyxl is required to parse Excel files.")

        wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True, read_only=True)
        sheet = wb.active
        if sheet is None:
            raise ValueError("Excel file contains no active sheets.")

        row_iter = sheet.iter_rows(values_only=True)
        raw_headers = next(row_iter, None)
        if not raw_headers:
            raise ValueError("Excel file contains no headers.")

        headers = [str(h).strip() for h in raw_headers if h is not None and str(h).strip()]
        rows: List[Dict[str, Any]] = []
        total_rows = 0

        for row_vals in row_iter:
            if not row_vals or not any(row_vals):
                continue
            total_rows += 1
            if max_rows is None or len(rows) < max_rows:
                row_dict = {}
                for idx, h in enumerate(headers):
                    val = row_vals[idx] if idx < len(row_vals) else None
                    if val is None:
                        row_dict[h] = ""
                    elif isinstance(val, (datetime, date)):
                        row_dict[h] = val.strftime("%Y-%m-%d")
                    elif isinstance(val, time):
                        row_dict[h] = val.strftime("%H:%M:%S")
                    else:
                        row_dict[h] = str(val).strip()
                rows.append(row_dict)

        wb.close()
        return headers, rows, "xlsx", total_rows

    def auto_match_columns(self, headers: List[str]) -> Tuple[Dict[str, Optional[str]], List[ColumnMappingSuggestion]]:
        """
        Compares headers against canonical synonyms using normalized matching
        and produces suggested mapping with confidence scores.
        """
        normalized_map = {normalize_header(h): h for h in headers}
        suggested: Dict[str, Optional[str]] = {}
        suggestions_list: List[ColumnMappingSuggestion] = []

        used_headers = set()

        # Step 1: Exact matches or exact synonym matches
        for canonical, meta in CANONICAL_FIELDS_META.items():
            matched_header = None
            best_confidence = 0.0

            # Check direct name
            norm_canonical = normalize_header(canonical)
            if norm_canonical in normalized_map and normalized_map[norm_canonical] not in used_headers:
                matched_header = normalized_map[norm_canonical]
                best_confidence = 1.0

            # Check synonyms
            if not matched_header:
                for syn in meta["synonyms"]:
                    norm_syn = normalize_header(syn)
                    if norm_syn in normalized_map and normalized_map[norm_syn] not in used_headers:
                        matched_header = normalized_map[norm_syn]
                        best_confidence = 0.98
                        break

            # Check substring matches
            if not matched_header:
                for norm_h, original_h in normalized_map.items():
                    if original_h in used_headers:
                        continue
                    if norm_canonical in norm_h or norm_h in norm_canonical:
                        matched_header = original_h
                        best_confidence = 0.85
                        break
                    for syn in meta["synonyms"]:
                        norm_syn = normalize_header(syn)
                        if norm_syn in norm_h or norm_h in norm_syn:
                            matched_header = original_h
                            best_confidence = 0.80
                            break
                    if matched_header:
                        break

            if matched_header:
                used_headers.add(matched_header)
                suggested[canonical] = matched_header
            else:
                suggested[canonical] = None

            suggestions_list.append(ColumnMappingSuggestion(
                canonical_field=canonical,
                matched_header=matched_header,
                confidence=best_confidence,
                required=meta["required"],
                description=meta["description"]
            ))

        return suggested, suggestions_list

    def preview_file(
        self,
        content: bytes,
        file_name: str
    ) -> FilePreviewResponse:
        """
        Reads headers, first 10 rows, and predicts column mappings.
        """
        headers, preview_rows, file_format, total_rows = self.read_file_headers_and_rows(content, file_name, max_rows=10)
        suggested_map, suggestions_list = self.auto_match_columns(headers)

        # Detect branches if branch column was mapped
        detected_branches: List[str] = []
        branch_header = suggested_map.get("branch_code")
        if branch_header:
            unique_b = set()
            for r in preview_rows:
                b_val = str(r.get(branch_header, "")).strip()
                if b_val:
                    unique_b.add(b_val)
            detected_branches = sorted(list(unique_b))

        return FilePreviewResponse(
            file_name=file_name,
            file_format=file_format,
            detected_headers=headers,
            suggested_mapping=suggested_map,
            column_suggestions=suggestions_list,
            preview_rows=preview_rows,
            total_estimated_rows=total_rows,
            detected_branches=detected_branches
        )

    # --------------------------------------------------------------------------
    # 2. Date Parsing & Anomaly Validator
    # --------------------------------------------------------------------------

    def parse_flexible_date(self, raw_val: Any) -> Optional[date]:
        """
        Normalizes diverse date formats (ISO, Indian/UK DD-MM-YYYY, US MM/DD/YYYY, Excel serial)
        into a Python date object.
        """
        if not raw_val:
            return None

        if isinstance(raw_val, date):
            return raw_val
        if isinstance(raw_val, datetime):
            return raw_val.date()

        s = str(raw_val).strip()

        # Check if Excel integer serial date
        if s.isdigit() and len(s) in [4, 5]:
            try:
                serial = int(s)
                # Excel 1900 date system has a leap year bug on day 60
                excel_start = date(1899, 12, 30)
                return excel_start + timedelta(days=serial)
            except Exception:
                pass

        # Try standard formats
        date_patterns = [
            "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
            "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y",
            "%d-%m-%y", "%d/%m/%y", "%d.%m.%y",
            "%m/%d/%Y", "%m-%d-%Y",
            "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S",
            "%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S",
        ]

        for p in date_patterns:
            try:
                dt = datetime.strptime(s.split("T")[0] if "T" in s else s, p)
                return dt.date()
            except ValueError:
                continue

        return None

    def validate_dataset(
        self,
        headers: List[str],
        rows: List[Dict[str, Any]],
        mapping: Dict[str, str],
        registered_branches: Optional[List[Dict[str, Any]]] = None
    ) -> ValidationSummaryResponse:
        """
        Applies comprehensive data quality checks on rows according to column mapping:
        - Required columns mapped and present
        - Date parseability
        - Quantity > 0
        - Pricing reasonableness
        - Branch code resolution
        - Line-by-line anomaly collection
        """
        errors: List[ValidationAnomaly] = []
        warnings: List[ValidationAnomaly] = []

        # 1. Check required fields in mapping
        for canonical, meta in CANONICAL_FIELDS_META.items():
            if meta["required"]:
                mapped_h = mapping.get(canonical)
                if not mapped_h or mapped_h not in headers:
                    errors.append(ValidationAnomaly(
                        row_index=0,
                        field=canonical,
                        raw_value=mapped_h,
                        message=f"Missing required mapping for canonical field '{canonical}' ({meta['description']}).",
                        severity="error"
                    ))

        if errors:
            return ValidationSummaryResponse(
                is_valid=False,
                total_rows=len(rows),
                valid_rows=0,
                invalid_rows=len(rows),
                error_count=len(errors),
                warning_count=0,
                errors=errors,
                warnings=[]
            )

        date_h = mapping["order_date"]
        item_h = mapping["item_name"]
        qty_h = mapping["quantity"]
        branch_h = mapping.get("branch_code")
        unit_price_h = mapping.get("unit_price")
        net_sales_h = mapping.get("net_sales")

        valid_rows_count = 0
        min_date: Optional[date] = None
        max_date: Optional[date] = None
        unique_items = set()
        detected_branches = set()
        total_quantity = 0.0
        total_sales = 0.0

        branch_map = {}
        if registered_branches:
            for b in registered_branches:
                branch_map[b["branch_code"].lower()] = b["id"]
                branch_map[b["branch_name"].lower()] = b["id"]
                branch_map[b["city"].lower()] = b["id"]

        for idx, row in enumerate(rows, start=1):
            row_errors: List[ValidationAnomaly] = []

            # Date check
            raw_date = row.get(date_h, "")
            parsed_d = self.parse_flexible_date(raw_date)
            if not parsed_d:
                row_errors.append(ValidationAnomaly(
                    row_index=idx,
                    field="order_date",
                    raw_value=str(raw_date),
                    message="Invalid or unparseable order date format.",
                    severity="error"
                ))
            else:
                if min_date is None or parsed_d < min_date:
                    min_date = parsed_d
                if max_date is None or parsed_d > max_date:
                    max_date = parsed_d

            # Item name check
            raw_item = str(row.get(item_h, "")).strip()
            if not raw_item:
                row_errors.append(ValidationAnomaly(
                    row_index=idx,
                    field="item_name",
                    raw_value="",
                    message="Missing or blank menu item name.",
                    severity="error"
                ))
            else:
                unique_items.add(raw_item)

            # Quantity check (> 0)
            raw_qty = row.get(qty_h, "")
            qty_val = 0.0
            try:
                qty_val = float(str(raw_qty).replace(",", ""))
                if qty_val <= 0:
                    row_errors.append(ValidationAnomaly(
                        row_index=idx,
                        field="quantity",
                        raw_value=str(raw_qty),
                        message=f"Quantity must be strictly positive (got {qty_val}). Non-positive quantities are flagged as refunds/cancellations.",
                        severity="error"
                    ))
                else:
                    total_quantity += qty_val
            except (ValueError, TypeError):
                row_errors.append(ValidationAnomaly(
                    row_index=idx,
                    field="quantity",
                    raw_value=str(raw_qty),
                    message="Non-numeric quantity value.",
                    severity="error"
                ))

            # Branch check (if branch mapped)
            if branch_h:
                raw_b = str(row.get(branch_h, "")).strip()
                if raw_b:
                    detected_branches.add(raw_b)

            # Pricing & Net Sales
            if net_sales_h:
                raw_net = row.get(net_sales_h, "")
                if raw_net:
                    try:
                        net_val = float(str(raw_net).replace(",", ""))
                        if net_val < 0:
                            warnings.append(ValidationAnomaly(
                                row_index=idx,
                                field="net_sales",
                                raw_value=str(raw_net),
                                message=f"Negative net sales ({net_val}) detected.",
                                severity="warning"
                            ))
                        else:
                            total_sales += net_val
                    except ValueError:
                        pass
            elif unit_price_h and qty_val > 0:
                raw_price = row.get(unit_price_h, "")
                if raw_price:
                    try:
                        price_val = float(str(raw_price).replace(",", ""))
                        if price_val > 100000:
                            warnings.append(ValidationAnomaly(
                                row_index=idx,
                                field="unit_price",
                                raw_value=str(raw_price),
                                message=f"Unusually high unit price ({price_val} INR) flagged.",
                                severity="warning"
                            ))
                        total_sales += (price_val * qty_val)
                    except ValueError:
                        pass

            if row_errors:
                if len(errors) < 50:  # Cap preview errors to avoid huge responses
                    errors.extend(row_errors)
            else:
                valid_rows_count += 1

        total_rows_count = len(rows)
        invalid_rows_count = total_rows_count - valid_rows_count
        is_valid = invalid_rows_count == 0 or (valid_rows_count / total_rows_count >= 0.95)

        date_range = None
        if min_date and max_date:
            days_span = (max_date - min_date).days + 1
            date_range = {
                "start": min_date.strftime("%Y-%m-%d"),
                "end": max_date.strftime("%Y-%m-%d"),
                "days": str(days_span)
            }

        return ValidationSummaryResponse(
            is_valid=is_valid,
            total_rows=total_rows_count,
            valid_rows=valid_rows_count,
            invalid_rows=invalid_rows_count,
            error_count=len(errors),
            warning_count=len(warnings),
            errors=errors,
            warnings=warnings[:30],
            date_range=date_range,
            total_quantity=round(total_quantity, 2),
            total_sales=round(total_sales, 2),
            unique_items_count=len(unique_items),
            unique_branches_count=len(detected_branches),
            detected_branches=sorted(list(detected_branches))
        )

    # --------------------------------------------------------------------------
    # 3. Idempotent Ingestion & Database Commitment
    # --------------------------------------------------------------------------

    def commit_dataset(
        self,
        restaurant_id: str,
        user_id: str,
        user_jwt: Optional[str],
        file_name: str,
        file_content: bytes,
        mapping: Dict[str, str],
        fallback_branch_id: Optional[str] = None,
        save_mapping_name: Optional[str] = None
    ) -> CommitUploadResponse:
        """
        Parses full file, applies mapping, generates canonical line items,
        synchronizes menu items catalog, and performs idempotent insertion
        into normalized_order_items.
        """
        headers, rows, file_format, total_rows = self.read_file_headers_and_rows(file_content, file_name)

        # Get existing branches for restaurant
        branches = tenant_service.list_branches(restaurant_id)
        if not branches:
            raise ValueError(f"No branches registered for restaurant {restaurant_id}. Please create a branch first.")

        # Determine default / fallback branch
        primary_branch = next((b for b in branches if b.is_primary), branches[0])
        effective_fallback_branch_id = fallback_branch_id or primary_branch.id

        # Branch lookup map by code, name, city
        branch_lookup: Dict[str, str] = {}
        for b in branches:
            branch_lookup[b.branch_code.lower()] = b.id
            branch_lookup[b.branch_name.lower()] = b.id
            branch_lookup[b.city.lower()] = b.id

        # Validate dataset
        validation = self.validate_dataset(headers, rows, mapping, [b.model_dump() for b in branches])
        if not validation.is_valid and validation.valid_rows == 0:
            raise ValueError(f"File validation failed completely: {validation.error_count} fatal errors detected.")

        now_str = datetime.now(timezone.utc).isoformat()
        upload_id = str(uuid.uuid4())
        import_job_id = str(uuid.uuid4())

        # Register data_upload record
        upload_record = {
            "id": upload_id,
            "restaurant_id": restaurant_id,
            "uploaded_by": user_id,
            "branch_id": effective_fallback_branch_id,
            "file_name": file_name,
            "storage_path": f"{restaurant_id}/{upload_id}/{file_name}",
            "file_format": file_format,
            "file_size_bytes": len(file_content),
            "row_count": total_rows,
            "status": "processing",
            "error_summary": {"error_count": validation.error_count, "warning_count": validation.warning_count},
            "created_at": now_str,
            "updated_at": now_str
        }
        self._uploads[restaurant_id].append(upload_record)

        # Save column mapping if requested
        if save_mapping_name:
            mapping_record = {
                "id": str(uuid.uuid4()),
                "restaurant_id": restaurant_id,
                "mapping_name": save_mapping_name,
                "field_mapping": mapping,
                "is_default": False,
                "created_at": now_str,
                "updated_at": now_str
            }
            self._mappings[restaurant_id].append(mapping_record)

        date_h = mapping["order_date"]
        item_h = mapping["item_name"]
        qty_h = mapping["quantity"]
        branch_h = mapping.get("branch_code")
        order_id_h = mapping.get("order_id")
        order_time_h = mapping.get("order_time")
        item_id_h = mapping.get("item_id")
        category_h = mapping.get("category")
        unit_price_h = mapping.get("unit_price")
        discount_h = mapping.get("discount")
        net_sales_h = mapping.get("net_sales")
        promo_h = mapping.get("promotion_tag")
        status_h = mapping.get("order_status")

        # Track line numbers per order_id
        order_line_counter: Dict[str, int] = defaultdict(int)
        normalized_records: List[Dict[str, Any]] = []
        new_menu_items: Dict[str, Dict[str, Any]] = {}

        # Set of existing unique keys for in-memory deduplication
        existing_keys = {
            (
                r["restaurant_id"],
                r["branch_id"],
                r["order_id"],
                r["line_number"],
                r["item_name"],
                str(r["order_date"])
            )
            for r in self._orders[restaurant_id]
        }

        inserted_count = 0
        duplicate_count = 0
        invalid_count = 0

        for row in rows:
            # Parse date
            parsed_d = self.parse_flexible_date(row.get(date_h))
            if not parsed_d:
                invalid_count += 1
                continue

            # Parse item name
            raw_item_name = str(row.get(item_h, "")).strip()
            if not raw_item_name:
                invalid_count += 1
                continue

            # Parse quantity
            try:
                qty_val = float(str(row.get(qty_h, "")).replace(",", ""))
                if qty_val <= 0:
                    invalid_count += 1
                    continue
            except (ValueError, TypeError):
                invalid_count += 1
                continue

            # Resolve branch ID
            target_branch_id = effective_fallback_branch_id
            if branch_h:
                raw_b = str(row.get(branch_h, "")).strip()
                if raw_b:
                    matched_id = branch_lookup.get(raw_b.lower())
                    if matched_id:
                        target_branch_id = matched_id

            # Order ID & Line number
            raw_order_id = str(row.get(order_id_h, "")).strip() if order_id_h else ""
            if not raw_order_id:
                # Deterministic synthetic order id if none present in file
                hash_base = f"{parsed_d}-{raw_item_name}-{qty_val}"
                raw_order_id = f"AUTO-{hashlib.md5(hash_base.encode()).hexdigest()[:8]}"

            order_line_counter[raw_order_id] += 1
            line_num = order_line_counter[raw_order_id]

            # Pricing and revenue
            unit_price = None
            if unit_price_h and row.get(unit_price_h):
                try:
                    unit_price = round(float(str(row.get(unit_price_h)).replace(",", "")), 2)
                except ValueError:
                    pass

            discount = 0.0
            if discount_h and row.get(discount_h):
                try:
                    discount = round(float(str(row.get(discount_h)).replace(",", "")), 2)
                except ValueError:
                    pass

            net_sales = None
            if net_sales_h and row.get(net_sales_h):
                try:
                    net_sales = round(float(str(row.get(net_sales_h)).replace(",", "")), 2)
                except ValueError:
                    pass
            elif unit_price is not None:
                net_sales = round((unit_price * qty_val) - discount, 2)

            category = str(row.get(category_h, "")).strip() if category_h and row.get(category_h) else "General"
            item_id = str(row.get(item_id_h, "")).strip() if item_id_h and row.get(item_id_h) else re.sub(r"[^\w-]", "-", raw_item_name.lower())
            order_time = str(row.get(order_time_h, "")).strip() if order_time_h and row.get(order_time_h) else None
            promo_tag = str(row.get(promo_h, "")).strip() if promo_h and row.get(promo_h) else "none"
            order_status = str(row.get(status_h, "")).strip() if status_h and row.get(status_h) else "completed"

            # Check composite idempotency key
            dedup_key = (
                restaurant_id,
                target_branch_id,
                raw_order_id,
                line_num,
                raw_item_name,
                str(parsed_d)
            )

            if dedup_key in existing_keys:
                duplicate_count += 1
                continue

            existing_keys.add(dedup_key)
            inserted_count += 1

            record = {
                "restaurant_id": restaurant_id,
                "branch_id": target_branch_id,
                "import_job_id": import_job_id,
                "order_id": raw_order_id,
                "line_number": line_num,
                "order_date": str(parsed_d),
                "order_time": order_time,
                "item_id": item_id,
                "item_name": raw_item_name,
                "category": category,
                "quantity": qty_val,
                "unit_price": unit_price,
                "discount": discount,
                "net_sales": net_sales,
                "promotion_tag": promo_tag,
                "order_status": order_status,
                "created_at": now_str
            }
            normalized_records.append(record)

            # Collect menu item catalog entries
            if raw_item_name not in self._menu_items[restaurant_id]:
                new_menu_items[raw_item_name] = {
                    "id": str(uuid.uuid4()),
                    "restaurant_id": restaurant_id,
                    "item_id": item_id,
                    "item_name": raw_item_name,
                    "category": category,
                    "base_price": unit_price or 0.0,
                    "is_active": True,
                    "created_at": now_str,
                    "updated_at": now_str
                }

        # Store normalized records in memory
        self._orders[restaurant_id].extend(normalized_records)
        for name, item_rec in new_menu_items.items():
            self._menu_items[restaurant_id][name] = item_rec

        # If live Supabase is active, persist to database with PostgREST
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                # 1. Update data_uploads status
                upload_record["status"] = "completed"
                client.table("data_uploads").insert(upload_record).execute()

                # 2. Insert import_job
                import_job = {
                    "id": import_job_id,
                    "restaurant_id": restaurant_id,
                    "upload_id": upload_id,
                    "branch_id": effective_fallback_branch_id,
                    "status": "completed",
                    "total_rows": total_rows,
                    "valid_rows": inserted_count + duplicate_count,
                    "invalid_rows": invalid_count,
                    "started_at": now_str,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "created_at": now_str
                }
                client.table("import_jobs").insert(import_job).execute()

                # 3. Synchronize menu items
                if new_menu_items:
                    for menu_item in new_menu_items.values():
                        try:
                            client.table("menu_items").insert(menu_item).execute()
                        except Exception:
                            # If already exists, ignore
                            pass

                # 4. Batch insert normalized_order_items (chunks of 1000)
                chunk_size = 1000
                for i in range(0, len(normalized_records), chunk_size):
                    chunk = normalized_records[i:i + chunk_size]
                    client.table("normalized_order_items").upsert(
                        chunk,
                        on_conflict="restaurant_id,branch_id,order_id,line_number,item_name,order_date"
                    ).execute()

            except Exception as e:
                print(f"[IngestionService] Note: Supabase persistence failed ({e}); local store active.")
        else:
            upload_record["status"] = "completed"

        return CommitUploadResponse(
            upload_id=upload_id,
            import_job_id=import_job_id,
            status="completed",
            total_rows=total_rows,
            valid_rows=inserted_count + duplicate_count,
            inserted_rows=inserted_count,
            duplicate_rows=duplicate_count,
            invalid_rows=invalid_count,
            date_range=validation.date_range,
            unique_items_added=len(new_menu_items),
            message=f"Successfully imported {inserted_count:,} orders across {validation.date_range.get('days', '0') if validation.date_range else '0'} operational days."
        )

    # --------------------------------------------------------------------------
    # 4. Historical Orders Summary & Dashboard Velocity
    # --------------------------------------------------------------------------

    def get_historical_summary(
        self,
        restaurant_id: str,
        branch_id: Optional[str] = None,
        user_jwt: Optional[str] = None
    ) -> HistoricalOrderSummary:
        """
        Computes tenant-level order count, sales, date range, daily velocity,
        top items, and data sufficiency verdict for the operational dashboard.
        """
        # Pull orders from local memory or Supabase
        records = self._orders.get(restaurant_id, [])

        # If empty in local memory and live Supabase configured, attempt read
        if not records and settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                q = client.table("normalized_order_items").select("*").eq("restaurant_id", restaurant_id)
                if branch_id:
                    q = q.eq("branch_id", branch_id)
                res = q.execute()
                if res.data:
                    records = res.data
                    self._orders[restaurant_id] = records
            except Exception as e:
                print(f"[IngestionService] Failed to fetch orders from Supabase: {e}")

        # Filter by branch if requested
        if branch_id:
            filtered_records = [r for r in records if r.get("branch_id") == branch_id]
        else:
            filtered_records = records

        if not filtered_records:
            return HistoricalOrderSummary(
                restaurant_id=restaurant_id,
                branch_id=branch_id,
                total_line_items=0,
                total_orders=0,
                total_sales=0.0,
                currency_symbol="₹",
                start_date=None,
                end_date=None,
                total_days=0,
                unique_items_count=0,
                active_branches_count=0,
                data_sufficiency="insufficient",
                top_items=[],
                daily_velocity=[]
            )

        unique_order_ids = set()
        unique_items = set()
        unique_branches = set()
        min_date = None
        max_date = None
        total_sales = 0.0

        item_quantities: Dict[str, float] = defaultdict(float)
        item_revenues: Dict[str, float] = defaultdict(float)
        item_categories: Dict[str, str] = {}
        daily_quantities: Dict[str, float] = defaultdict(float)
        daily_orders: Dict[str, set] = defaultdict(set)

        for r in filtered_records:
            ord_id = r.get("order_id")
            if ord_id:
                unique_order_ids.add(ord_id)

            it_name = r.get("item_name")
            if it_name:
                unique_items.add(it_name)
                item_categories[it_name] = r.get("category", "General")

            b_id = r.get("branch_id")
            if b_id:
                unique_branches.add(b_id)

            d_str = str(r.get("order_date"))
            if min_date is None or d_str < min_date:
                min_date = d_str
            if max_date is None or d_str > max_date:
                max_date = d_str

            qty = float(r.get("quantity") or 0.0)
            sales = float(r.get("net_sales") or 0.0)
            total_sales += sales

            if it_name:
                item_quantities[it_name] += qty
                item_revenues[it_name] += sales

            daily_quantities[d_str] += qty
            if ord_id:
                daily_orders[d_str].add(ord_id)

        # Compute active days span
        days_span = 0
        if min_date and max_date:
            try:
                d1 = datetime.strptime(min_date, "%Y-%m-%d").date()
                d2 = datetime.strptime(max_date, "%Y-%m-%d").date()
                days_span = (d2 - d1).days + 1
            except Exception:
                days_span = len(daily_quantities)

        # Evaluate data sufficiency according to RestroIQ 3.0 specification:
        # > 12 weeks (~84 days) => adequate
        # 4 to 12 weeks (28 to 83 days) => marginal
        # < 4 weeks (< 28 days) => insufficient
        if days_span >= 84:
            sufficiency = "adequate"
        elif days_span >= 28:
            sufficiency = "marginal"
        else:
            sufficiency = "insufficient"

        # Top 8 items by sales volume
        sorted_items = sorted(item_quantities.items(), key=lambda x: x[1], reverse=True)[:8]
        top_items = [
            {
                "item_name": name,
                "category": item_categories.get(name, "General"),
                "total_quantity": round(qty, 1),
                "total_revenue": round(item_revenues[name], 2),
                "daily_average": round(qty / max(days_span, 1), 1)
            }
            for name, qty in sorted_items
        ]

        # Daily velocity (sorted chronological)
        daily_velocity = [
            {
                "date": d,
                "total_orders": len(daily_orders[d]),
                "units_sold": round(daily_quantities[d], 1)
            }
            for d in sorted(daily_quantities.keys())
        ]

        return HistoricalOrderSummary(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            total_line_items=len(filtered_records),
            total_orders=len(unique_order_ids),
            total_sales=round(total_sales, 2),
            currency_symbol="₹",
            start_date=min_date,
            end_date=max_date,
            total_days=days_span,
            unique_items_count=len(unique_items),
            active_branches_count=len(unique_branches),
            data_sufficiency=sufficiency,
            top_items=top_items,
            daily_velocity=daily_velocity
        )

    def load_sample_dataset(
        self,
        restaurant_id: str,
        user_id: str,
        user_jwt: Optional[str]
    ) -> CommitUploadResponse:
        """
        Loads the pre-packaged synthetic POS dataset (Spice Garden Bistro)
        directly into the restaurant's workspace.
        """
        # Check backend/data first, then fallback to backend/app/data
        candidate_paths = [
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "synthetic_spice_garden_pos_orders.csv")),
            os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "synthetic_spice_garden_pos_orders.csv")),
        ]
        csv_path = next((p for p in candidate_paths if os.path.exists(p)), candidate_paths[0])

        if not os.path.exists(csv_path):
            raise FileNotFoundError(f"Sample dataset not found at {csv_path}. Please generate it first.")

        with open(csv_path, "rb") as f:
            content = f.read()

        # The synthetic dataset headers
        mapping = {
            "order_date": "Bill_Date",
            "item_name": "Dish_Name",
            "quantity": "Qty_Sold",
            "branch_code": "Outlet_Location",
            "order_id": "Bill_No",
            "order_time": "Bill_Time",
            "category": "Menu_Category",
            "unit_price": "Rate_INR",
            "discount": "Discount_Amt",
            "net_sales": "Net_Total"
        }

        return self.commit_dataset(
            restaurant_id=restaurant_id,
            user_id=user_id,
            user_jwt=user_jwt,
            file_name="synthetic_spice_garden_pos_orders.csv",
            file_content=content,
            mapping=mapping,
            save_mapping_name="Spice Garden POS Export"
        )

    def list_uploads(self, restaurant_id: str) -> List[Dict[str, Any]]:
        return self._uploads.get(restaurant_id, [])

    def list_mappings(self, restaurant_id: str) -> List[Dict[str, Any]]:
        return self._mappings.get(restaurant_id, [])


# Singleton service instance
ingestion_service = IngestionService()
