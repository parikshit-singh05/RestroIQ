-- ==============================================================================
-- Migration: 006_phase2_schema_enhancements.sql
-- Description: Additive schema enhancements for Phase 2 POS Ingestion,
--              Synthetic Dataset Isolation, and Storage tracking.
-- Safe to execute against live Supabase project. Idempotent (IF NOT EXISTS).
-- ==============================================================================

-- 1. Ensure `is_sample` column on public.data_uploads
ALTER TABLE public.data_uploads 
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN NOT NULL DEFAULT false;

-- 2. Add composite index on (restaurant_id, is_sample) for performant sample queries & purge
CREATE INDEX IF NOT EXISTS idx_uploads_restaurant_is_sample 
ON public.data_uploads(restaurant_id, is_sample);

-- 3. Ensure promotion_tag index on normalized_order_items for rapid sample purge
CREATE INDEX IF NOT EXISTS idx_order_items_restaurant_promotion 
ON public.normalized_order_items(restaurant_id, promotion_tag);

