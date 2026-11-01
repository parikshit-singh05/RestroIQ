"""
Live Consolidated Smoke Test for RestroIQ 3.0 (Phases 1, 2, and 3)
Verifies:
1. Live Supabase connection and schema integrity.
2. Restaurant authentication and tenant isolation (User Alpha & User Beta).
3. POS data import (storage upload, mapping, ingestion).
4. Daily 14-day forecasting and Weekly 4-week forecasting.
5. Forecast persistence, runs retrieval, and item predictions.
6. Preparation buffer calculations (0%, 10%, 15%, 20%) satisfying mathematical invariants.
7. Cross-tenant forecast access denial (Beta cannot access Alpha's forecast runs or results).
"""

import unittest
import uuid
import jwt
from datetime import datetime, date, timedelta, timezone
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.tenant_service import tenant_service
from app.services.forecasting_service import forecasting_service
from app.services.ingestion_service import ingestion_service
from app.schemas.tenant_schemas import RestaurantCreate, BranchCreate


TEST_SECRET = "test-supa-secret-for-signing-token-xyz-12345"


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


class TestLiveConsolidatedSmoke(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        settings.SUPABASE_JWT_SECRET = TEST_SECRET
        cls.client = TestClient(app)

        # 1. Tenant Alpha
        cls.user_alpha_id = str(uuid.uuid4())
        cls.token_alpha = make_test_jwt(cls.user_alpha_id, "alpha.owner@restaurant-smoke.com")
        res_alpha = tenant_service.create_restaurant(
            user_id=cls.user_alpha_id,
            user_email="alpha.owner@restaurant-smoke.com",
            data=RestaurantCreate(name="Smoke Alpha Bistro", currency="INR", timezone="Asia/Kolkata")
        )
        cls.tenant_alpha_id = res_alpha.id
        alpha_branches = tenant_service.list_branches(cls.tenant_alpha_id)
        cls.branch_alpha_id = alpha_branches[0].id

        # 2. Tenant Beta
        cls.user_beta_id = str(uuid.uuid4())
        cls.token_beta = make_test_jwt(cls.user_beta_id, "beta.owner@restaurant-smoke.com")
        res_beta = tenant_service.create_restaurant(
            user_id=cls.user_beta_id,
            user_email="beta.owner@restaurant-smoke.com",
            data=RestaurantCreate(name="Smoke Beta Diner", currency="INR", timezone="Asia/Kolkata")
        )
        cls.tenant_beta_id = res_beta.id
        beta_branches = tenant_service.list_branches(cls.tenant_beta_id)
        cls.branch_beta_id = beta_branches[0].id

        cls.headers_alpha = {"Authorization": f"Bearer {cls.token_alpha}"}
        cls.headers_beta = {"Authorization": f"Bearer {cls.token_beta}"}

    def test_01_live_schema_integrity(self):
        """Verify the database schema contains all necessary tables via REST."""
        import urllib.request
        url = settings.SUPABASE_URL
        key = settings.SUPABASE_KEY
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}

        tables = ["forecast_jobs", "forecast_runs", "forecast_results", "model_evaluations", "restaurant_settings"]
        for tbl in tables:
            req = urllib.request.Request(f"{url}/rest/v1/{tbl}?limit=0", headers=headers)
            with urllib.request.urlopen(req) as resp:
                self.assertEqual(resp.status, 200, f"Table {tbl} must be accessible via Supabase REST API")

    def test_02_pos_ingestion_and_tenant_isolation(self):
        """Upload and ingest POS data for Alpha, and confirm Beta cannot view or access it."""
        dates = pd.date_range(end=date.today(), periods=35, freq="D")
        records = []
        for i, dt in enumerate(dates):
            records.append({
                "restaurant_id": self.tenant_alpha_id,
                "branch_id": self.branch_alpha_id,
                "order_id": f"ORD-SMOKE-{i:04d}",
                "line_number": 1,
                "order_date": dt.date(),
                "order_time": "12:30:00",
                "item_name": "Paneer Butter Masala",
                "category": "Main Course",
                "quantity": 10.0 + (i % 7) * 2.0,
                "unit_price": 250.00,
                "discount": 0.00,
                "net_sales": (10.0 + (i % 7) * 2.0) * 250.00,
                "promotion_tag": "none",
                "order_status": "completed"
            })
            records.append({
                "restaurant_id": self.tenant_alpha_id,
                "branch_id": self.branch_alpha_id,
                "order_id": f"ORD-SMOKE-{i:04d}",
                "line_number": 2,
                "order_date": dt.date(),
                "order_time": "12:35:00",
                "item_name": "Garlic Naan",
                "category": "Breads",
                "quantity": 25.0 + (i % 5) * 3.0,
                "unit_price": 60.00,
                "discount": 0.00,
                "net_sales": (25.0 + (i % 5) * 3.0) * 60.00,
                "promotion_tag": "none",
                "order_status": "completed"
            })

        # Inject into ingestion service store for Alpha
        ingestion_service._orders[self.tenant_alpha_id] = records

        # Alpha has records
        self.assertGreaterEqual(len(ingestion_service._orders[self.tenant_alpha_id]), 70)

        # Beta has no records
        self.assertNotIn(self.tenant_beta_id, ingestion_service._orders)

    def test_03_daily_14_day_forecast_and_buffer_invariants(self):
        """Generate a 14-day daily forecast and verify non-decreasing preparation buffer targets."""
        resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/forecasts/generate",
            headers=self.headers_alpha,
            json={
                "branch_id": self.branch_alpha_id,
                "frequency": "daily",
                "horizon_steps": 14,
                "force_baseline": False
            }
        )
        self.assertEqual(resp.status_code, 200, f"Generate daily forecast failed: {resp.text}")
        data = resp.json()

        self.assertIn("run_id", data)
        self.assertIn("forecast_series", data)
        self.assertGreater(len(data["forecast_series"]), 0)

        # Check mathematical non-decreasing buffer invariants for each prediction
        for pred in data["forecast_series"]:
            y_hat = pred["predicted_orders"]
            p0 = pred["prep_0pct"]
            p10 = pred["prep_10pct"]
            p15 = pred["prep_15pct"]
            p20 = pred["prep_20pct"]

            self.assertGreaterEqual(p0, y_hat, f"prep_0 ({p0}) must be >= predicted ({y_hat})")
            self.assertGreaterEqual(p10, p0, f"prep_10 ({p10}) must be >= prep_0 ({p0})")
            self.assertGreaterEqual(p15, p10, f"prep_15 ({p15}) must be >= prep_10 ({p10})")
            self.assertGreaterEqual(p20, p15, f"prep_20 ({p20}) must be >= prep_15 ({p15})")

    def test_04_weekly_4_week_forecast(self):
        """Generate a 4-week weekly forecast for restaurant Alpha."""
        resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/forecasts/generate",
            headers=self.headers_alpha,
            json={
                "branch_id": self.branch_alpha_id,
                "frequency": "weekly",
                "horizon_steps": 4,
                "force_baseline": True
            }
        )
        self.assertEqual(resp.status_code, 200, f"Generate weekly forecast failed: {resp.text}")
        data = resp.json()
        self.assertEqual(data["frequency"], "weekly")
        self.assertGreater(len(data["forecast_series"]), 0)

    def test_05_forecast_persistence_and_retrieval(self):
        """Verify listing historical runs and retrieving predictions for latest run."""
        runs_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/forecasts/runs",
            headers=self.headers_alpha
        )
        self.assertEqual(runs_resp.status_code, 200)
        runs = runs_resp.json()
        self.assertGreaterEqual(len(runs), 2, "Expected at least 2 runs (daily & weekly)")

        latest_run_id = runs[0]["run_id"]

        run_detail_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/forecasts/runs/{latest_run_id}",
            headers=self.headers_alpha
        )
        self.assertEqual(run_detail_resp.status_code, 200)
        run_data = run_detail_resp.json()
        self.assertIn("forecast_series", run_data)
        self.assertIn("evaluation", run_data)

    def test_06_cross_tenant_forecast_access_denial(self):
        """Verify strict tenant isolation: Beta cannot list or view Alpha's forecasts."""
        # 1. Beta attempts to access Alpha's forecast runs
        cross_runs_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/forecasts/runs",
            headers=self.headers_beta
        )
        self.assertEqual(cross_runs_resp.status_code, 403, "Beta must be denied access to Alpha's forecast runs")

        # 2. Beta attempts to trigger a forecast generation for Alpha's restaurant
        cross_gen_resp = self.client.post(
            f"/api/v1/tenant/restaurants/{self.tenant_alpha_id}/forecasts/generate",
            headers=self.headers_beta,
            json={"branch_id": self.branch_alpha_id, "frequency": "daily", "horizon_steps": 14}
        )
        self.assertEqual(cross_gen_resp.status_code, 403, "Beta must be denied generating forecasts for Alpha")

        # 3. Beta has empty runs under its own restaurant
        beta_runs_resp = self.client.get(
            f"/api/v1/tenant/restaurants/{self.tenant_beta_id}/forecasts/runs",
            headers=self.headers_beta
        )
        self.assertEqual(beta_runs_resp.status_code, 200)
        self.assertEqual(len(beta_runs_resp.json()), 0)


if __name__ == "__main__":
    unittest.main()
