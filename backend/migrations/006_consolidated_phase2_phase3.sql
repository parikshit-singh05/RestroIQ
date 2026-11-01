-- ==============================================================================
-- Migration: 006_consolidated_phase2_phase3.sql
-- Description: Consolidated, idempotent migration for RestroIQ 3.0 Phase 2 & 3.
--              Includes missing columns, indexes, branch_closures table with RLS,
--              and forecasting enhancements.
-- Safe to execute against live Supabase project. Idempotent (IF NOT EXISTS).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PHASE 2: INGESTION, STORAGE & SYNTHETIC DATA ISOLATION
-- ------------------------------------------------------------------------------

-- Ensure `is_sample` flag on public.data_uploads
ALTER TABLE public.data_uploads 
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT false;

-- Composite index for fast synthetic sample queries and tenant purge
CREATE INDEX IF NOT EXISTS idx_uploads_restaurant_is_sample 
ON public.data_uploads(restaurant_id, is_sample);

-- Composite index on normalized_order_items for rapid sample purge
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_promotion 
ON public.normalized_order_items(restaurant_id, promotion_tag);


-- ------------------------------------------------------------------------------
-- 2. PHASE 3: MENU LIFECYCLE & OPERATING CALENDAR
-- ------------------------------------------------------------------------------

-- Add menu item lifecycle dates to public.menu_items
-- Distinguishes between zero sales on active days vs unintroduced/discontinued dates
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS introduced_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS discontinued_date DATE DEFAULT NULL;

-- Add weekly operating days pattern to public.restaurant_branches
ALTER TABLE public.restaurant_branches
ADD COLUMN IF NOT EXISTS operating_days VARCHAR(50) NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun';

-- Create branch_closures table for explicit holiday/maintenance calendar
CREATE TABLE IF NOT EXISTS public.branch_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    closure_date DATE NOT NULL,
    reason VARCHAR(255) DEFAULT 'Holiday/Maintenance',
    is_full_day BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_branch_closure UNIQUE (branch_id, closure_date)
);

CREATE INDEX IF NOT EXISTS idx_branch_closures_branch_date 
ON public.branch_closures(branch_id, closure_date);

CREATE INDEX IF NOT EXISTS idx_branch_closures_restaurant 
ON public.branch_closures(restaurant_id);

-- Enable Row Level Security (RLS) on branch_closures
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


-- ------------------------------------------------------------------------------
-- 3. PHASE 3: FORECASTING ENGINE SCHEMA ENHANCEMENTS
-- ------------------------------------------------------------------------------

-- Add model_type column to public.forecast_results for direct query provenance
ALTER TABLE public.forecast_results
ADD COLUMN IF NOT EXISTS model_type VARCHAR(100) DEFAULT 'baseline_seasonal_naive';

-- Add chronological walk-forward training and evaluation date ranges
ALTER TABLE public.model_evaluations
ADD COLUMN IF NOT EXISTS training_start_date DATE,
ADD COLUMN IF NOT EXISTS training_end_date DATE,
ADD COLUMN IF NOT EXISTS evaluation_start_date DATE,
ADD COLUMN IF NOT EXISTS evaluation_end_date DATE;

-- Ensure timezone column in public.restaurant_settings for schedule alignment
ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata';

-- Performance indexes for forecast retrieval and date filtering
CREATE INDEX IF NOT EXISTS idx_forecast_results_model_type 
ON public.forecast_results(forecast_run_id, model_type);

CREATE INDEX IF NOT EXISTS idx_model_evaluations_dates 
ON public.model_evaluations(restaurant_id, evaluation_start_date, evaluation_end_date);

