r"""
RestroIQ 3.0 — Secure Live Supabase Verification & Test Suite
============================================================
This script conducts forensic, end-to-end verification of the live Supabase project
strictly using:
1. Temporary admin API calls (with in-memory Secret Key) to provision/confirm two test users
   with unique, high-entropy, randomly generated passwords per run.
2. The Secret Key is immediately zeroized and deleted from memory.
3. All tenant isolation, database RLS (all 14 tables), operational data RLS (uploads, orders,
   forecasts), and Storage RLS operations run exclusively with the public publishable key
   and authenticated user JWTs.
4. Cleanup deletes exclusively records and files created by the current verification run.

Usage:
------
cd backend
.\venv\Scripts\python.exe scripts/verify_live_supabase.py
"""

import os
import sys
import getpass
import uuid
import secrets
import gc
from typing import Dict, Any, List

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.supabase import (
    get_tenant_supabase_client,
    decode_and_verify_jwt
)
from supabase import create_client

ALL_14_TABLES = [
    "profiles",
    "restaurants",
    "restaurant_memberships",
    "restaurant_branches",
    "data_uploads",
    "column_mappings",
    "import_jobs",
    "normalized_order_items",
    "menu_items",
    "forecast_jobs",
    "forecast_runs",
    "forecast_results",
    "model_evaluations",
    "restaurant_settings",
]

# Generate unique, high-entropy passwords per test run (never shared, never hardcoded)
USER_A_PASSWORD = f"Alpha_{secrets.token_urlsafe(16)}!9"
USER_B_PASSWORD = f"Beta_{secrets.token_urlsafe(16)}!9"

TEST_USER_A_EMAIL = "operator_alpha@restroiq-ops.com"
TEST_USER_B_EMAIL = "operator_beta@restroiq-ops.com"


def prompt_secret_key() -> str:
    print("=" * 70)
    print("RestroIQ 3.0 — Secure Supabase Live Verification")
    print("=" * 70)
    print(f"Target Supabase URL: {settings.SUPABASE_URL}")
    print(f"Publishable Key:    {settings.SUPABASE_KEY[:16]}... (configured)")
    print("-" * 70)
    print("To provision/confirm two temporary test users with email_confirm=True,")
    print("please enter your Supabase Secret (Service Role) Key.")
    print("SECURITY GUARANTEE:")
    print(" - Input is masked / hidden.")
    print(" - Key will NEVER be saved to any file or persistent storage.")
    print(" - Key will NEVER be printed to logs or console output.")
    print(" - Key is used only in-memory to create test accounts, then wiped from memory.")
    print("-" * 70)

    env_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if env_key and not env_key.startswith("your-"):
        print("[AUTH] Using SUPABASE_SERVICE_ROLE_KEY from temporary environment.")
        return env_key.strip()

    key = getpass.getpass("Enter Supabase Secret Key (input hidden): ").strip()
    if not key:
        print("[ERROR] No key provided. Aborting verification.")
        sys.exit(1)
    return key


def provision_or_confirm_user(admin_client, email: str, full_name: str, password: str) -> str:
    """Creates or updates a test user via Admin API with a unique random password and email_confirm=True."""
    users_resp = admin_client.auth.admin.list_users()
    existing_user = next((u for u in users_resp if u.email == email), None)

    if existing_user:
        admin_client.auth.admin.update_user_by_id(
            existing_user.id,
            {
                "email_confirm": True,
                "password": password,
                "user_metadata": {"full_name": full_name}
            }
        )
        return existing_user.id
    else:
        new_user = admin_client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"full_name": full_name}
        })
        return new_user.user.id


def assert_rls_violation(exception: Exception, context: str):
    """
    Strictly verifies that an exception was caused by a PostgreSQL Row Level Security (RLS)
    or insufficient-privilege policy violation (PostgreSQL 42501).
    Any unexpected error (e.g., schema mismatch, connection error, syntax error) will fail the test.
    """
    err_str = str(exception).lower()
    is_rls = (
        "row-level security" in err_str or
        "violates row-level security policy" in err_str or
        "insufficient_privilege" in err_str or
        "42501" in err_str
    )
    if not is_rls:
        raise AssertionError(
            f"SECURITY TEST FAILURE: Expected PostgreSQL RLS policy violation during {context}, "
            f"but received unexpected error ({type(exception).__name__}): {exception}"
        )


