-- ==============================================================================
-- Migration: 001_core_tenancy.sql
-- Description: Core schema for multi-tenant profiles, organizations, memberships, and branches.
-- ==============================================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. PROFILES TABLE
-- Mirrors Supabase auth.users with public metadata
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to automatically create or update profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Restrict function execution strictly to triggers / postgres
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- Bind trigger to auth.users if trigger does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
    ) THEN
        CREATE TRIGGER on_auth_user_created
        AFTER INSERT OR UPDATE ON auth.users
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- Backfill profiles for any users already present in auth.users prior to migration execution
INSERT INTO public.profiles (id, email, full_name, avatar_url)
SELECT 
    id, 
    email, 
    COALESCE(raw_user_meta_data->>'full_name', email),
    raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();

-- ------------------------------------------------------------------------------
-- 2. RESTAURANTS TABLE (Organizations / Tenants)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    currency_symbol VARCHAR(5) NOT NULL DEFAULT '₹',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    operational_model VARCHAR(50) DEFAULT 'dine_in_and_delivery',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX IF NOT EXISTS idx_restaurants_created_by ON public.restaurants(created_by);

-- ------------------------------------------------------------------------------
-- 3. RESTAURANT_MEMBERSHIPS TABLE (Multi-Tenant RBAC)
-- Roles: 'owner' > 'admin' > 'analyst'
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'analyst')),
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_restaurant_membership UNIQUE (restaurant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON public.restaurant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_restaurant_id ON public.restaurant_memberships(restaurant_id);

-- ------------------------------------------------------------------------------
-- 4. RESTAURANT_BRANCHES TABLE (Locations / Outlets)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_code VARCHAR(50) NOT NULL,
    branch_name VARCHAR(150) NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    latitude NUMERIC(9, 6),
    longitude NUMERIC(9, 6),
    is_active BOOLEAN NOT NULL DEFAULT true,
    introduced_date DATE DEFAULT NULL,
    discontinued_date DATE DEFAULT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    operating_days VARCHAR(50) NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_restaurant_branch_code UNIQUE (restaurant_id, branch_code)
);

CREATE INDEX IF NOT EXISTS idx_branches_restaurant_id ON public.restaurant_branches(restaurant_id);
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
-- ==============================================================================
-- Migration: 003_forecasting_tables.sql
-- Description: Dynamic multi-model forecasting tables: forecast jobs, runs,
--              item predictions, evaluation metrics, and tenant settings.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FORECAST_JOBS TABLE
-- Asynchronous forecasting trigger and job tracker
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forecast_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    frequency VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily', 'weekly')),
    horizon_steps INT NOT NULL DEFAULT 14,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    error_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecast_jobs_restaurant ON public.forecast_jobs(restaurant_id);

