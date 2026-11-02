-- ==============================================================================
-- Migration: 007_phase5_additive_cuisine.sql
-- Description: Minimal additive migration for live Supabase database.
--              Audit confirmed all other Phase 2 and 3 tables, columns, indexes,
--              and RLS policies already exist in the live Supabase schema.
--              This script adds only the single missing column: cuisine.
-- ==============================================================================

ALTER TABLE public.restaurants
ADD COLUMN IF NOT EXISTS cuisine VARCHAR(100);

