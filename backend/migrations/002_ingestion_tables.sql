-- ==============================================================================
-- Migration: 002_ingestion_tables.sql
-- Description: Ingestion pipeline tables: file uploads, column mappings,
--              import jobs, normalized order items, and menu items.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DATA_UPLOADS TABLE
-- Tracks files uploaded to private Supabase Storage
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    file_format VARCHAR(10) NOT NULL CHECK (file_format IN ('csv', 'xlsx')),
    file_size_bytes BIGINT NOT NULL,
    row_count INT,
    status VARCHAR(30) NOT NULL DEFAULT 'uploaded'
        CHECK (status IN ('uploaded', 'parsing', 'mapping_required', 'validating', 'ready_for_import', 'processing', 'completed', 'failed')),
    is_sample BOOLEAN NOT NULL DEFAULT false,
    error_summary JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uploads_restaurant_id ON public.data_uploads(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_uploads_status ON public.data_uploads(status);
CREATE INDEX IF NOT EXISTS idx_uploads_restaurant_is_sample ON public.data_uploads(restaurant_id, is_sample);

-- ------------------------------------------------------------------------------
-- 2. COLUMN_MAPPINGS TABLE
-- Saved mapping profiles for heterogeneous POS software exports
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.column_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    mapping_name VARCHAR(100) NOT NULL,
    field_mapping JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_restaurant_mapping_name UNIQUE (restaurant_id, mapping_name)
);

CREATE INDEX IF NOT EXISTS idx_mappings_restaurant_id ON public.column_mappings(restaurant_id);

-- ------------------------------------------------------------------------------
-- 3. IMPORT_JOBS TABLE
-- Execution logs for idempotent batch processing of uploaded files
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.import_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    upload_id UUID NOT NULL REFERENCES public.data_uploads(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'validating', 'processing', 'completed', 'failed', 'partial')),
    total_rows INT DEFAULT 0,
    valid_rows INT DEFAULT 0,
    invalid_rows INT DEFAULT 0,
    error_log JSONB DEFAULT '[]'::jsonb,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_restaurant_id ON public.import_jobs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_upload_id ON public.import_jobs(upload_id);

-- ------------------------------------------------------------------------------
-- 4. NORMALIZED_ORDER_ITEMS TABLE
-- Canonical operational sales log with robust duplicate preservation
-- (line_number preserves legitimate repeated dishes in same order ticket;
--  UNIQUE NULLS NOT DISTINCT guarantees PostgreSQL treats identical rows with
--  or without branch_id as duplicate violations during re-imports)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.normalized_order_items (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    import_job_id UUID REFERENCES public.import_jobs(id) ON DELETE SET NULL,
    order_id VARCHAR(100) NOT NULL,
    line_number INT NOT NULL DEFAULT 1,
    order_date DATE NOT NULL,
    order_time TIME,
    item_id VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    quantity NUMERIC(12, 3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2),
    discount NUMERIC(12, 2) DEFAULT 0.00,
    net_sales NUMERIC(14, 2),
    promotion_tag VARCHAR(100) DEFAULT 'none',
    order_status VARCHAR(50) DEFAULT 'completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Idempotency constraint using SQL:2023 / PG15 NULLS NOT DISTINCT
    CONSTRAINT uq_order_line_item UNIQUE NULLS NOT DISTINCT (
        restaurant_id,
        branch_id,
        order_id,
        line_number,
        item_name,
        order_date
    )
);

CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_date ON public.normalized_order_items(restaurant_id, order_date);
CREATE INDEX IF NOT EXISTS idx_order_items_branch_date ON public.normalized_order_items(branch_id, order_date);
CREATE INDEX IF NOT EXISTS idx_order_items_item_name ON public.normalized_order_items(restaurant_id, item_name);

-- ------------------------------------------------------------------------------
-- 5. MENU_ITEMS TABLE
-- Normalized catalog of active dishes and categories per restaurant
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    item_id VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    standard_price NUMERIC(12, 2),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_menu_item_name UNIQUE (restaurant_id, item_name)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