-- ------------------------------------------------------------------------------
-- 2. FORECAST_RUNS TABLE
-- Executed forecast iterations with model provenance and time ranges
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forecast_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_job_id UUID REFERENCES public.forecast_jobs(id) ON DELETE SET NULL,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    model_type VARCHAR(100) NOT NULL,
    frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecast_runs_restaurant ON public.forecast_runs(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_forecast_runs_created_at ON public.forecast_runs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. FORECAST_RESULTS TABLE
-- Individual predicted demand and prep buffer scenarios (0%, 10%, 15%, 20%)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.forecast_results (
    id BIGSERIAL PRIMARY KEY,
    forecast_run_id UUID NOT NULL REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    item_id VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    forecast_date DATE NOT NULL,
    predicted_orders NUMERIC(10, 2) NOT NULL,
    prep_0pct NUMERIC(10, 2) NOT NULL,
    prep_10pct NUMERIC(10, 2) NOT NULL,
    prep_15pct NUMERIC(10, 2) NOT NULL,
    prep_20pct NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forecast_results_restaurant_date ON public.forecast_results(restaurant_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecast_results_run_item ON public.forecast_results(forecast_run_id, item_name);

-- ------------------------------------------------------------------------------
-- 4. MODEL_EVALUATIONS TABLE
-- Objective accuracy metrics (MAE, RMSE, WAPE) benchmarked against baseline
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.model_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    forecast_run_id UUID NOT NULL REFERENCES public.forecast_runs(id) ON DELETE CASCADE,
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    model_name VARCHAR(100) NOT NULL,
    baseline_name VARCHAR(100) NOT NULL,
    test_mae NUMERIC(10, 4),
    test_rmse NUMERIC(10, 4),
    test_wape NUMERIC(10, 4),
    baseline_mae NUMERIC(10, 4),
    baseline_wape NUMERIC(10, 4),
    sufficiency_verdict VARCHAR(50) NOT NULL
        CHECK (sufficiency_verdict IN ('adequate', 'marginal', 'insufficient')),
    training_sample_count INT NOT NULL DEFAULT 0,
    training_start_date DATE,
    training_end_date DATE,
    evaluation_start_date DATE,
    evaluation_end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_evaluations_run ON public.model_evaluations(forecast_run_id);

-- ------------------------------------------------------------------------------
-- 5. RESTAURANT_SETTINGS TABLE
-- Tenant configuration and operational preferences
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_settings (
    restaurant_id UUID PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
    default_prep_buffer INT NOT NULL DEFAULT 10 CHECK (default_prep_buffer IN (0, 10, 15, 20)),
    default_forecasting_frequency VARCHAR(20) NOT NULL DEFAULT 'daily',
    auto_forecast_on_upload BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================================================
-- Migration: 004_rls_policies.sql
-- Description: Strict Multi-Tenant Row Level Security (RLS) policies.
--              Enforces database-level isolation based on verified memberships.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HELPER FUNCTIONS FOR TENANT ACCESS CHECKING
-- ------------------------------------------------------------------------------

-- Check if authenticated user belongs to restaurant with sufficient role rank
CREATE OR REPLACE FUNCTION public.user_has_restaurant_role(
    target_restaurant_id UUID,
    required_role VARCHAR DEFAULT 'analyst'
)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
BEGIN
    -- Reject if unauthenticated
    IF auth.uid() IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Query verified membership (runs with SECURITY DEFINER privileges to prevent recursion)
    SELECT role INTO user_role
    FROM public.restaurant_memberships
    WHERE restaurant_id = target_restaurant_id
      AND user_id = auth.uid()
    LIMIT 1;

    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Role hierarchy evaluation: 'owner' > 'admin' > 'analyst'
    IF required_role = 'analyst' THEN
        RETURN user_role IN ('owner', 'admin', 'analyst');
    ELSIF required_role = 'admin' THEN
        RETURN user_role IN ('owner', 'admin');
    ELSIF required_role = 'owner' THEN
        RETURN user_role = 'owner';
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke public execution; grant only to authenticated users and service_role
REVOKE ALL ON FUNCTION public.user_has_restaurant_role(UUID, VARCHAR) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_has_restaurant_role(UUID, VARCHAR) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. TRIGGER: ATOMIC OWNER MEMBERSHIP ON RESTAURANT CREATION
-- Prevents orphaned organizations and ensures creator is atomically owner
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_restaurant()
RETURNS TRIGGER AS $$
BEGIN
    -- If created_by is populated, automatically insert owner membership and default branch
    IF NEW.created_by IS NOT NULL THEN
        INSERT INTO public.restaurant_memberships (restaurant_id, user_id, role)
        VALUES (NEW.id, NEW.created_by, 'owner')
        ON CONFLICT (restaurant_id, user_id) DO NOTHING;

        -- Create default primary outlet
        INSERT INTO public.restaurant_branches (restaurant_id, branch_code, branch_name, city, is_primary)
        VALUES (NEW.id, 'MAIN', NEW.name || ' - Primary', 'Bengaluru', true)
        ON CONFLICT (restaurant_id, branch_code) DO NOTHING;

        -- Create default operational settings
        INSERT INTO public.restaurant_settings (restaurant_id, default_prep_buffer, default_forecasting_frequency)
        VALUES (NEW.id, 10, 'daily')
        ON CONFLICT (restaurant_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.handle_new_restaurant() FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_restaurant_created'
    ) THEN
        CREATE TRIGGER on_restaurant_created
        AFTER INSERT ON public.restaurants
        FOR EACH ROW EXECUTE FUNCTION public.handle_new_restaurant();
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.column_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.normalized_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forecast_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. PROFILES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- ------------------------------------------------------------------------------
-- 5. RESTAURANTS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view their restaurants" ON public.restaurants;
CREATE POLICY "Members can view their restaurants"
    ON public.restaurants FOR SELECT
    USING (
        created_by = auth.uid() OR
        public.user_has_restaurant_role(id, 'analyst')
    );

DROP POLICY IF EXISTS "Authenticated users can create a restaurant" ON public.restaurants;
CREATE POLICY "Authenticated users can create a restaurant"
    ON public.restaurants FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        (created_by IS NULL OR created_by = auth.uid())
    );

DROP POLICY IF EXISTS "Admins and owners can update their restaurant" ON public.restaurants;
CREATE POLICY "Admins and owners can update their restaurant"
    ON public.restaurants FOR UPDATE
    USING (public.user_has_restaurant_role(id, 'admin'));

DROP POLICY IF EXISTS "Owners can delete their restaurant" ON public.restaurants;
CREATE POLICY "Owners can delete their restaurant"
    ON public.restaurants FOR DELETE
    USING (public.user_has_restaurant_role(id, 'owner'));

-- ------------------------------------------------------------------------------
-- 6. RESTAURANT_MEMBERSHIPS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view restaurant memberships" ON public.restaurant_memberships;
CREATE POLICY "Members can view restaurant memberships"
    ON public.restaurant_memberships FOR SELECT
    USING (
        user_id = auth.uid() OR
        public.user_has_restaurant_role(restaurant_id, 'analyst')
    );

DROP POLICY IF EXISTS "Admins and owners can add members" ON public.restaurant_memberships;
CREATE POLICY "Admins and owners can add members"
    ON public.restaurant_memberships FOR INSERT
    WITH CHECK (
        -- Either creator is making themselves owner upon restaurant creation:
        (user_id = auth.uid() AND role = 'owner') OR
        -- Or an existing admin/owner is inviting a new member:
        public.user_has_restaurant_role(restaurant_id, 'admin')
    );

DROP POLICY IF EXISTS "Owners can update memberships" ON public.restaurant_memberships;
CREATE POLICY "Owners can update memberships"
    ON public.restaurant_memberships FOR UPDATE
    USING (public.user_has_restaurant_role(restaurant_id, 'owner'));

DROP POLICY IF EXISTS "Owners can remove members or users can leave" ON public.restaurant_memberships;
CREATE POLICY "Owners can remove members or users can leave"
    ON public.restaurant_memberships FOR DELETE
    USING (
        public.user_has_restaurant_role(restaurant_id, 'owner') OR
        (user_id = auth.uid() AND role != 'owner')
    );

-- ------------------------------------------------------------------------------
-- 7. RESTAURANT_BRANCHES POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view branches" ON public.restaurant_branches;
CREATE POLICY "Members can view branches"
    ON public.restaurant_branches FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can manage branches" ON public.restaurant_branches;
CREATE POLICY "Admins can manage branches"
    ON public.restaurant_branches FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 8. DATA_UPLOADS & IMPORT_JOBS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view uploads" ON public.data_uploads;
CREATE POLICY "Members can view uploads"
    ON public.data_uploads FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can create and manage uploads" ON public.data_uploads;
CREATE POLICY "Admins can create and manage uploads"
    ON public.data_uploads FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

DROP POLICY IF EXISTS "Members can view import jobs" ON public.import_jobs;
CREATE POLICY "Members can view import jobs"
    ON public.import_jobs FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can manage import jobs" ON public.import_jobs;
CREATE POLICY "Admins can manage import jobs"
    ON public.import_jobs FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 9. COLUMN_MAPPINGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view column mappings" ON public.column_mappings;
CREATE POLICY "Members can view column mappings"
    ON public.column_mappings FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can manage column mappings" ON public.column_mappings;
CREATE POLICY "Admins can manage column mappings"
    ON public.column_mappings FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 10. NORMALIZED_ORDER_ITEMS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view normalized order items" ON public.normalized_order_items;
CREATE POLICY "Members can view normalized order items"
    ON public.normalized_order_items FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can insert and modify order items" ON public.normalized_order_items;
CREATE POLICY "Admins can insert and modify order items"
    ON public.normalized_order_items FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 11. MENU_ITEMS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view menu items" ON public.menu_items;
CREATE POLICY "Members can view menu items"
    ON public.menu_items FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can manage menu items" ON public.menu_items;
CREATE POLICY "Admins can manage menu items"
    ON public.menu_items FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 12. FORECASTING & EVALUATIONS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view forecast jobs" ON public.forecast_jobs;
CREATE POLICY "Members can view forecast jobs"
    ON public.forecast_jobs FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can create and run forecast jobs" ON public.forecast_jobs;
CREATE POLICY "Admins can create and run forecast jobs"
    ON public.forecast_jobs FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

DROP POLICY IF EXISTS "Members can view forecast runs" ON public.forecast_runs;
CREATE POLICY "Members can view forecast runs"
    ON public.forecast_runs FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can manage forecast runs" ON public.forecast_runs;
CREATE POLICY "Admins can manage forecast runs"
    ON public.forecast_runs FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

DROP POLICY IF EXISTS "Members can view forecast results" ON public.forecast_results;
CREATE POLICY "Members can view forecast results"
    ON public.forecast_results FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can manage forecast results" ON public.forecast_results;
CREATE POLICY "Admins can manage forecast results"
    ON public.forecast_results FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

DROP POLICY IF EXISTS "Members can view model evaluations" ON public.model_evaluations;
CREATE POLICY "Members can view model evaluations"
    ON public.model_evaluations FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can manage model evaluations" ON public.model_evaluations;
CREATE POLICY "Admins can manage model evaluations"
    ON public.model_evaluations FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));

-- ------------------------------------------------------------------------------
-- 13. RESTAURANT_SETTINGS POLICIES
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can view restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Members can view restaurant settings"
    ON public.restaurant_settings FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can update restaurant settings" ON public.restaurant_settings;
CREATE POLICY "Admins can update restaurant settings"
    ON public.restaurant_settings FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));
