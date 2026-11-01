-- ==============================================================================
-- Migration: 007_phase3_forecasting_enhancements.sql
-- Description: Additive schema enhancements for Phase 3 Dynamic Forecasting Engine:
--              Operating calendar/closures, menu lifecycle tracking, model provenance,
--              and evaluation period tracking.
-- Safe to execute against live Supabase project. Idempotent (IF NOT EXISTS).
-- ==============================================================================

-- 1. Add menu item lifecycle dates to public.menu_items
ALTER TABLE public.menu_items
ADD COLUMN IF NOT EXISTS introduced_date DATE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS discontinued_date DATE DEFAULT NULL;

-- 2. Add operating days to public.restaurant_branches
ALTER TABLE public.restaurant_branches
ADD COLUMN IF NOT EXISTS operating_days VARCHAR(50) NOT NULL DEFAULT 'mon,tue,wed,thu,fri,sat,sun';

-- 3. Create branch_closures table for explicit holiday/closure calendar
CREATE TABLE IF NOT EXISTS public.branch_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES public.restaurant_branches(id) ON DELETE CASCADE,
    closure_date DATE NOT NULL,
    reason VARCHAR(255) DEFAULT 'Holiday/Maintenance',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_branch_closure UNIQUE (branch_id, closure_date)
);

CREATE INDEX IF NOT EXISTS idx_branch_closures_branch_date 
ON public.branch_closures(branch_id, closure_date);

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

-- 4. Add model_type column to public.forecast_results for direct query convenience
ALTER TABLE public.forecast_results
ADD COLUMN IF NOT EXISTS model_type VARCHAR(100) DEFAULT 'baseline_seasonal_naive';

-- 5. Add evaluation period date ranges to public.model_evaluations
ALTER TABLE public.model_evaluations
ADD COLUMN IF NOT EXISTS training_start_date DATE,
ADD COLUMN IF NOT EXISTS training_end_date DATE,
ADD COLUMN IF NOT EXISTS evaluation_start_date DATE,
ADD COLUMN IF NOT EXISTS evaluation_end_date DATE;

-- 6. Ensure timezone column in public.restaurant_settings
ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata';

