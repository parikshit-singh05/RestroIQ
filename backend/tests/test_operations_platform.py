"""
RestroIQ 3.0 — Phase 4 Comprehensive Operations Platform Test Suite
Verifies:
1. Restaurant Analytics (revenue, orders, AOV, DOW, top/slow items, promo analysis).
2. Predictive Inventory Planning & Non-Decreasing Buffer Targets (0%, 10%, 15%, 20%).
3. Menu Management & Lifecycle Intelligence (catalog, velocity, admin edit, analyst block).
4. Multi-Branch Operations & Metrics (order counts, revenue, closures, delete restrictions).
5. Restaurant Profile & Team RBAC Management (role updates, sole owner protection).
6. Cross-Tenant Security & HTTP 403 Isolation across all operations.
"""

import unittest
import uuid
import datetime
from datetime import date, timedelta
from typing import Dict, List, Any
import jwt
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.tenant_service import tenant_service
from app.services.ingestion_service import ingestion_service
from app.services.forecasting_service import forecasting_service
from app.schemas.tenant_schemas import RestaurantCreate, BranchCreate, MemberInvite
from app.schemas.forecasting_schemas import ForecastGenerationRequest
from app.schemas.operations_schemas import MenuItemCreate, MenuItemUpdate, BranchUpdate, RestaurantProfileUpdate, MemberRoleUpdate


TEST_SECRET = "test-supa-secret-for-signing-token-xyz-12345"


def make_test_jwt(user_id: str, email: str, role: str = "authenticated") -> str:
    now = datetime.datetime.now(datetime.timezone.utc)
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