-- ==============================================================================
-- Migration: 005_storage_policies.sql
-- Description: Provisioning private Supabase Storage bucket 'restaurant-uploads'
--              with path-based tenant isolation policies and safe uuid handling.
-- ==============================================================================

-- Helper function to safely cast text to UUID without throwing syntax exceptions
CREATE OR REPLACE FUNCTION public.safe_cast_uuid(val TEXT)
RETURNS UUID AS $$
BEGIN
    IF val ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        RETURN val::uuid;
    END IF;
    RETURN NULL;
EXCEPTION WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.safe_cast_uuid(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_cast_uuid(TEXT) TO authenticated, service_role, anon;

-- 1. Create the private bucket if it does not already exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'restaurant-uploads',
    'restaurant-uploads',
    false, -- STRICTLY PRIVATE: objects cannot be accessed via direct public URL
    52428800, -- 50 MB file size limit
    ARRAY[
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800;

-- 2. Storage RLS Policies
-- Expected object path convention:
-- restaurant-uploads / {restaurant_id} / {upload_id} / {filename}

DROP POLICY IF EXISTS "Tenant members can view their restaurant uploads" ON storage.objects;
CREATE POLICY "Tenant members can view their restaurant uploads"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'restaurant-uploads' AND
        public.user_has_restaurant_role(
            public.safe_cast_uuid((storage.foldername(name))[1]),
            'analyst'
        )
    );

DROP POLICY IF EXISTS "Tenant admins can upload files" ON storage.objects;
CREATE POLICY "Tenant admins can upload files"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'restaurant-uploads' AND
        public.user_has_restaurant_role(
            public.safe_cast_uuid((storage.foldername(name))[1]),
            'admin'
        )
    );

