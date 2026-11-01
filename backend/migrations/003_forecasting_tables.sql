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

