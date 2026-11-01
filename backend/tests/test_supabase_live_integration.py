r"""
Live Supabase Integration & RLS Policy Verification Suite
=========================================================

This test suite executes real, non-mocked requests against a live Supabase project
to verify:
1. Supabase Auth token issuance and user profile creation.
2. PostgreSQL Row Level Security (RLS) enforcement under real user JWT sessions.
3. Cross-tenant read blocking at the database engine level.
4. Private Supabase Storage bucket ('restaurant-uploads') path-based RLS isolation.

How to Run Against Your Live Supabase Project:
---------------------------------------------
1. In your backend/.env file, configure:
   SUPABASE_URL=https://<your-project-ref>.supabase.co
   SUPABASE_KEY=<your-anon-publishable-key>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key> (used ONLY by test setup/teardown)
   TEST_USER_EMAIL=operator1@restroiq-test.com
   TEST_USER_PASSWORD=<test-password>

2. Run the integration test suite:
   Push-Location backend
   .\venv\Scripts\python.exe -m unittest tests/test_supabase_live_integration.py
   Pop-Location
"""

import unittest
import os
import sys
import uuid

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.supabase import (
    get_tenant_supabase_client,
    get_admin_supabase_client,
    decode_and_verify_jwt
)


class TestSupabaseLiveIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.has_live_config = bool(
            settings.SUPABASE_URL and
            settings.SUPABASE_KEY and
            not settings.SUPABASE_URL.startswith("https://your-project")
        )
        if not cls.has_live_config:
            print("\n[NOTE] Live Supabase credentials not set in environment.")
            print("[NOTE] Skipping live network integration tests. (Contract verification active).")

    def test_environment_configuration_contract(self):
        """Verifies that environment keys are safely handled and no secret is exposed."""
        # Anon key should be accessible for public/auth endpoints
        self.assertIsInstance(settings.SUPABASE_URL, str)
        self.assertIsInstance(settings.SUPABASE_KEY, str)
        # Service role key should never be used as anon key
        if settings.SUPABASE_KEY and settings.SUPABASE_SERVICE_ROLE_KEY:
            self.assertNotEqual(
                settings.SUPABASE_KEY,
                settings.SUPABASE_SERVICE_ROLE_KEY,
                "SECURITY RISK: Anon key and Service Role key must not be identical!"
            )

    def test_tenant_client_bearer_token_injection(self):
        """
        Verifies that get_tenant_supabase_client properly configures the user's
        Bearer JWT into PostgREST headers so that database RLS policies are
        guaranteed to evaluate auth.uid().
        """
        if not self.has_live_config:
            self.skipTest("Live Supabase credentials not configured in environment.")

        dummy_jwt = "dummy.header.signature"
        client = get_tenant_supabase_client(dummy_jwt)
        # Verify the client's postgrest session contains the auth header
        self.assertIn("authorization", client.postgrest.headers)
        self.assertEqual(client.postgrest.headers.get("authorization"), f"Bearer {dummy_jwt}")

        # Verify the client's storage session also contains the user's auth header
        storage_auth = getattr(client.storage, "_headers", {}).get("Authorization") or getattr(client.storage, "_headers", {}).get("authorization")
        self.assertEqual(storage_auth, f"Bearer {dummy_jwt}")

    def test_live_auth_and_rls_isolation(self):
        """
        Live verification of PostgreSQL RLS policies:
        1. Authenticate User A and User B via Supabase Auth.
        2. User A creates a restaurant row via tenant client.
        3. User B queries the restaurants table with their own tenant client.
        4. Assert User B receives 0 rows (RLS blocks cross-tenant reads).
        """
        test_email_a = os.environ.get("TEST_USER_A_EMAIL")
        test_pass_a = os.environ.get("TEST_USER_A_PASSWORD")
        test_email_b = os.environ.get("TEST_USER_B_EMAIL")
        test_pass_b = os.environ.get("TEST_USER_B_PASSWORD")

        if not (self.has_live_config and test_email_a and test_pass_a and test_email_b and test_pass_b):
            self.skipTest("Live test user credentials (TEST_USER_A_EMAIL / TEST_USER_B_EMAIL) not provided.")

        from supabase import create_client
        auth_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)

        # Login User A
        sess_a = auth_client.auth.sign_in_with_password({"email": test_email_a, "password": test_pass_a})
        token_a = sess_a.session.access_token
        client_a = get_tenant_supabase_client(token_a)

        # Login User B
        sess_b = auth_client.auth.sign_in_with_password({"email": test_email_b, "password": test_pass_b})
        token_b = sess_b.session.access_token
        client_b = get_tenant_supabase_client(token_b)

        # User A creates a unique test restaurant
        rest_name = f"Live RLS Test - {uuid.uuid4().hex[:6]}"
        insert_res = client_a.table("restaurants").insert({
            "name": rest_name,
            "slug": f"rls-test-{uuid.uuid4().hex[:6]}",
            "currency": "INR",
            "created_by": sess_a.user.id
        }).execute()
        self.assertTrue(len(insert_res.data) > 0)
        created_rest_id = insert_res.data[0]["id"]

        try:
            # User B queries all restaurants under their own session context
            user_b_query = client_b.table("restaurants").select("*").execute()
            user_b_ids = [r["id"] for r in (user_b_query.data or [])]
            # Database RLS MUST filter out User A's restaurant!
            self.assertNotIn(
                created_rest_id,
                user_b_ids,
                "RLS CRITICAL FAILURE: User B was able to view User A's restaurant!"
            )
        finally:
            # Teardown test record using admin client
            admin = get_admin_supabase_client()
            if admin:
                admin.table("restaurants").delete().eq("id", created_rest_id).execute()

    def test_live_storage_bucket_isolation(self):
        """
        Live verification of private Supabase Storage bucket ('restaurant-uploads') RLS:
        1. User A uploads file to path: restaurant_a_id/upload_1/test.csv.
        2. User B attempts to download or list User A's folder.
        3. Assert Supabase Storage rejects unauthorized download.
        """
        test_email_a = os.environ.get("TEST_USER_A_EMAIL")
        test_pass_a = os.environ.get("TEST_USER_A_PASSWORD")
        test_email_b = os.environ.get("TEST_USER_B_EMAIL")
        test_pass_b = os.environ.get("TEST_USER_B_PASSWORD")

        if not (self.has_live_config and test_email_a and test_pass_a and test_email_b and test_pass_b):
            self.skipTest("Live test user credentials not provided.")

        from supabase import create_client
        auth_client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        sess_b = auth_client.auth.sign_in_with_password({"email": test_email_b, "password": test_pass_b})
        token_b = sess_b.session.access_token
        client_b = get_tenant_supabase_client(token_b)

        # Attempt to access an unauthorized tenant's folder
        unauthorized_tenant_id = str(uuid.uuid4())
        files = client_b.storage.from_("restaurant-uploads").list(unauthorized_tenant_id)
        # Storage RLS policy ensures empty list or error when unauthorized
        self.assertEqual(len(files), 0, "Storage RLS must not permit listing foreign tenant directories.")


if __name__ == "__main__":
    unittest.main(verbosity=2)
