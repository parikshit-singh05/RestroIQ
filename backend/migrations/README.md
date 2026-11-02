# RestroIQ 3.0 Supabase Migration & Verification Guide

This guide provides the exact, production-ready checklist for executing database migrations and verifying multi-tenant security in the Supabase Dashboard.

---

## 1. Migration Execution Checklist

Open the [Supabase Dashboard](https://supabase.com/dashboard) $\rightarrow$ Select your **RestroIQ** project $\rightarrow$ Go to the **SQL Editor** tab.

Execute each migration file sequentially in a **New Query**:

- [ ] **Step 1: Execute `001_core_tenancy.sql`**
  - Enables `uuid-ossp` and `pgcrypto`.
  - Creates `profiles` table synced with `auth.users`.
  - Creates `restaurants`, `restaurant_memberships`, and `restaurant_branches`.
  - Configures `handle_new_user()` with `SECURITY DEFINER SET search_path = public, pg_temp`.

- [ ] **Step 2: Execute `002_ingestion_tables.sql`**
  - Creates `data_uploads`, `column_mappings`, and `import_jobs`.
  - Creates `normalized_order_items` with canonical fields and `UNIQUE NULLS NOT DISTINCT (restaurant_id, branch_id, order_id, line_number, item_name, order_date)`.
  - Creates `menu_items` catalog.

- [ ] **Step 3: Execute `003_forecasting_tables.sql`**
  - Creates `forecast_jobs` (default 14-day daily horizon and 4-week weekly option).
  - Creates `forecast_runs` and `forecast_results` (with 0%, 10%, 15%, 20% prep targets).
  - Creates `model_evaluations` (MAE, RMSE, WAPE, baseline comparison, data sufficiency verdict).
  - Creates `restaurant_settings`.

- [ ] **Step 4: Execute `004_rls_policies.sql`**
  - Creates security-definer helper function `user_has_restaurant_role(target_restaurant_id, required_role)`.
  - Restricts function execution privileges (`REVOKE ALL FROM PUBLIC; GRANT TO authenticated, service_role`).
  - Creates `on_restaurant_created` atomic owner trigger.
  - Enables Row Level Security on all 14 tables and applies granular role policies.

- [ ] **Step 5: Execute `005_storage_policies.sql`**
  - Provisions private storage bucket `restaurant-uploads`.
  - Creates safe UUID parser `safe_cast_uuid(text)`.
  - Configures path-based storage RLS isolating object paths: `restaurant-uploads/{restaurant_id}/{upload_id}/{filename}`.

---

## 2. Post-Migration Verification Queries

Run the following SQL queries in the Supabase SQL Editor to verify the installation:

### Verification Query 1: Verify Table Row Level Security (RLS) Status
```sql
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```
*Expected Result:* All 14 tables (`profiles`, `restaurants`, `restaurant_memberships`, `restaurant_branches`, `data_uploads`, `column_mappings`, `import_jobs`, `normalized_order_items`, `menu_items`, `forecast_jobs`, `forecast_runs`, `forecast_results`, `model_evaluations`, `restaurant_settings`) must display `rls_enabled = true`.

---

### Verification Query 2: Verify Active Security Definer Functions & Search Path
```sql
SELECT 
    proname AS function_name,
    prosecdef AS is_security_definer,
    proconfig AS search_path_config
FROM pg_proc 
WHERE proname IN ('user_has_restaurant_role', 'handle_new_user', 'handle_new_restaurant', 'safe_cast_uuid');
```
*Expected Result:* All 4 functions must show `is_security_definer = true` and `search_path_config` containing `search_path=public, pg_temp`.

---

### Verification Query 3: Verify Private Storage Bucket Provisioning
```sql
SELECT 
    id,
    name,
    public,
    file_size_limit
FROM storage.buckets 
WHERE id = 'restaurant-uploads';
```
*Expected Result:*
- `id`: `restaurant-uploads`
- `public`: `false` (Strictly private)
- `file_size_limit`: `52428800` (50 MB)

---

### Verification Query 4: Verify Order Items Unique Index & Idempotency
```sql
SELECT 
    conname AS constraint_name,
    contype AS constraint_type
FROM pg_constraint 
WHERE conrelid = 'public.normalized_order_items'::regclass
  AND conname = 'uq_order_line_item';
```
*Expected Result:* Constraint `uq_order_line_item` exists with type `u` (Unique).

---

## 3. Running Live Integration Tests (Optional)

To verify the database RLS and storage policies live from your local terminal:
1. Populate your `backend/.env` file:
   ```env
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_KEY=<your-anon-publishable-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   TEST_USER_A_EMAIL=operator1@restroiq.com
   TEST_USER_A_PASSWORD=TestPassword123!
   TEST_USER_B_EMAIL=operator2@restroiq.com
   TEST_USER_B_PASSWORD=TestPassword123!
   ```
2. Run the integration test suite:
   ```powershell
   Push-Location backend
   .\venv\Scripts\python.exe -m unittest tests/test_supabase_live_integration.py
   Pop-Location
   ```
