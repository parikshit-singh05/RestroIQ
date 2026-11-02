"""
RestroIQ 3.0 — Onboarding End-to-End Workflow & Idempotency Tests
Tests the complete onboarding flow for Operator Alpha:
1. Create organization, primary outlet, and operational preferences.
2. Verify settings record creation and retrieval.
3. Verify branch outlet creation and avoidance of duplicate branches.
4. Verify retry idempotency: repeating onboarding does NOT create duplicate restaurants or branches.
5. Verify both /api/v1/tenant/... and /tenant/... path resolutions return 200/201 (no 404s).
"""

import unittest
import uuid
from datetime import datetime, timezone
import jwt
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.tenant_service import tenant_service

TEST_SECRET = "test-jwt-secret-onboarding-test-suite"

def make_test_jwt(user_id: str, email: str, role: str = "authenticated") -> str:
    now = datetime.now(timezone.utc)
    iss = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1" if settings.SUPABASE_URL else "https://supabase.local/auth/v1"
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "aud": "authenticated",
        "iss": iss,
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + 7200,
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


class TestOnboardingWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        settings.SUPABASE_JWT_SECRET = TEST_SECRET
        tenant_service.reset_for_testing()
        cls.client = TestClient(app)

        cls.user_alpha_id = "92adb601-913f-47eb-967c-df72916576c2"
        cls.user_alpha_email = "operator_alpha@restroiq-ops.com"
        cls.alpha_token = make_test_jwt(cls.user_alpha_id, cls.user_alpha_email)
        cls.auth_headers = {"Authorization": f"Bearer {cls.alpha_token}"}

    def test_01_complete_onboarding_flow(self):
        """Step 1 (Org), Step 2 (Branch), Step 3 (Preferences) -> Launch Workspace."""
        # Step 1: Create restaurant with primary branch and preferences
        payload = {
            "name": "The Spice Garden Cafe & Bistro",
            "currency": "INR",
            "timezone": "Asia/Kolkata",
            "operational_model": "dine_in_and_delivery",
            "branch_name": "Indiranagar Outlet",
            "branch_code": "IND01",
            "city": "Bengaluru",
            "state": "Karnataka",
            "default_prep_buffer": 15,
            "default_forecasting_frequency": "daily"
        }

        # Verify both with and without /api/v1 prefix work
        resp = self.client.post("/api/v1/tenant/restaurants", json=payload, headers=self.auth_headers)
        self.assertEqual(resp.status_code, 201, f"Expected 201 Created: {resp.text}")
        data = resp.json()
        restaurant_id = data["id"]
        self.assertEqual(data["name"], "The Spice Garden Cafe & Bistro")
        self.assertEqual(data["user_role"], "owner")

        # Step 2: Ensure primary branch is synced
        branch_payload = {
            "branch_code": "IND01",
            "branch_name": "Indiranagar Outlet",
            "city": "Bengaluru",
            "state": "Karnataka",
            "is_primary": True
        }
        b_resp = self.client.post(f"/api/v1/tenant/restaurants/{restaurant_id}/branches", json=branch_payload, headers=self.auth_headers)
        self.assertEqual(b_resp.status_code, 201)
        b_data = b_resp.json()
        self.assertEqual(b_data["branch_code"], "IND01")
        self.assertTrue(b_data["is_primary"])

        # Verify exactly ONE primary branch exists (no duplicate MAIN + IND01)
        branches_resp = self.client.get(f"/api/v1/tenant/restaurants/{restaurant_id}/branches", headers=self.auth_headers)
        self.assertEqual(branches_resp.status_code, 200)
        branches = branches_resp.json()
        self.assertEqual(len(branches), 1, f"Expected exactly 1 branch, got: {branches}")
        self.assertEqual(branches[0]["branch_code"], "IND01")

        # Step 3: Operational Preferences
        settings_payload = {
            "default_prep_buffer": 20,
            "default_forecasting_frequency": "daily",
            "auto_forecast_on_upload": True
        }
        s_resp = self.client.put(f"/api/v1/tenant/restaurants/{restaurant_id}/settings", json=settings_payload, headers=self.auth_headers)
        self.assertEqual(s_resp.status_code, 200, f"Expected 200 OK: {s_resp.text}")
        s_data = s_resp.json()
        self.assertEqual(s_data["default_prep_buffer"], 20)
        self.assertEqual(s_data["default_forecasting_frequency"], "daily")

        # Verify settings retrieval
        get_s_resp = self.client.get(f"/api/v1/tenant/restaurants/{restaurant_id}/settings", headers=self.auth_headers)
        self.assertEqual(get_s_resp.status_code, 200)
        self.assertEqual(get_s_resp.json()["default_prep_buffer"], 20)

    def test_02_retry_onboarding_does_not_create_duplicates(self):
        """Retrying onboarding with the same name returns existing restaurant and branch."""
        payload = {
            "name": "The Spice Garden Cafe & Bistro",
            "currency": "INR",
            "timezone": "Asia/Kolkata",
            "operational_model": "dine_in_and_delivery",
            "branch_name": "Indiranagar Outlet",
            "branch_code": "IND01",
            "city": "Bengaluru",
            "state": "Karnataka",
            "default_prep_buffer": 10,
            "default_forecasting_frequency": "daily"
        }

        # Post again as if user clicked Launch Workspace after an error
        resp = self.client.post("/api/v1/tenant/restaurants", json=payload, headers=self.auth_headers)
        self.assertIn(resp.status_code, (200, 201))
        data = resp.json()
        restaurant_id = data["id"]

        # Confirm user only has 1 restaurant
        my_rests = self.client.get("/api/v1/tenant/restaurants", headers=self.auth_headers).json()
        self.assertEqual(len(my_rests), 1, "Must not create duplicate restaurants on onboarding retry")

        # Confirm branch count remains 1
        branches = self.client.get(f"/api/v1/tenant/restaurants/{restaurant_id}/branches", headers=self.auth_headers).json()
        self.assertEqual(len(branches), 1, "Must not create duplicate branches on onboarding retry")

    def test_03_root_and_v1_path_resolution(self):
        """Verifies both /tenant/restaurants and /api/v1/tenant/restaurants resolve without 404."""
        resp_v1 = self.client.get("/api/v1/tenant/restaurants", headers=self.auth_headers)
        self.assertEqual(resp_v1.status_code, 200)

        resp_root = self.client.get("/tenant/restaurants", headers=self.auth_headers)
        self.assertEqual(resp_root.status_code, 200)

        self.assertEqual(len(resp_v1.json()), len(resp_root.json()))


if __name__ == "__main__":
    unittest.main()

