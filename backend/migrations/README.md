# RestroIQ 3.0 Database Migrations

This directory contains version-controlled, production-grade SQL migrations for Supabase PostgreSQL.

## Migration Order

Execute migrations sequentially in the Supabase Dashboard SQL Editor (or via Supabase CLI `supabase db push` / `psql`):

1. **`001_core_tenancy.sql`**
   - Enables UUID / pgcrypto extensions.
   - Creates `profiles` table synced with `auth.users`.
   - Creates `restaurants` (tenants), `restaurant_memberships` (RBAC), and `restaurant_branches`.
2. **`002_ingestion_tables.sql`**
   - Creates `data_uploads`, `column_mappings`, and `import_jobs`.
   - Creates `normalized_order_items` with unique constraint `(restaurant_id, branch_id, order_id, line_number, item_name, order_date)` preserving repeated items within single orders.
   - Creates `menu_items` catalog.
3. **`003_forecasting_tables.sql`**
   - Creates `forecast_jobs`, `forecast_runs`, `forecast_results`.
   - Creates `model_evaluations` (MAE, RMSE, WAPE, baseline comparison, data sufficiency verdict).
   - Creates `restaurant_settings` (buffers, operational preferences).
4. **`004_rls_policies.sql`**
   - Enables Row Level Security on all 14 tables.
   - Creates security-definer helper function `public.user_has_restaurant_role(restaurant_id, required_role)` enforcing hierarchy (`owner` > `admin` > `analyst`).
   - Applies granular `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies.
5. **`005_storage_policies.sql`**
   - Provisions private Supabase Storage bucket `restaurant-uploads`.
   - Configures storage RLS isolating object paths `restaurant_id/upload_id/filename`.

## Execution Verification
After executing the SQL statements:
- Run the automated security test suite:
  ```powershell
  Push-Location backend
  .\venv\Scripts\python.exe -m unittest tests/test_phase1_security_and_tenancy.py
  Pop-Location
  ```