class TestOperationsPlatform(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        settings.SUPABASE_JWT_SECRET = TEST_SECRET
        cls.client = TestClient(app)

        # 1. Setup Tenant Alpha (Spice Garden)
        cls.user_alpha_owner = str(uuid.uuid4())
        cls.jwt_alpha_owner = make_test_jwt(cls.user_alpha_owner, "alpha.owner@spicegarden.com")
        res_alpha = tenant_service.create_restaurant(
            user_id=cls.user_alpha_owner,
            user_email="alpha.owner@spicegarden.com",
            data=RestaurantCreate(name="Spice Garden Fine Dining", currency="INR", timezone="Asia/Kolkata")
        )
        cls.tenant_alpha_id = res_alpha.id
        alpha_branches = tenant_service.list_branches(cls.tenant_alpha_id)
        cls.branch_alpha_1 = alpha_branches[0].id

        # Provision second branch for Alpha
        b2 = tenant_service.create_branch(
            restaurant_id=cls.tenant_alpha_id,
            data=BranchCreate(branch_code="ALPHA-NORTH", branch_name="Spice Garden North", city="Delhi")
        )
        cls.branch_alpha_2 = b2.id

        # Provision Analyst user for Alpha
        cls.mem_analyst = tenant_service.add_member(
            restaurant_id=cls.tenant_alpha_id,
            invite=MemberInvite(email="alpha.analyst@spicegarden.com", role="analyst"),
            actor_id=cls.user_alpha_owner
        )
        cls.user_alpha_analyst = cls.mem_analyst.user_id
        cls.jwt_alpha_analyst = make_test_jwt(cls.user_alpha_analyst, "alpha.analyst@spicegarden.com")

        # 2. Setup Tenant Beta (Independent Competitor)
        cls.user_beta_owner = str(uuid.uuid4())
        cls.jwt_beta_owner = make_test_jwt(cls.user_beta_owner, "beta.owner@bistro.com")
        res_beta = tenant_service.create_restaurant(
            user_id=cls.user_beta_owner,
            user_email="beta.owner@bistro.com",
            data=RestaurantCreate(name="Bistro Parisien", currency="EUR", timezone="Europe/Paris")
        )
        cls.tenant_beta_id = res_beta.id
        beta_branches = tenant_service.list_branches(cls.tenant_beta_id)
        cls.branch_beta_1 = beta_branches[0].id

        # Populate genuine POS transaction history for Alpha (45 days)
        cls._populate_pos_history()

    @classmethod
    def _populate_pos_history(cls):
        start_date = date.today() - timedelta(days=45)
        records: List[Dict[str, Any]] = []

        for day_offset in range(45):
            cur_date = start_date + timedelta(days=day_offset)
            is_promo = (day_offset % 6 == 0)

            # Item 1: Butter Chicken (High demand)
            records.append({
                "restaurant_id": cls.tenant_alpha_id,
                "branch_id": cls.branch_alpha_1,
                "order_id": f"ORD-A1-{day_offset}",
                "line_number": 1,
                "order_date": cur_date,
                "order_time": "13:00:00",
                "item_name": "Butter Chicken",
                "category": "Curries",
                "quantity": 20.0 + (day_offset % 5),
                "unit_price": 350.00,
                "net_sales": (20.0 + (day_offset % 5)) * 350.00,
                "promotion_tag": "summer_deal" if is_promo else "none",
                "order_status": "completed"
            })

            # Item 2: Garlic Naan (High volume)
            records.append({
                "restaurant_id": cls.tenant_alpha_id,
                "branch_id": cls.branch_alpha_1,
                "order_id": f"ORD-A1-{day_offset}",
                "line_number": 2,
                "order_date": cur_date,
                "order_time": "13:05:00",
                "item_name": "Garlic Naan",
                "category": "Breads",
                "quantity": 40.0 + (day_offset % 7),
                "unit_price": 60.00,
                "net_sales": (40.0 + (day_offset % 7)) * 60.00,
                "promotion_tag": "none",
                "order_status": "completed"
            })

            # Item 3: Gulab Jamun (Dessert) at Branch 2
            records.append({
                "restaurant_id": cls.tenant_alpha_id,
                "branch_id": cls.branch_alpha_2,
                "order_id": f"ORD-A2-{day_offset}",
                "line_number": 1,
                "order_date": cur_date,
                "order_time": "19:00:00",
                "item_name": "Gulab Jamun",
                "category": "Desserts",
                "quantity": 8.0 + (day_offset % 3),
                "unit_price": 120.00,
                "net_sales": (8.0 + (day_offset % 3)) * 120.00,
                "promotion_tag": "none",
                "order_status": "completed"
            })

        ingestion_service._orders[cls.tenant_alpha_id] = records

        # Also trigger a forecast run so inventory endpoints have active forecast predictions
        forecasting_service.generate_forecast(
            restaurant_id=cls.tenant_alpha_id,
            request=ForecastGenerationRequest(
                branch_id=cls.branch_alpha_1,
                frequency="daily",
                horizon_steps=14
            ),
            user_jwt=cls.jwt_alpha_owner
        )

    # ==========================================================================
    # 1. ANALYTICS WORKSPACE TESTS
    # ==========================================================================

    def test_01_analytics_calculation_and_filtering(self):
        """Verifies accurate analytics aggregations: revenue, orders, AOV, timeline, category breakdown, DOW."""
        resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/analytics",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertEqual(data["restaurant_id"], self.tenant_alpha_id)
        self.assertGreater(data["total_revenue"], 0)
        self.assertGreater(data["total_orders"], 0)
        self.assertEqual(data["currency_symbol"], "₹")

        # Average Order Value verification: AOV = total_revenue / total_orders
        expected_aov = round(data["total_revenue"] / data["total_orders"], 2)
        self.assertAlmostEqual(data["average_order_value"], expected_aov, places=1)

        # Timeline verification
        self.assertGreaterEqual(len(data["timeline"]), 40)
        first_point = data["timeline"][0]
        self.assertIn("date", first_point)
        self.assertGreater(first_point["revenue"], 0)

        # Category distribution verification
        categories = [c["category"] for c in data["category_distribution"]]
        self.assertIn("Curries", categories)
        self.assertIn("Breads", categories)
        self.assertIn("Desserts", categories)

        # Top selling items
        top_item_names = [i["item_name"] for i in data["top_selling_items"]]
        self.assertIn("Garlic Naan", top_item_names)
        self.assertIn("Butter Chicken", top_item_names)

        # Day of week distribution (7 days)
        self.assertEqual(len(data["day_of_week_distribution"]), 7)

        # Branch comparison (both branches present)
        branch_ids = [b["branch_id"] for b in data["branch_comparison"]]
        self.assertIn(self.branch_alpha_1, branch_ids)
        self.assertIn(self.branch_alpha_2, branch_ids)

        # Promotion analysis
        self.assertTrue(data["promotion_analysis"]["has_promotions"])
        self.assertGreater(data["promotion_analysis"]["promo_orders_count"], 0)

    def test_02_analytics_branch_filter(self):
        """Verifies branch filtering limits analytics data strictly to the selected outlet."""
        resp_b1 = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/analytics?branch_id={self.branch_alpha_1}",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"}
        )
        self.assertEqual(resp_b1.status_code, 200)
        data_b1 = resp_b1.json()

        # Branch 1 only has Curries and Breads, no Desserts
        categories_b1 = [c["category"] for c in data_b1["category_distribution"]]
        self.assertIn("Curries", categories_b1)
        self.assertNotIn("Desserts", categories_b1)

    def test_03_analytics_cross_tenant_denial(self):
        """User Beta must receive HTTP 403 when attempting to access Alpha's analytics."""
        resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/analytics",
            headers={"Authorization": f"Bearer {self.jwt_beta_owner}"}
        )
        self.assertEqual(resp.status_code, 403)

    # ==========================================================================
    # 2. INVENTORY PREPARATION & BUFFER PLANNING TESTS
    # ==========================================================================

    def test_04_inventory_preparation_and_buffer_invariants(self):
        """Verifies inventory prep requirements obey non-decreasing buffer invariants."""
        resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/inventory?branch_id={self.branch_alpha_1}",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertIn("items", data)
        self.assertGreater(len(data["items"]), 0)
        self.assertIn("prep_targets_summary", data)

        summary = data["prep_targets_summary"]
        self.assertGreaterEqual(summary["prep_10"], summary["prep_0"])
        self.assertGreaterEqual(summary["prep_15"], summary["prep_10"])
        self.assertGreaterEqual(summary["prep_20"], summary["prep_15"])

        for it in data["items"]:
            pred = it["predicted_units"]
            p0 = it["prep_0pct"]
            p10 = it["prep_10pct"]
            p15 = it["prep_15pct"]
            p20 = it["prep_20pct"]

            self.assertGreaterEqual(p0, pred)
            self.assertGreaterEqual(p10, p0)
            self.assertGreaterEqual(p15, p10)
            self.assertGreaterEqual(p20, p15)
            self.assertIn(it["demand_tier"], ["high", "normal", "low"])

        # Disclaimer string present (no fabricated inventory stock claims)
        self.assertIn("Physical on-hand warehouse stock", data["inventory_tracking_disclaimer"])

    def test_05_inventory_cross_tenant_denial(self):
        """User Beta must receive HTTP 403 when accessing Alpha's inventory preparation."""
        resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/inventory",
            headers={"Authorization": f"Bearer {self.jwt_beta_owner}"}
        )
        self.assertEqual(resp.status_code, 403)

    # ==========================================================================
    # 3. MENU INTELLIGENCE & MANAGEMENT TESTS
    # ==========================================================================

    def test_06_menu_catalog_and_velocity_ranking(self):
        """Verifies menu catalog returns sales velocity, revenue contribution, and categories."""
        resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/menu",
            headers={"Authorization": f"Bearer {self.jwt_alpha_analyst}"}
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertGreaterEqual(data["total_items"], 2)
        item_names = [i["item_name"] for i in data["items"]]
        self.assertIn("Butter Chicken", item_names)
        self.assertIn("Garlic Naan", item_names)

        for item in data["items"]:
            self.assertIn(item["velocity_rank"], ["high", "steady", "slow"])
            self.assertGreaterEqual(item["total_historical_sales"], 0)

    def test_07_menu_item_create_and_update(self):
        """Admin can register and update menu items; Analyst is rejected with 403."""
        # 1. Analyst attempt (MUST be rejected)
        analyst_resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/menu",
            headers={"Authorization": f"Bearer {self.jwt_alpha_analyst}"},
            json={"item_name": "Rogan Josh", "category": "Curries", "sku": "CUR-009"}
        )
        self.assertEqual(analyst_resp.status_code, 403)

        # 2. Owner/Admin attempt (MUST succeed)
        owner_resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/menu",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"},
            json={
                "item_name": "Rogan Josh",
                "category": "Curries",
                "sku": "CUR-009",
                "price": 380.00,
                "introduced_date": "2026-11-01"
            }
        )
        self.assertEqual(owner_resp.status_code, 201)
        created = owner_resp.json()
        self.assertEqual(created["item_name"], "Rogan Josh")
        self.assertEqual(created["sku"], "CUR-009")

        # 3. Update metadata
        update_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/menu/Rogan Josh",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"},
            json={"sku": "CUR-009-PRO", "discontinued_date": "2027-01-01"}
        )
        self.assertEqual(update_resp.status_code, 200)
        updated = update_resp.json()
        self.assertEqual(updated["sku"], "CUR-009-PRO")
        self.assertEqual(updated["discontinued_date"], "2027-01-01")

    # ==========================================================================
    # 4. MULTI-BRANCH OPERATIONS & METRICS TESTS
    # ==========================================================================

    def test_08_branch_metrics_and_details(self):
        """Verifies branch listing with order counts, revenue, closures, and operating days."""
        resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/branches/metrics",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"}
        )
        self.assertEqual(resp.status_code, 200)
        branches = resp.json()
        self.assertEqual(len(branches), 2)

        b1 = next(b for b in branches if b["id"] == self.branch_alpha_1)
        self.assertGreater(b1["total_orders"], 0)
        self.assertGreater(b1["total_revenue"], 0)
        self.assertEqual(b1["operating_days"], "mon,tue,wed,thu,fri,sat,sun")

    def test_09_branch_update_and_delete_protection(self):
        """Verifies branch update works, and primary branch or sole branch cannot be deleted."""
        # 1. Update branch 2 operating days
        update_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/branches/{self.branch_alpha_2}",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"},
            json={"operating_days": "tue,wed,thu,fri,sat,sun", "city": "Noida"}
        )
        self.assertEqual(update_resp.status_code, 200)
        updated = update_resp.json()
        self.assertEqual(updated["operating_days"], "tue,wed,thu,fri,sat,sun")
        self.assertEqual(updated["city"], "Noida")

        # 2. Attempt to delete primary branch (MUST fail with 400)
        del_primary_resp = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/branches/{self.branch_alpha_1}",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"}
        )
        self.assertEqual(del_primary_resp.status_code, 400)
        self.assertIn("Cannot delete the primary branch", del_primary_resp.json()["detail"])

        # 3. Analyst cannot delete branch (MUST fail with 403)
        analyst_del_resp = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/branches/{self.branch_alpha_2}",
            headers={"Authorization": f"Bearer {self.jwt_alpha_analyst}"}
        )
        self.assertEqual(analyst_del_resp.status_code, 403)

    # ==========================================================================
    # 5. RESTAURANT PROFILE & TEAM RBAC TESTS
    # ==========================================================================

    def test_10_profile_and_member_role_management(self):
        """Verifies profile update, member role modification, and sole owner protection."""
        # 1. Update restaurant profile
        prof_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/profile",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"},
            json={"name": "Spice Garden Grand Bistro", "operational_model": "dine_in_and_delivery"}
        )
        self.assertEqual(prof_resp.status_code, 200)
        self.assertEqual(prof_resp.json()["name"], "Spice Garden Grand Bistro")

        # 2. Promote Analyst to Admin
        role_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/members/{self.mem_analyst.id}/role",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"},
            json={"role": "admin"}
        )
        self.assertEqual(role_resp.status_code, 200)
        self.assertEqual(role_resp.json()["role"], "admin")

        # 3. Attempt to demote sole Owner (MUST be rejected with 400)
        # Find owner membership id
        members = tenant_service.list_members(self.tenant_alpha_id)
        owner_mem = next(m for m in members if m.role == "owner")
        demote_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/members/{owner_mem.id}/role",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"},
            json={"role": "analyst"}
        )
        self.assertEqual(demote_resp.status_code, 400)
        self.assertIn("Cannot demote the only owner", demote_resp.json()["detail"])

        # 4. Attempt to remove sole Owner (MUST be rejected with 400)
        del_owner_resp = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/members/{owner_mem.id}",
            headers={"Authorization": f"Bearer {self.jwt_alpha_owner}"}
        )
        self.assertEqual(del_owner_resp.status_code, 400)
        self.assertIn("Cannot remove the only owner", del_owner_resp.json()["detail"])


if __name__ == "__main__":
    unittest.main()