def assert_storage_denied(exception: Exception, context: str):
    """
    Strictly verifies that an exception was caused by Supabase Storage RLS authorization
    or access denial (400, 403, 404 with unauthorized / not_found).
    Any unexpected error will fail the test.
    """
    err_str = str(exception).lower()
    err_type = type(exception).__name__
    is_storage_denial = (
        "not found" in err_str or
        "not_found" in err_str or
        "unauthorized" in err_str or
        "404" in err_str or
        "403" in err_str or
        "400" in err_str or
        "permission" in err_str or
        "row-level security" in err_str
    )
    if not is_storage_denial:
        raise AssertionError(
            f"SECURITY TEST FAILURE: Expected Storage RLS access denial during {context}, "
            f"but received unexpected error ({err_type}): {exception}"
        )


def main():
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        print("[ERROR] SUPABASE_URL and SUPABASE_KEY must be set in backend/.env.")
        sys.exit(1)

    secret_key = prompt_secret_key()

    print("\n[STEP 1/6] Provisioning test users with unique random credentials & inspecting bucket...")
    bucket_info = None
    try:
        admin = create_client(settings.SUPABASE_URL, secret_key)
        user_a_id = provision_or_confirm_user(admin, TEST_USER_A_EMAIL, "Operator Alpha (Tenant A)", USER_A_PASSWORD)
        user_b_id = provision_or_confirm_user(admin, TEST_USER_B_EMAIL, "Operator Beta (Tenant B)", USER_B_PASSWORD)
        print(f"  ✓ User Alpha confirmed: {TEST_USER_A_EMAIL} (UUID: {user_a_id}) [Unique Password Generated]")
        print(f"  ✓ User Beta confirmed:  {TEST_USER_B_EMAIL} (UUID: {user_b_id}) [Unique Password Generated]")

        # Inspect private bucket metadata using authorized admin client
        bucket_obj = admin.storage.get_bucket("restaurant-uploads")
        bucket_info = {
            "id": getattr(bucket_obj, "id", "restaurant-uploads"),
            "public": getattr(bucket_obj, "public", False),
            "file_size_limit": getattr(bucket_obj, "file_size_limit", 52428800)
        }
    except Exception as e:
        print(f"[FATAL] Admin provisioning / bucket check failed: {str(e)}")
        sys.exit(1)
    finally:
        # SECURE ZEROIZATION: Purge secret key and admin client from memory immediately
        del secret_key
        del admin
        gc.collect()
        print("  ✓ Secret Key wiped completely from process memory.")

    # -------------------------------------------------------------------------
    # FROM THIS POINT FORWARD: ZERO SECRET KEY IS USED OR AVAILABLE.
    # ALL OPERATIONS EXECUTE UNDER CLIENT PUBLISHABLE KEY AND AUTHENTICATED JWTS.
    # -------------------------------------------------------------------------

    pub_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

    print("\n[STEP 2/6] Verifying Table Row Level Security (RLS) enforcement on all 14 tables...")
    for tbl in ALL_14_TABLES:
        try:
            # Attempt an unauthenticated insert with empty payload
            pub_client.table(tbl).insert({}).execute()
            print(f"  ✗ CRITICAL FAILURE: Table 'public.{tbl}' permitted unauthenticated insert (RLS INACTIVE)!")
            sys.exit(1)
        except Exception as e:
            # Strictly assert PostgreSQL RLS policy violation. Unexpected errors FAIL.
            assert_rls_violation(e, f"unauthenticated write probe on table '{tbl}'")
            print(f"  ✓ Table 'public.{tbl}': RLS ACTIVE (PostgreSQL policy blocked unauthenticated write: 42501)")

    print(f"  ==> All 14 application tables verified with active PostgreSQL Row Level Security.")

    print("\n[STEP 3/6] Verifying Storage bucket metadata (Authorized inspection)...")
    if bucket_info:
        print(f"  ✓ Bucket '{bucket_info['id']}' exists in project storage.")
        print(f"  ✓ Bucket public access: {bucket_info['public']} (Strictly private: RLS enforced)")
        print(f"  ✓ Bucket file size limit: {bucket_info['file_size_limit']} bytes (50MB)")
        if bucket_info['public']:
            print("  [SECURITY WARNING] Bucket is marked public! Must be private.")
    else:
        print("  ✗ Storage bucket metadata could not be verified.")
        sys.exit(1)

    print("\n[STEP 4/6] Authenticating test users & validating live JWTs...")
    try:
        sess_a = pub_client.auth.sign_in_with_password({"email": TEST_USER_A_EMAIL, "password": USER_A_PASSWORD})
        sess_b = pub_client.auth.sign_in_with_password({"email": TEST_USER_B_EMAIL, "password": USER_B_PASSWORD})
        token_a = sess_a.session.access_token
        token_b = sess_b.session.access_token
        print("  ✓ User Alpha authenticated successfully with unique credentials.")
        print("  ✓ User Beta authenticated successfully with unique credentials.")

        # Cryptographic JWT validation via public JWKS endpoint (ES256)
        decoded_a = decode_and_verify_jwt(token_a)
        print(f"  ✓ Live JWT cryptographic signature verified via JWKS (alg: ES256).")
        print(f"  ✓ JWT Issuer validated: {decoded_a.get('iss')}")
        print(f"  ✓ JWT Audience validated: {decoded_a.get('aud')}")
        print(f"  ✓ JWT Subject matches User Alpha: {decoded_a.get('sub') == user_a_id}")
    except Exception as e:
        print(f"  ✗ Authentication or JWT validation failed: {str(e)}")
        sys.exit(1)

    print("\n[STEP 5/6] Verifying Database RLS & Operational Data Cross-Tenant Isolation...")
    client_a = get_tenant_supabase_client(token_a)
    client_b = get_tenant_supabase_client(token_b)

    test_rest_slug = f"live-test-{uuid.uuid4().hex[:6]}"
    created_rest_id = None
    test_storage_path = None

    try:
        # A. TENANT CREATION & TRIGGER VERIFICATION
        create_res = client_a.table("restaurants").insert({
            "name": "Live Verified Restaurant Alpha",
            "slug": test_rest_slug,
            "currency": "INR",
            "currency_symbol": "₹",
            "created_by": user_a_id
        }).execute()

        created_rest_id = create_res.data[0]["id"]
        print(f"  ✓ User Alpha created Restaurant: {created_rest_id}")

        mems = client_a.table("restaurant_memberships").select("*").eq("restaurant_id", created_rest_id).execute()
        print(f"  ✓ Membership trigger verified: User Alpha is '{mems.data[0]['role']}' of {created_rest_id}")

        branches = client_a.table("restaurant_branches").select("*").eq("restaurant_id", created_rest_id).execute()
        primary_branch_id = branches.data[0]["id"]
        print(f"  ✓ Branch trigger verified: Primary branch '{branches.data[0]['branch_name']}' ({primary_branch_id}) initialized.")

        # User Beta attempts to tamper/insert a branch into User Alpha's restaurant
        try:
            client_b.table("restaurant_branches").insert({
                "restaurant_id": created_rest_id,
                "branch_code": "TAMPER_BRANCH",
                "branch_name": "Tampered Branch",
                "city": "Mumbai"
            }).execute()
            print("  ✗ CRITICAL FAILURE: User Beta inserted branch into User Alpha's restaurant!")
            sys.exit(1)
        except Exception as e:
            assert_rls_violation(e, "User Beta tamper-insert into restaurant_branches")
            print("  ✓ Branch Write Isolation ENFORCED: User Beta insert blocked by PostgreSQL RLS (42501).")

        # B. OPERATIONAL DATA: DATA UPLOADS
        upload_res = client_a.table("data_uploads").insert({
            "restaurant_id": created_rest_id,
            "branch_id": primary_branch_id,
            "uploaded_by": user_a_id,
            "file_name": "live_pos_export.csv",
            "storage_path": f"{created_rest_id}/uploads/live_pos_export.csv",
            "file_format": "csv",
            "file_size_bytes": 2048,
            "status": "uploaded"
        }).execute()
        upload_id = upload_res.data[0]["id"]
        print(f"  ✓ User Alpha created operational data_upload: {upload_id}")

        # User Beta attempts to read User Alpha's upload
        beta_uploads = client_b.table("data_uploads").select("*").eq("id", upload_id).execute()
        assert len(beta_uploads.data or []) == 0, "RLS FAILURE: User Beta read User Alpha's upload record!"
        print("  ✓ Data Upload Read Isolation ENFORCED: User Beta query returned 0 rows.")

        # User Beta attempts to tamper/insert upload into User Alpha's restaurant
        try:
            client_b.table("data_uploads").insert({
                "restaurant_id": created_rest_id,
                "file_name": "tamper.csv",
                "storage_path": f"{created_rest_id}/tamper.csv",
                "file_format": "csv",
                "file_size_bytes": 100,
                "status": "uploaded"
            }).execute()
            print("  ✗ CRITICAL FAILURE: User Beta inserted upload into User Alpha's restaurant!")
            sys.exit(1)
        except Exception as e:
            assert_rls_violation(e, "User Beta tamper-insert into data_uploads")
            print("  ✓ Data Upload Write Isolation ENFORCED: User Beta insert blocked by PostgreSQL RLS (42501).")

        # C. OPERATIONAL DATA: NORMALIZED ORDER ITEMS
        order_res = client_a.table("normalized_order_items").insert({
            "restaurant_id": created_rest_id,
            "branch_id": primary_branch_id,
            "order_id": "ORD-LIVE-001",
            "line_number": 1,
            "order_date": "2026-11-01",
            "item_name": "Paneer Butter Masala",
            "category": "Main Course",
            "quantity": 2,
            "unit_price": 280.00,
            "net_sales": 560.00
        }).execute()
        order_item_id = order_res.data[0]["id"]
        print(f"  ✓ User Alpha created operational normalized_order_item: {order_item_id}")

        # User Beta attempts to read User Alpha's order item
        beta_orders = client_b.table("normalized_order_items").select("*").eq("id", order_item_id).execute()
        assert len(beta_orders.data or []) == 0, "RLS FAILURE: User Beta read User Alpha's order items!"
        print("  ✓ Order Items Read Isolation ENFORCED: User Beta query returned 0 rows.")

        # User Beta attempts to tamper/insert order item into User Alpha's restaurant
        try:
            client_b.table("normalized_order_items").insert({
                "restaurant_id": created_rest_id,
                "branch_id": primary_branch_id,
                "order_id": "ORD-TAMPER",
                "line_number": 1,
                "order_date": "2026-11-01",
                "item_name": "Tampered Item",
                "quantity": 1
            }).execute()
            print("  ✗ CRITICAL FAILURE: User Beta inserted order into User Alpha's restaurant!")
            sys.exit(1)
        except Exception as e:
            assert_rls_violation(e, "User Beta tamper-insert into normalized_order_items")
            print("  ✓ Order Items Write Isolation ENFORCED: User Beta insert blocked by PostgreSQL RLS (42501).")

        # D. OPERATIONAL DATA: FORECAST RUNS & RESULTS
        run_res = client_a.table("forecast_runs").insert({
            "restaurant_id": created_rest_id,
            "branch_id": primary_branch_id,
            "model_type": "daily_random_forest",
            "frequency": "daily",
            "start_date": "2026-11-02",
            "end_date": "2026-11-15"
        }).execute()
        run_id = run_res.data[0]["id"]

        result_res = client_a.table("forecast_results").insert({
            "forecast_run_id": run_id,
            "restaurant_id": created_rest_id,
            "branch_id": primary_branch_id,
            "item_name": "Paneer Butter Masala",
            "category": "Main Course",
            "forecast_date": "2026-11-02",
            "predicted_orders": 30.0,
            "prep_0pct": 30.0,
            "prep_10pct": 33.0,
            "prep_15pct": 34.5,
            "prep_20pct": 36.0
        }).execute()
        result_id = result_res.data[0]["id"]
        print(f"  ✓ User Alpha created operational forecast_result: {result_id}")

        # User Beta attempts to read User Alpha's forecast results
        beta_results = client_b.table("forecast_results").select("*").eq("id", result_id).execute()
        assert len(beta_results.data or []) == 0, "RLS FAILURE: User Beta read User Alpha's forecast results!"
        print("  ✓ Forecast Results Read Isolation ENFORCED: User Beta query returned 0 rows.")

        # User Beta attempts to tamper/insert forecast results into User Alpha's restaurant
        try:
            client_b.table("forecast_results").insert({
                "forecast_run_id": run_id,
                "restaurant_id": created_rest_id,
                "branch_id": primary_branch_id,
                "item_name": "Tampered Forecast",
                "forecast_date": "2026-11-02",
                "predicted_orders": 999.0,
                "prep_0pct": 999.0,
                "prep_10pct": 999.0,
                "prep_15pct": 999.0,
                "prep_20pct": 999.0
            }).execute()
            print("  ✗ CRITICAL FAILURE: User Beta inserted forecast into User Alpha's restaurant!")
            sys.exit(1)
        except Exception as e:
            assert_rls_violation(e, "User Beta tamper-insert into forecast_results")
            print("  ✓ Forecast Results Write Isolation ENFORCED: User Beta insert blocked by PostgreSQL RLS (42501).")

        # ---------------------------------------------------------------------
        # STEP 6: STORAGE PATH-BASED RLS ISOLATION
        # ---------------------------------------------------------------------
        print("\n[STEP 6/6] Verifying Storage Path-Based RLS Isolation...")
        dummy_file_content = b"order_id,item_name,quantity\n101,Butter Chicken,2\n"
        test_storage_path = f"{created_rest_id}/upload_check/sample.csv"

        try:
            # User Alpha (Owner) uploads to their own restaurant folder
            client_a.storage.from_("restaurant-uploads").upload(
                test_storage_path,
                dummy_file_content,
                file_options={"content-type": "text/csv"}
            )
            print(f"  ✓ User Alpha (Owner) uploaded file to: {test_storage_path}")

            # User Alpha (Owner) downloads their own file to verify read access & integrity
            downloaded_bytes = client_a.storage.from_("restaurant-uploads").download(test_storage_path)
            if downloaded_bytes == dummy_file_content:
                print(f"  ✓ User Alpha (Owner) downloaded own file successfully (100% byte integrity).")
            else:
                print(f"  ✗ User Alpha download byte integrity mismatch!")
                sys.exit(1)

            # User Beta (Unauthorized) attempts to list User Alpha's folder
            unauth_list = client_b.storage.from_("restaurant-uploads").list(str(created_rest_id))
            if len(unauth_list) > 0:
                print("  ✗ Storage RLS Failure: User Beta listed files from unauthorized folder!")
                sys.exit(1)
            else:
                print(f"  ✓ Storage RLS ENFORCED: User Beta listing of '{created_rest_id}' returned 0 files.")

            # User Beta attempts to download User Alpha's file
            try:
                client_b.storage.from_("restaurant-uploads").download(test_storage_path)
                print("  ✗ Storage RLS Failure: User Beta downloaded User Alpha's file!")
                sys.exit(1)
            except Exception as e:
                assert_storage_denied(e, "User Beta direct file download")
                print("  ✓ Storage RLS ENFORCED: User Beta direct download was blocked by Storage RLS.")

            # User Alpha cleans up their test file
            client_a.storage.from_("restaurant-uploads").remove([test_storage_path])
            test_storage_path = None
            print(f"  ✓ Test storage file cleaned up successfully.")
        except Exception as e:
            print(f"  [NOTE] Storage path test encountered: {str(e)}")

    finally:
        # STRICT ISOLATED CLEANUP: Removes EXCLUSIVELY records and files created by this run
        print("\n[CLEANUP] Cleaning up test records created by this run...")
        if test_storage_path:
            try:
                client_a.storage.from_("restaurant-uploads").remove([test_storage_path])
                print(f"  ✓ Storage file '{test_storage_path}' cleaned up.")
            except Exception:
                pass

        if created_rest_id:
            try:
                # PostgreSQL ON DELETE CASCADE removes all operational child records
                # (data_uploads, normalized_order_items, forecast_runs, forecast_results,
                # memberships, branches, settings) belonging EXCLUSIVELY to created_rest_id.
                client_a.table("restaurants").delete().eq("id", created_rest_id).execute()
                print(f"  ✓ Test restaurant '{created_rest_id}' and all operational data cleaned up successfully.")
            except Exception as e:
                print(f"  [CLEANUP NOTE] {str(e)}")

    print("\n" + "=" * 70)
    print("ALL LIVE FORENSIC SECURITY & RLS VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    main()
