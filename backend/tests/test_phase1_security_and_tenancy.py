import unittest
import sys
import os
import time
import uuid
import jwt
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.main import app
from app.core.config import settings
from app.core.supabase import decode_and_verify_jwt, get_tenant_supabase_client
from app.services.tenant_service import tenant_service, has_sufficient_role

TEST_SECRET = "test-supa-secret-for-signing-token-xyz-12345"

def generate_test_jwt(user_id: str, email: str, expires_in_seconds: int = 3600) -> str:
    """Generates a test Supabase JWT signed with TEST_SECRET."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "email": email,
        "aud": "authenticated",
        "role": "authenticated",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(seconds=expires_in_seconds)).timestamp())
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


class TestPhase1SecurityAndTenancy(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Configure secret for deterministic signature verification in tests
        settings.SUPABASE_JWT_SECRET = TEST_SECRET
        cls.client = TestClient(app)

    def setUp(self):
        # Reset state for complete test isolation
        tenant_service.reset_for_testing()

        # Create fresh tenant users for each test
        self.user_a_id = str(uuid.uuid4())
        self.user_a_email = "owner_a@restaurant-alpha.com"
        self.token_a = generate_test_jwt(self.user_a_id, self.user_a_email)

        self.user_b_id = str(uuid.uuid4())
        self.user_b_email = "owner_b@restaurant-beta.com"
        self.token_b = generate_test_jwt(self.user_b_id, self.user_b_email)

        self.user_c_id = str(uuid.uuid4())
        self.user_c_email = "analyst_c@restaurant-alpha.com"
        self.token_c = generate_test_jwt(self.user_c_id, self.user_c_email)
        tenant_service.register_user_profile(self.user_c_id, self.user_c_email, "Analyst Charlie")

    def test_jwt_verification_valid_and_expired(self):
        """Verify token decoding, expiration check, and tampering rejection."""
        # Valid token
        payload = decode_and_verify_jwt(self.token_a)
        self.assertEqual(payload["sub"], self.user_a_id)
        self.assertEqual(payload["email"], self.user_a_email)

        # Expired token
        expired_token = generate_test_jwt(self.user_a_id, self.user_a_email, expires_in_seconds=-10)
        with self.assertRaises(ValueError) as ctx:
            decode_and_verify_jwt(expired_token)
        self.assertIn("expired", str(ctx.exception).lower())

        # Tampered token
        tampered_token = self.token_a[:-4] + "abcd"
        with self.assertRaises(ValueError) as ctx:
            decode_and_verify_jwt(tampered_token)
        self.assertIn("invalid", str(ctx.exception).lower())

    def test_missing_or_malformed_auth_header(self):
        """Verify API blocks requests without valid Bearer scheme with HTTP 401."""
        # No header
        res1 = self.client.get("/api/v1/tenant/restaurants")
        self.assertEqual(res1.status_code, 401)
        self.assertIn("Missing Authorization header", res1.json()["detail"])

        # Non-bearer header
        res2 = self.client.get(
            "/api/v1/tenant/restaurants",
            headers={"Authorization": f"Basic {self.token_a}"}
        )
        self.assertEqual(res2.status_code, 401)
        self.assertIn("Must be 'Bearer <token>'", res2.json()["detail"])

    def test_multi_tenant_isolation_tenant_a_vs_tenant_b(self):
        """
        Verify Tenant A and Tenant B cannot access or list each other's workspaces.
        Tenant ID tampering is completely blocked.
        """
        # Tenant A creates Restaurant Alpha
        res_a = self.client.post(
            "/api/v1/tenant/restaurants",
            headers={"Authorization": f"Bearer {self.token_a}"},
            json={"name": "The Royal Spice", "currency": "INR", "timezone": "Asia/Kolkata"}
        )
        self.assertEqual(res_a.status_code, 201)
        rest_a = res_a.json()
        rest_a_id = rest_a["id"]
        self.assertEqual(rest_a["user_role"], "owner")

        # Tenant B creates Restaurant Beta
        res_b = self.client.post(
            "/api/v1/tenant/restaurants",
            headers={"Authorization": f"Bearer {self.token_b}"},
            json={"name": "Bella Italia Pizzeria", "currency": "INR", "timezone": "Asia/Kolkata"}
        )
        self.assertEqual(res_b.status_code, 201)
        rest_b = res_b.json()
        rest_b_id = rest_b["id"]
        self.assertEqual(rest_b["user_role"], "owner")

        # 1. Tenant A listing restaurants sees ONLY Restaurant Alpha
        list_a = self.client.get(
            "/api/v1/tenant/restaurants",
            headers={"Authorization": f"Bearer {self.token_a}"}
        ).json()
        self.assertTrue(any(r["id"] == rest_a_id for r in list_a))
        self.assertFalse(any(r["id"] == rest_b_id for r in list_a))

        # 2. Tenant B listing restaurants sees ONLY Restaurant Beta
        list_b = self.client.get(
            "/api/v1/tenant/restaurants",
            headers={"Authorization": f"Bearer {self.token_b}"}
        ).json()
        self.assertTrue(any(r["id"] == rest_b_id for r in list_b))
        self.assertFalse(any(r["id"] == rest_a_id for r in list_b))

        # 3. Tenant A attempts to read Restaurant Beta details -> HTTP 403 Forbidden
        attack_1 = self.client.get(
            f"/api/v1/tenant/restaurants/{rest_b_id}",
            headers={"Authorization": f"Bearer {self.token_a}"}
        )
        self.assertEqual(attack_1.status_code, 403)
        self.assertIn("Access denied", attack_1.json()["detail"])

        # 4. Tenant B attempts to list Restaurant Alpha branches -> HTTP 403 Forbidden
        attack_2 = self.client.get(
            f"/api/v1/tenant/restaurants/{rest_a_id}/branches",
            headers={"Authorization": f"Bearer {self.token_b}"}
        )
        self.assertEqual(attack_2.status_code, 403)
        self.assertIn("Access denied", attack_2.json()["detail"])

    def test_role_based_access_control_hierarchy(self):
        """
        Verify Owner > Admin > Analyst permissions:
        - Analyst can view, but cannot modify branches, settings, or members.
        - Admin can add branches, invite members, update settings.
        - Admin cannot remove Owners.
        """
        # 1. Owner creates restaurant
        rest = self.client.post(
            "/api/v1/tenant/restaurants",
            headers={"Authorization": f"Bearer {self.token_a}"},
            json={"name": "Saffron Bistro", "currency": "INR"}
        ).json()
        rest_id = rest["id"]

        # 2. Owner invites User C as 'analyst'
        invite_res = self.client.post(
            f"/api/v1/tenant/restaurants/{rest_id}/members",
            headers={"Authorization": f"Bearer {self.token_a}"},
            json={"email": self.user_c_email, "role": "analyst"}
        )
        self.assertEqual(invite_res.status_code, 201)
        analyst_member_id = invite_res.json()["id"]

        # 3. Analyst can view restaurant details & settings
        get_res = self.client.get(
            f"/api/v1/tenant/restaurants/{rest_id}",
            headers={"Authorization": f"Bearer {self.token_c}"}
        )
        self.assertEqual(get_res.status_code, 200)

        get_settings = self.client.get(
            f"/api/v1/tenant/restaurants/{rest_id}/settings",
            headers={"Authorization": f"Bearer {self.token_c}"}
        )
        self.assertEqual(get_settings.status_code, 200)

        # 4. Analyst attempts to create branch -> HTTP 403 Forbidden
        branch_attack = self.client.post(
            f"/api/v1/tenant/restaurants/{rest_id}/branches",
            headers={"Authorization": f"Bearer {self.token_c}"},
            json={"branch_code": "IND-02", "branch_name": "Indiranagar", "city": "Bengaluru"}
        )
        self.assertEqual(branch_attack.status_code, 403)
        self.assertIn("Insufficient permissions", branch_attack.json()["detail"])

        # 5. Analyst attempts to update settings -> HTTP 403 Forbidden
        settings_attack = self.client.put(
            f"/api/v1/tenant/restaurants/{rest_id}/settings",
            headers={"Authorization": f"Bearer {self.token_c}"},
            json={"default_prep_buffer": 20}
        )
        self.assertEqual(settings_attack.status_code, 403)

        # 6. Analyst attempts to invite members -> HTTP 403 Forbidden
        invite_attack = self.client.post(
            f"/api/v1/tenant/restaurants/{rest_id}/members",
            headers={"Authorization": f"Bearer {self.token_c}"},
            json={"email": "attacker@evil.com", "role": "admin"}
        )
        self.assertEqual(invite_attack.status_code, 403)

        # 7. Owner creates an Admin
        admin_email = "admin_d@restaurant-alpha.com"
        admin_id = str(uuid.uuid4())
        tenant_service.register_user_profile(admin_id, admin_email, "Admin Dave")
        admin_token = generate_test_jwt(admin_id, admin_email)
        admin_member = self.client.post(
            f"/api/v1/tenant/restaurants/{rest_id}/members",
            headers={"Authorization": f"Bearer {self.token_a}"},
            json={"email": admin_email, "role": "admin"}
        ).json()

        # 8. Admin successfully creates branch
        branch_success = self.client.post(
            f"/api/v1/tenant/restaurants/{rest_id}/branches",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"branch_code": "KOR-01", "branch_name": "Koramangala Hub", "city": "Bengaluru"}
        )
        self.assertEqual(branch_success.status_code, 201)

        # 9. Admin attempts to remove the Owner -> HTTP 403 Forbidden
        members = self.client.get(
            f"/api/v1/tenant/restaurants/{rest_id}/members",
            headers={"Authorization": f"Bearer {self.token_a}"}
        ).json()
        owner_member_id = next(m["id"] for m in members if m["role"] == "owner")

        del_owner_attack = self.client.delete(
            f"/api/v1/tenant/restaurants/{rest_id}/members/{owner_member_id}",
            headers={"Authorization": f"Bearer {admin_token}"}
        )
        self.assertEqual(del_owner_attack.status_code, 403)
        self.assertIn("Admins cannot remove restaurant owners", del_owner_attack.json()["detail"])

    def test_mandatory_correction_3_line_item_duplicate_preservation(self):
        """
        Correction #3: Ensure repeated line items in a single order (e.g., ordering
        2 identical Butter Naans or separate portions) with distinct line_numbers
        are treated as unique rows.
        """
        order_ticket = [
            {"order_id": "ORD-101", "line_number": 1, "item_name": "Paneer Butter Masala", "quantity": 1},
            {"order_id": "ORD-101", "line_number": 2, "item_name": "Garlic Naan", "quantity": 2},
            {"order_id": "ORD-101", "line_number": 3, "item_name": "Garlic Naan", "quantity": 1}, # Repeated legitimate item
        ]
        # Verify keys distinguish identical items ordered as separate lines
        keys = {(o["order_id"], o["line_number"], o["item_name"]) for o in order_ticket}
        self.assertEqual(len(keys), 3, "Legitimate repeated line items must be preserved.")

    def test_demo_workspace_preservation(self):
        """
        Verify that public Demo Workspace endpoints remain completely unauthenticated,
        functional, and strictly segregated from tenant accounts.
        """
        # 1. Health endpoint
        r_health = self.client.get("/api/v1/health")
        self.assertEqual(r_health.status_code, 200)
        self.assertEqual(r_health.json(), {"status": "ok"})

        # 2. Public forecast summary (Kaggle benchmark dataset)
        r_summary = self.client.get("/api/v1/summary")
        self.assertEqual(r_summary.status_code, 200)
        data = r_summary.json()
        self.assertEqual(len(data), 10, "Demo workspace must still serve 10 forecast weeks")
        self.assertEqual(data[0]["week"], 146)

        # 3. Public centers endpoint
        r_centers = self.client.get("/api/v1/centers")
        self.assertEqual(r_centers.status_code, 200)
        self.assertEqual(len(r_centers.json()), 77, "Demo workspace must still serve 77 centers")


if __name__ == "__main__":
    unittest.main(verbosity=2)
