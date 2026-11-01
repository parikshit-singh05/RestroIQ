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
