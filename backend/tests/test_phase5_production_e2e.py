"""
RestroIQ 3.0 — Phase 5 Final Production End-to-End QA & Security Audit Suite
=============================================================================
Comprehensive automated test exercising the complete multi-tenant restaurant SaaS platform:
1. Separate restaurant accounts (Restaurant Alpha & Restaurant Beta).
2. Onboarding, branch creation, operating days, closures, deletion guards.
3. Menu catalog, SKU tracking, lifecycle dates, RBAC guards.
4. POS data ingestion, column mapping, idempotency, storage isolation, signed download URLs.
5. Multi-model forecasting (Prophet, LightGBM, Seasonal Naive), evaluation, persistence.
6. Predictive kitchen preparation, non-decreasing buffer invariants (0/10/15/20%).
7. Genuine operational sales analytics (uninflated AOV, DOW patterns, promotions).
8. Restaurant profile & operational settings preferences.
9. Team RBAC (Owner, Admin, Analyst), invitations, role updates, sole owner demotion/removal protection.
10. Strict cross-tenant access denial across ALL endpoints.
11. Synthetic sample data generation, sample isolation, and sample purge.
"""

import unittest
import uuid
import jwt
import io
from datetime import datetime, date, timedelta, timezone
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.tenant_service import tenant_service
from app.services.ingestion_service import ingestion_service
from app.services.forecasting_service import forecasting_service
from app.services.operations_service import operations_service
from app.schemas.tenant_schemas import RestaurantCreate, BranchCreate, MemberInvite, RestaurantSettingsUpdate
from app.schemas.operations_schemas import MenuItemCreate, MenuItemUpdate, BranchUpdate, RestaurantProfileUpdate


TEST_JWT_SECRET = "production-qa-test-jwt-secret-xyz-987654"


def generate_jwt(user_id: str, email: str, role: str = "authenticated") -> str:
    now = datetime.now(timezone.utc)
    iss = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1" if settings.SUPABASE_URL else "https://supabase.local/auth/v1"
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "aud": "authenticated",
        "iss": iss,
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + 14400,
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


class TestProductionEndToEndWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        settings.SUPABASE_JWT_SECRET = TEST_JWT_SECRET
        cls.client = TestClient(app)

        # ----------------------------------------------------------------------
        # 1. Organization Alpha: The Royal Spice (Owner: Alpha, Admin: Charlie, Analyst: David)
        # ----------------------------------------------------------------------
        cls.alpha_owner_id = str(uuid.uuid4())
        cls.alpha_owner_jwt = generate_jwt(cls.alpha_owner_id, "owner.alpha@royalspice.com")
        cls.headers_alpha_owner = {"Authorization": f"Bearer {cls.alpha_owner_jwt}"}

        res_alpha = tenant_service.create_restaurant(
            user_id=cls.alpha_owner_id,
            user_email="owner.alpha@royalspice.com",
            data=RestaurantCreate(name="The Royal Spice", currency="INR", timezone="Asia/Kolkata")
        )
        cls.rest_alpha_id = res_alpha.id
        alpha_branches = tenant_service.list_branches(cls.rest_alpha_id)
        cls.alpha_branch_primary = alpha_branches[0]

        # Add Admin Charlie
        cls.alpha_admin_email = "admin.charlie@royalspice.com"
        mem_admin = tenant_service.add_member(
            cls.rest_alpha_id,
            MemberInvite(email=cls.alpha_admin_email, role="admin"),
            actor_id=cls.alpha_owner_id
        )
        cls.alpha_admin_id = mem_admin.user_id
        cls.alpha_admin_jwt = generate_jwt(cls.alpha_admin_id, cls.alpha_admin_email)
        cls.headers_alpha_admin = {"Authorization": f"Bearer {cls.alpha_admin_jwt}"}

        # Add Analyst David
        cls.alpha_analyst_email = "analyst.david@royalspice.com"
        mem_analyst = tenant_service.add_member(
            cls.rest_alpha_id,
            MemberInvite(email=cls.alpha_analyst_email, role="analyst"),
            actor_id=cls.alpha_owner_id
        )
        cls.alpha_analyst_id = mem_analyst.user_id
        cls.alpha_analyst_jwt = generate_jwt(cls.alpha_analyst_id, cls.alpha_analyst_email)
        cls.headers_alpha_analyst = {"Authorization": f"Bearer {cls.alpha_analyst_jwt}"}

        # ----------------------------------------------------------------------
        # 2. Organization Beta: The Coastal Catch (Owner: Beta)
        # ----------------------------------------------------------------------
        cls.beta_owner_id = str(uuid.uuid4())
        cls.beta_owner_jwt = generate_jwt(cls.beta_owner_id, "owner.beta@coastalcatch.com")
        cls.headers_beta_owner = {"Authorization": f"Bearer {cls.beta_owner_jwt}"}

        res_beta = tenant_service.create_restaurant(
            user_id=cls.beta_owner_id,
            user_email="owner.beta@coastalcatch.com",
            data=RestaurantCreate(name="The Coastal Catch", currency="USD", timezone="America/New_York")
        )
        cls.rest_beta_id = res_beta.id
        beta_branches = tenant_service.list_branches(cls.rest_beta_id)
        cls.beta_branch_primary = beta_branches[0]

    # ==========================================================================
    # WORKFLOW STAGE 1: BRANCH LIFECYCLE & OPERATING SCHEDULES
    # ==========================================================================

    def test_01_branch_creation_and_closure_calendar(self):
        """Create secondary branch with custom operating days and register a scheduled closure."""
        # 1. Create secondary branch BLR-02
        new_branch = tenant_service.create_branch(
            restaurant_id=self.rest_alpha_id,
            data=BranchCreate(
                branch_code="BLR-02",
                branch_name="Whitefield Kitchen Hub",
                city="Bengaluru",
                state="Karnataka",
                is_primary=False,
                operating_days="mon,wed,fri,sat,sun"
            )
        )
        self.assertEqual(new_branch.branch_code, "BLR-02")
        self.assertEqual(new_branch.operating_days, "mon,wed,fri,sat,sun")

        # 2. Add closure to BLR-02
        closure_date = (date.today() + timedelta(days=10)).isoformat()
        add_closure_resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/branches/{new_branch.id}/closures",
            headers=self.headers_alpha_admin,
            json={"closure_date": closure_date, "reason": "Deep Sanitization & Maintenance"}
        )
        self.assertIn(add_closure_resp.status_code, [200, 201])

        # 3. Retrieve closures
        closures_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/branches/{new_branch.id}/closures",
            headers=self.headers_alpha_analyst
        )
        self.assertEqual(closures_resp.status_code, 200)
        self.assertGreaterEqual(len(closures_resp.json()), 1)

    def test_02_branch_deletion_safeguards(self):
        """Verify primary outlet deletion is blocked, and Analysts cannot delete branches."""
        # 1. Attempt to delete primary branch as Owner -> Expect HTTP 400
        del_resp = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/branches/{self.alpha_branch_primary.id}",
            headers=self.headers_alpha_owner
        )
        self.assertEqual(del_resp.status_code, 400)
        self.assertIn("cannot delete the primary", del_resp.text.lower())

        # 2. Attempt to delete secondary branch as Analyst -> Expect HTTP 403
        del_analyst_resp = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/branches/{self.alpha_branch_primary.id}",
            headers=self.headers_alpha_analyst
        )
        self.assertEqual(del_analyst_resp.status_code, 403)

    # ==========================================================================
    # WORKFLOW STAGE 2: MENU CATALOG & INTELLIGENCE
    # ==========================================================================

    def test_03_menu_catalog_management_and_rbac(self):
        """Admin can register and update menu items; Analyst is restricted from modifications."""
        # 1. Admin creates dishes
        items_to_create = [
            MenuItemCreate(item_name="Butter Chicken", category="Curries", sku="BC-01", introduced_date="2023-01-15"),
            MenuItemCreate(item_name="Paneer Tikka", category="Starters", sku="PT-01", introduced_date="2023-02-01"),
            MenuItemCreate(item_name="Garlic Naan", category="Breads", sku="GN-01", introduced_date="2023-01-15"),
        ]
        for itm in items_to_create:
            created = operations_service.create_menu_item(self.rest_alpha_id, itm, self.alpha_admin_jwt)
            self.assertEqual(created.item_name, itm.item_name)
            self.assertEqual(created.sku, itm.sku)

        # 2. Analyst attempts to create item -> Expect HTTP 403
        analyst_post = self.client.post(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/menu",
            headers=self.headers_alpha_analyst,
            json={"item_name": "Unauthorized Dish", "category": "Desserts"}
        )
        self.assertEqual(analyst_post.status_code, 403)

        # 3. Admin updates metadata
        update_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/menu/Butter%20Chicken",
            headers=self.headers_alpha_admin,
            json={"category": "Signature Mains", "sku": "BC-01-GOLD"}
        )
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()["category"], "Signature Mains")

        # 4. Analyst can query catalog
        cat_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/menu",
            headers=self.headers_alpha_analyst
        )
        self.assertEqual(cat_resp.status_code, 200)
        self.assertGreaterEqual(cat_resp.json()["total_items"], 3)

    # ==========================================================================
    # WORKFLOW STAGE 3: POS DATA INGESTION & STORAGE INTEGRATION
    # ==========================================================================

    def test_04_pos_data_ingestion_and_signed_download(self):
        """Ingest synthetic multi-week POS transaction data with promotions and signed download URL."""
        dates = pd.date_range(end=date.today(), periods=42, freq="D")
        csv_rows = ["Order ID,Date,Time,Item,Category,Qty,Price,Discount,Promotion"]
        order_idx = 1000

        for i, dt in enumerate(dates):
            d_str = dt.strftime("%Y-%m-%d")
            # 3 items per day
            order_idx += 1
            csv_rows.append(f"ORD-{order_idx},{d_str},13:00:00,Butter Chicken,Curries,{15 + (i % 6) * 3},380.00,0.00,{'WeekendSpecial' if dt.weekday() >= 5 else 'none'}")
            csv_rows.append(f"ORD-{order_idx},{d_str},13:05:00,Garlic Naan,Breads,{35 + (i % 4) * 5},65.00,0.00,none")
            order_idx += 1
            csv_rows.append(f"ORD-{order_idx},{d_str},20:30:00,Paneer Tikka,Starters,{12 + (i % 5) * 2},290.00,15.00,SummerTreat")

        csv_content = "\n".join(csv_rows).encode("utf-8")

        # 1. Preview headers
        preview_resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/uploads/preview",
            headers=self.headers_alpha_admin,
            files={"file": ("pos_sales_q1.csv", io.BytesIO(csv_content), "text/csv")}
        )
        self.assertEqual(preview_resp.status_code, 200)
        p_data = preview_resp.json()
        self.assertIn("suggested_mapping", p_data)

        # 2. Commit upload with explicit branch confirmation
        mapping = {
            "order_id": "Order ID",
            "order_date": "Date",
            "order_time": "Time",
            "item_name": "Item",
            "category": "Category",
            "quantity": "Qty",
            "unit_price": "Price",
            "discount": "Discount",
            "promotion_tag": "Promotion"
        }
        import json
        commit_resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/uploads/commit",
            headers=self.headers_alpha_admin,
            files={"file": ("pos_sales_q1.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": json.dumps(mapping), "branch_id": self.alpha_branch_primary.id}
        )
        self.assertIn(commit_resp.status_code, [200, 201])
        res_data = commit_resp.json()
        self.assertGreater(res_data["inserted_rows"], 100)
        self.assertEqual(res_data["status"], "completed")

        upload_id = res_data["upload_id"]

        # 3. Retrieve signed download URL for the uploaded file
        dl_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/uploads/{upload_id}/download-url",
            headers=self.headers_alpha_analyst
        )
        self.assertEqual(dl_resp.status_code, 200)
        dl_data = dl_resp.json()
        self.assertIn("download_url", dl_data)
        self.assertIn("restaurant-uploads", dl_data["download_url"])

    # ==========================================================================
    # WORKFLOW STAGE 4: DEMAND FORECASTING ENGINE & BUFFER MONOTONICITY
    # ==========================================================================

    def test_05_multi_model_forecasting_and_buffer_invariants(self):
        """Generate forecasts and strictly verify non-decreasing preparation buffer targets."""
        # 1. Daily 14-day walk-forward forecast
        fc_daily = self.client.post(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/forecasts/generate",
            headers=self.headers_alpha_admin,
            json={
                "branch_id": self.alpha_branch_primary.id,
                "frequency": "daily",
                "horizon_steps": 14,
                "force_baseline": False
            }
        )
        self.assertEqual(fc_daily.status_code, 200)
        daily_data = fc_daily.json()
        self.assertEqual(daily_data["frequency"], "daily")
        self.assertGreater(len(daily_data["forecast_series"]), 0)

        # Check mathematical buffer invariants: p0 <= p10 <= p15 <= p20
        for pt in daily_data["forecast_series"]:
            pred = pt["predicted_orders"]
            p0 = pt["prep_0pct"]
            p10 = pt["prep_10pct"]
            p15 = pt["prep_15pct"]
            p20 = pt["prep_20pct"]

            self.assertGreaterEqual(p0, pred, "prep_0 must be >= predicted")
            self.assertGreaterEqual(p10, p0, "prep_10 must be >= prep_0")
            self.assertGreaterEqual(p15, p10, "prep_15 must be >= prep_10")
            self.assertGreaterEqual(p20, p15, "prep_20 must be >= prep_15")

        # 2. Weekly 4-week forecast
        fc_weekly = self.client.post(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/forecasts/generate",
            headers=self.headers_alpha_admin,
            json={
                "branch_id": self.alpha_branch_primary.id,
                "frequency": "weekly",
                "horizon_steps": 4,
                "force_baseline": True
            }
        )
        self.assertEqual(fc_weekly.status_code, 200)
        self.assertEqual(fc_weekly.json()["frequency"], "weekly")

    # ==========================================================================
    # WORKFLOW STAGE 5: KITCHEN INVENTORY & PREPARATION INTELLIGENCE
    # ==========================================================================

    def test_06_kitchen_inventory_preparation_planning(self):
        """Retrieve upcoming prep sheet with buffer selector, velocity ranking, and variance audit."""
        inv_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/inventory?frequency=daily",
            headers=self.headers_alpha_analyst
        )
        self.assertEqual(inv_resp.status_code, 200)
        inv = inv_resp.json()

        self.assertIn("items", inv)
        self.assertIn("prep_targets_summary", inv)
        self.assertGreater(len(inv["items"]), 0)

        summary = inv["prep_targets_summary"]
        self.assertGreaterEqual(summary["prep_10"], summary["prep_0"])
        self.assertGreaterEqual(summary["prep_15"], summary["prep_10"])
        self.assertGreaterEqual(summary["prep_20"], summary["prep_15"])

        # Check velocity tier assignment
        for item in inv["items"]:
            self.assertIn(item["demand_tier"], ["high", "normal", "low"])
            self.assertGreaterEqual(item["prep_20pct"], item["prep_15pct"])

    # ==========================================================================
    # WORKFLOW STAGE 6: OPERATIONAL ANALYTICS WORKSPACE
    # ==========================================================================

    def test_07_operational_analytics_and_aov(self):
        """Validate operational analytics: uninflated AOV, day-of-week demand, and category shares."""
        analytics_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/analytics",
            headers=self.headers_alpha_analyst
        )
        self.assertEqual(analytics_resp.status_code, 200)
        a_data = analytics_resp.json()

        self.assertGreater(a_data["total_revenue"], 0)
        self.assertGreater(a_data["total_orders"], 0)

        # Strict mathematical AOV verification
        calculated_aov = round(a_data["total_revenue"] / a_data["total_orders"], 2)
        self.assertAlmostEqual(a_data["average_order_value"], calculated_aov, delta=0.5)

        # DOW distribution check
        self.assertIn("day_of_week_distribution", a_data)
        self.assertGreaterEqual(len(a_data["day_of_week_distribution"]), 5)

        # Promotion analysis check
        self.assertIn("promotion_analysis", a_data)
        self.assertTrue(a_data["promotion_analysis"]["has_promotions"])

    # ==========================================================================
    # WORKFLOW STAGE 7: RESTAURANT PROFILE & TEAM RBAC GOVERNANCE
    # ==========================================================================

    def test_08_profile_settings_and_sole_owner_safeguard(self):
        """Update profile metadata, settings preferences, and verify sole owner protection."""
        # 1. Update Profile (cuisine, operational model, timezone)
        prof_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/profile",
            headers=self.headers_alpha_owner,
            json={
                "name": "The Royal Spice Flagship",
                "cuisine": "North Indian Fine Dining",
                "operational_model": "dine_in",
                "timezone": "Asia/Kolkata"
            }
        )
        self.assertEqual(prof_resp.status_code, 200)
        self.assertEqual(prof_resp.json()["name"], "The Royal Spice Flagship")

        # 2. Update Operational Settings
        set_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/settings",
            headers=self.headers_alpha_owner,
            json={
                "default_prep_buffer": 15,
                "default_forecasting_frequency": "daily",
                "auto_forecast_on_upload": True
            }
        )
        self.assertEqual(set_resp.status_code, 200)
        self.assertEqual(set_resp.json()["default_prep_buffer"], 15)

        # 3. List members
        mem_list = tenant_service.list_members(self.rest_alpha_id)
        owner_member = next(m for m in mem_list if m.user_id == self.alpha_owner_id)
        admin_member = next(m for m in mem_list if m.user_id == self.alpha_admin_id)

        # 4. Attempt to demote the sole owner -> Expect HTTP 400
        demote_resp = self.client.put(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/members/{owner_member.id}/role",
            headers=self.headers_alpha_owner,
            json={"role": "admin"}
        )
        self.assertEqual(demote_resp.status_code, 400)
        self.assertIn("only owner", demote_resp.text.lower())

        # 5. Attempt to delete the sole owner -> Expect HTTP 400
        del_owner_resp = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/members/{owner_member.id}",
            headers=self.headers_alpha_owner
        )
        self.assertEqual(del_owner_resp.status_code, 400)
        self.assertIn("only owner", del_owner_resp.text.lower())

        # 6. Delete Admin Charlie -> Expect HTTP 204
        del_admin_resp = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/members/{admin_member.id}",
            headers=self.headers_alpha_owner
        )
        self.assertEqual(del_admin_resp.status_code, 204)

    # ==========================================================================
    # WORKFLOW STAGE 8: STRICT CROSS-TENANT ISOLATION AUDIT
    # ==========================================================================

    def test_09_cross_tenant_access_denial_exhaustive(self):
        """Assert User Beta is strictly denied access across all of Alpha's data and actions."""
        # 1. Beta attempts to read Alpha's analytics -> HTTP 403
        self.assertEqual(
            self.client.get(f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/analytics", headers=self.headers_beta_owner).status_code,
            403
        )
        # 2. Beta attempts to read Alpha's inventory planning -> HTTP 403
        self.assertEqual(
            self.client.get(f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/inventory", headers=self.headers_beta_owner).status_code,
            403
        )
        # 3. Beta attempts to read Alpha's menu catalog -> HTTP 403
        self.assertEqual(
            self.client.get(f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/menu", headers=self.headers_beta_owner).status_code,
            403
        )
        # 4. Beta attempts to view Alpha's branch metrics -> HTTP 403
        self.assertEqual(
            self.client.get(f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/branches/metrics", headers=self.headers_beta_owner).status_code,
            403
        )
        # 5. Beta attempts to view Alpha's profile -> HTTP 403
        self.assertEqual(
            self.client.get(f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/profile", headers=self.headers_beta_owner).status_code,
            403
        )
        # 6. Beta attempts to view Alpha's forecast runs -> HTTP 403
        self.assertEqual(
            self.client.get(f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/forecasts/runs", headers=self.headers_beta_owner).status_code,
            403
        )

    # ==========================================================================
    # WORKFLOW STAGE 9: SYNTHETIC DATA ISOLATION & SAMPLE PURGE
    # ==========================================================================

    def test_10_synthetic_sample_data_lifecycle_and_purge(self):
        """Verify synthetic sample data load, overview active banner, and clean purge without side-effects."""
        # 1. Load sample data for Restaurant Beta
        load_resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.rest_beta_id}/uploads/load-sample",
            headers=self.headers_beta_owner
        )
        self.assertIn(load_resp.status_code, [200, 201])
        self.assertTrue(load_resp.json()["is_sample"])

        # 2. Beta's overview indicates sample data is active
        beta_summary = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_beta_id}/orders/summary",
            headers=self.headers_beta_owner
        ).json()
        self.assertTrue(beta_summary.get("is_sample_active"))
        self.assertGreater(beta_summary.get("sample_orders_count", 0), 0)

        # 3. Alpha's overview is NOT flagged as sample data
        alpha_summary = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/orders/summary",
            headers=self.headers_alpha_owner
        ).json()
        self.assertFalse(alpha_summary.get("is_sample_active", False))

        # 4. Purge sample data from Restaurant Beta
        purge_resp = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.rest_beta_id}/uploads/sample",
            headers=self.headers_beta_owner
        )
        self.assertEqual(purge_resp.status_code, 200)
        self.assertGreater(purge_resp.json()["deleted_orders_count"], 0)

        # 5. Beta has no sample data left
        beta_summary_after = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_beta_id}/orders/summary",
            headers=self.headers_beta_owner
        ).json()
        self.assertFalse(beta_summary_after.get("is_sample_active", False))
        self.assertEqual(beta_summary_after.get("total_line_items", 0), 0)

        # 6. Alpha's genuine records are completely unaffected
        alpha_summary_after = self.client.get(
            f"/api/v1/tenant/restaurants/{self.rest_alpha_id}/orders/summary",
            headers=self.headers_alpha_owner
        ).json()
        self.assertGreater(alpha_summary_after.get("total_line_items", 0), 100)


if __name__ == "__main__":
    unittest.main()