DROP POLICY IF EXISTS "Tenant admins can update their uploads" ON storage.objects;
CREATE POLICY "Tenant admins can update their uploads"
    ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'restaurant-uploads' AND
        public.user_has_restaurant_role(
            public.safe_cast_uuid((storage.foldername(name))[1]),
            'admin'
        )
    )
    WITH CHECK (
        bucket_id = 'restaurant-uploads' AND
        public.user_has_restaurant_role(
            public.safe_cast_uuid((storage.foldername(name))[1]),
            'admin'
        )
    );

DROP POLICY IF EXISTS "Tenant admins can delete their uploads" ON storage.objects;
CREATE POLICY "Tenant admins can delete their uploads"
    ON storage.objects FOR DELETE
    USING (
        bucket_id = 'restaurant-uploads' AND
        public.user_has_restaurant_role(
            public.safe_cast_uuid((storage.foldername(name))[1]),
            'admin'
        )
    );


-- ------------------------------------------------------------------------------
-- BRANCH_CLOSURES TABLE (Phase 3)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branch_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    closure_date DATE NOT NULL,
    reason VARCHAR(255) DEFAULT 'Holiday/Maintenance',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_branch_closure UNIQUE (branch_id, closure_date)
);

CREATE INDEX IF NOT EXISTS idx_branch_closures_branch_date ON public.branch_closures(branch_id, closure_date);
ALTER TABLE public.branch_closures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view branch closures" ON public.branch_closures;
CREATE POLICY "Members can view branch closures"
    ON public.branch_closures FOR SELECT
    USING (public.user_has_restaurant_role(restaurant_id, 'analyst'));

DROP POLICY IF EXISTS "Admins can manage branch closures" ON public.branch_closures;
CREATE POLICY "Admins can manage branch closures"
    ON public.branch_closures FOR ALL
    USING (public.user_has_restaurant_role(restaurant_id, 'admin'))
    WITH CHECK (public.user_has_restaurant_role(restaurant_id, 'admin'));
