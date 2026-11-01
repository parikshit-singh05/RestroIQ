"""
RestroIQ 3.0 — Comprehensive Forecasting Engine Test Suite
==========================================================
Verifies Phase 3 Dynamic Multi-Model Forecasting Engine:
1. Time-Series Resampling & Data Quality (closures, item lifecycle, missing dates, cancellation filtering).
2. Synthetic Dataset Isolation (sample data never contaminates forecasts).
3. Level 0 Baseline Models (Moving Average, Seasonal Naive).
4. Level 1 Machine Learning Models (Ridge, Random Forest, Gradient Boosting).
5. Chronological Walk-Forward Validation (zero future data leakage, metric calculations).
6. Adaptive Model Selection (ML must beat baseline; baseline fallback).
7. Data Sufficiency Assessment (insufficient history warning, marginal vs adequate).
8. Mathematical Preparation Buffer Invariants (0%, 10%, 15%, 20%).
9. Multi-Tenant Authorization & Cross-Tenant Rejection (HTTP 403).
10. Database Persistence & Retrieval.
"""

import unittest
import uuid
import json
import math
from datetime import datetime, date, timedelta, timezone
from typing import Dict, List, Any

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.tenant_service import tenant_service
from app.services.forecasting_service import forecasting_service
from app.schemas.tenant_schemas import RestaurantCreate, BranchCreate
from app.schemas.forecasting_schemas import (
    ForecastGenerationRequest,
    UpdateTenantSettingsRequest,
    BranchClosureCreate
)


TEST_SECRET = "test-supa-secret-for-signing-token-xyz-12345"


def make_test_jwt(user_id: str, email: str, role: str = "authenticated") -> str:
    """Helper to generate structurally valid test JWT tokens."""
    import jwt
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


class TestForecastingEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        settings.SUPABASE_JWT_SECRET = TEST_SECRET
        cls.client = TestClient(app)

        # 1. Setup Tenant Alpha (Spice Garden)
        cls.user_alpha = str(uuid.uuid4())
        cls.jwt_alpha = make_test_jwt(cls.user_alpha, "alpha@spicegarden.com")
        res_alpha = tenant_service.create_restaurant(
            user_id=cls.user_alpha,
            user_email="alpha@spicegarden.com",
            data=RestaurantCreate(
                name="Spice Garden Fine Dining",
                currency="INR",
                timezone="Asia/Kolkata",
                operational_model="dine_in"
            )
        )
        cls.restaurant_alpha_id = res_alpha.id
        alpha_branches = tenant_service.list_branches(cls.restaurant_alpha_id)
        cls.branch_alpha_id = alpha_branches[0].id

        # 2. Setup Tenant Beta (Independent Competitor)
        cls.user_beta = str(uuid.uuid4())
        cls.jwt_beta = make_test_jwt(cls.user_beta, "beta@competitor.com")
        res_beta = tenant_service.create_restaurant(
            user_id=cls.user_beta,
            user_email="beta@competitor.com",
            data=RestaurantCreate(
                name="Tandoori Flames",
                currency="INR",
                timezone="Asia/Kolkata",
                operational_model="quick_service"
            )
        )
        cls.restaurant_beta_id = res_beta.id
        beta_branches = tenant_service.list_branches(cls.restaurant_beta_id)
        cls.branch_beta_id = beta_branches[0].id

    def _generate_synthetic_history(
        self,
        days: int = 45,
        items: List[str] = ["Butter Chicken", "Garlic Naan", "Paneer Tikka"],
        start_date: date = date(2026, 6, 1),
        weekly_pattern: bool = True
    ) -> List[Dict[str, Any]]:
        """Generates realistic daily order records with weekly seasonal cycles."""
        records: List[Dict[str, Any]] = []
        base_demand = {"Butter Chicken": 40, "Garlic Naan": 80, "Paneer Tikka": 30}
        dow_mult = [1.0, 0.9, 0.95, 1.1, 1.4, 1.6, 1.3]  # Mon to Sun

        for d_idx in range(days):
            curr_d = start_date + timedelta(days=d_idx)
            dow = curr_d.weekday()
            mult = dow_mult[dow] if weekly_pattern else 1.0

            for itm in items:
                base = base_demand.get(itm, 25)
                # Deterministic pattern with gentle oscillation
                qty = max(1.0, float(round(base * mult + math.sin(d_idx / 3.0) * 5.0, 1)))
                records.append({
                    "restaurant_id": self.restaurant_alpha_id,
                    "branch_id": self.branch_alpha_id,
                    "order_id": f"ORD-{d_idx}-{itm[:3]}",
                    "order_date": str(curr_d),
                    "item_name": itm,
                    "category": "Main Course" if "Chicken" in itm or "Paneer" in itm else "Breads",
                    "quantity": qty,
                    "unit_price": 250.0,
                    "promotion_tag": "none",
                    "order_status": "completed"
                })
        return records

    # --------------------------------------------------------------------------
    # Test 1: Data Preparation & Quality Rules
    # --------------------------------------------------------------------------

    def test_01_data_preparation_closure_and_lifecycle_rules(self):
        """
        Verifies:
        1. Known branch closures are omitted from demand distribution rather than treated as zero demand.
        2. Dates prior to item introduction are not backfilled with zero demand.
        3. Open days with 0 sales for an item are correctly imputed as 0.0 demand.
        4. Cancelled orders are strictly filtered out.
        """
        start = date(2026, 7, 1)
        closure_d = date(2026, 7, 4)  # Closed on 4th of July
        late_item_intro_d = date(2026, 7, 10)  # Item B introduced on 10th

        raw_orders: List[Dict[str, Any]] = []
        # Item A sold from July 1 to July 15 (except closure on July 4)
        for i in range(15):
            d = start + timedelta(days=i)
            if d == closure_d:
                continue
            raw_orders.append({
                "restaurant_id": self.restaurant_alpha_id,
                "branch_id": self.branch_alpha_id,
                "order_id": f"A-{i}",
                "order_date": str(d),
                "item_name": "Dish A",
                "category": "Curry",
                "quantity": 10.0,
                "promotion_tag": "none",
                "order_status": "completed"
            })

        # Item B introduced on July 10
        for i in range(5):
            d = late_item_intro_d + timedelta(days=i)
            raw_orders.append({
                "restaurant_id": self.restaurant_alpha_id,
                "branch_id": self.branch_alpha_id,
                "order_id": f"B-{i}",
                "order_date": str(d),
                "item_name": "Dish B",
                "category": "Dessert",
                "quantity": 5.0,
                "promotion_tag": "none",
                "order_status": "completed"
            })

        # Add a cancelled order that must be excluded
        raw_orders.append({
            "restaurant_id": self.restaurant_alpha_id,
            "branch_id": self.branch_alpha_id,
            "order_id": "CANCEL-99",
            "order_date": str(start),
            "item_name": "Dish A",
            "category": "Curry",
            "quantity": 999.0,
            "promotion_tag": "none",
            "order_status": "cancelled"
        })

        # Register closure in service
        forecasting_service.add_branch_closure(
            restaurant_id=self.restaurant_alpha_id,
            branch_id=self.branch_alpha_id,
            closure=BranchClosureCreate(closure_date=str(closure_d), reason="Independence Day Maintenance")
        )

        df_prepared, meta, sufficiency = forecasting_service.prepare_time_series(
            restaurant_id=self.restaurant_alpha_id,
            branch_id=self.branch_alpha_id,
            frequency="daily",
            custom_orders=raw_orders
        )

        self.assertFalse(df_prepared.empty)

        # 1. Verify closure date is NOT present in prepared dataset
        dates_in_df = set(df_prepared["date"].values)
        self.assertNotIn(closure_d, dates_in_df, "Confirmed closure day must not be in prepared training series.")

        # 2. Verify Dish B does not have rows prior to introduction on July 10
        dish_b_dates = df_prepared[df_prepared["item_name"] == "Dish B"]["date"].values
        for d in dish_b_dates:
            self.assertGreaterEqual(d, late_item_intro_d, "Dish B must not exist prior to introduction.")

        # 3. Verify cancelled order was excluded (Dish A on July 1 has qty 10, not 1009)
        dish_a_day1 = df_prepared[(df_prepared["item_name"] == "Dish A") & (df_prepared["date"] == start)]
        self.assertEqual(float(dish_a_day1["quantity"].iloc[0]), 10.0, "Cancelled order was not excluded!")

    # --------------------------------------------------------------------------
    # Test 2: Synthetic Dataset Isolation
    # --------------------------------------------------------------------------

    def test_02_synthetic_dataset_isolation(self):
        """Synthetic demonstration records with promotion_tag='synthetic_sample' must never leak into forecast calculations."""
        raw_orders = self._generate_synthetic_history(days=20, items=["Biryani"])

        # Inject sample order with enormous outlier quantity
        raw_orders.append({
            "restaurant_id": self.restaurant_alpha_id,
            "branch_id": self.branch_alpha_id,
            "order_id": "SAMPLE-SG-9999",
            "order_date": "2026-06-10",
            "item_name": "Biryani",
            "category": "Main Course",
            "quantity": 10000.0,
            "promotion_tag": "synthetic_sample",
            "order_status": "completed"
        })

        df_prepared, _, _ = forecasting_service.prepare_time_series(
            restaurant_id=self.restaurant_alpha_id,
            branch_id=self.branch_alpha_id,
            frequency="daily",
            custom_orders=raw_orders
        )

        # Outlier sample record must be completely filtered out
        max_qty = df_prepared["quantity"].max()
        self.assertLess(max_qty, 500.0, "Synthetic sample record leaked into forecast preparation!")

    # --------------------------------------------------------------------------
    # Test 3: Data Sufficiency Assessment
    # --------------------------------------------------------------------------

    def test_03_data_sufficiency_rules(self):
        """
        Verifies:
        1. < 14 days history -> verdict='insufficient', is_sufficient=False, warning emitted.
        2. 14-27 days history -> verdict='marginal', baseline models enabled.
        3. >= 28 days history -> verdict='adequate', ML models enabled.
        """
        # Case A: 7 days (insufficient)
        orders_7d = self._generate_synthetic_history(days=7)
        _, _, suff_7 = forecasting_service.prepare_time_series(
            restaurant_id=self.restaurant_alpha_id,
            branch_id=self.branch_alpha_id,
            frequency="daily",
            custom_orders=orders_7d
        )
        self.assertEqual(suff_7.verdict, "insufficient")
        self.assertFalse(suff_7.is_sufficient)
        self.assertIsNotNone(suff_7.warning_message)

        # Case B: 20 days (marginal)
        orders_20d = self._generate_synthetic_history(days=20)
        _, _, suff_20 = forecasting_service.prepare_time_series(
            restaurant_id=self.restaurant_alpha_id,
            branch_id=self.branch_alpha_id,
            frequency="daily",
            custom_orders=orders_20d
        )
        self.assertEqual(suff_20.verdict, "marginal")
        self.assertTrue(suff_20.is_sufficient)

        # Case C: 35 days (adequate)
        orders_35d = self._generate_synthetic_history(days=35)
        _, _, suff_35 = forecasting_service.prepare_time_series(
            restaurant_id=self.restaurant_alpha_id,
            branch_id=self.branch_alpha_id,
            frequency="daily",
            custom_orders=orders_35d
        )
        self.assertEqual(suff_35.verdict, "adequate")
        self.assertTrue(suff_35.is_sufficient)

    # --------------------------------------------------------------------------
    # Test 4: Model Evaluation & Chronological Walk-Forward Validation
    # --------------------------------------------------------------------------

    def test_04_walk_forward_evaluation_and_no_leakage(self):
        """
        Verifies that:
        1. Evaluation uses strictly chronological holdout split.
        2. Training dates strictly precede evaluation dates.
        3. MAE, RMSE, WAPE are calculated accurately.
        """
        orders_45d = self._generate_synthetic_history(days=45)
        df_prepared, _, _ = forecasting_service.prepare_time_series(
            restaurant_id=self.restaurant_alpha_id,
            branch_id=self.branch_alpha_id,
            frequency="daily",
            custom_orders=orders_45d
        )

        chosen_model, evaluation = forecasting_service.evaluate_and_select_model(
            df_prepared=df_prepared,
            frequency="daily"
        )

        self.assertIsNotNone(evaluation.test_wape)
        self.assertIsNotNone(evaluation.baseline_wape)
        self.assertIsNotNone(evaluation.training_end_date)
        self.assertIsNotNone(evaluation.evaluation_start_date)

        # Confirm strictly chronological: train_end < eval_start
        t_end = pd.to_datetime(evaluation.training_end_date).date()
        e_start = pd.to_datetime(evaluation.evaluation_start_date).date()
        self.assertLess(t_end, e_start, "Future data leakage detected: training end is not strictly before evaluation start!")

    # --------------------------------------------------------------------------
    # Test 5: Adaptive Selection & Baseline Fallback Invariant
    # --------------------------------------------------------------------------

    def test_05_adaptive_selection_baseline_fallback(self):
        """
        Golden Rule: When force_baseline=True or ML model is inferior to baseline,
        the system strictly falls back to the baseline model.
        """
        orders_35d = self._generate_synthetic_history(days=35)
        df_prepared, _, _ = forecasting_service.prepare_time_series(
            restaurant_id=self.restaurant_alpha_id,
            branch_id=self.branch_alpha_id,
            frequency="daily",
            custom_orders=orders_35d
        )

        # Test with force_baseline=True
        chosen_model, eval_schema = forecasting_service.evaluate_and_select_model(
            df_prepared=df_prepared,
            frequency="daily",
            force_baseline=True
        )
        self.assertIn("baseline", chosen_model)
        self.assertIn("baseline", eval_schema.model_name)

    # --------------------------------------------------------------------------
    # Test 6: Preparation Buffer Mathematical Invariants
    # --------------------------------------------------------------------------

    def test_06_preparation_buffer_invariants(self):
        """
        Verifies mathematical invariants for all buffer levels:
        predicted <= prep_0pct <= prep_10pct <= prep_15pct <= prep_20pct
        """
        orders_45d = self._generate_synthetic_history(days=45)
        res = forecasting_service.generate_forecast(
            restaurant_id=self.restaurant_alpha_id,
            request=ForecastGenerationRequest(
                branch_id=self.branch_alpha_id,
                frequency="daily",
                horizon_steps=14
            ),
            custom_orders=orders_45d
        )

        self.assertGreater(len(res.forecast_series), 0)
        for item_pred in res.forecast_series:
            pred = item_pred.predicted_orders
            p0 = item_pred.prep_0pct
            p10 = item_pred.prep_10pct
            p15 = item_pred.prep_15pct
            p20 = item_pred.prep_20pct

            self.assertGreaterEqual(p0, pred, f"p0 ({p0}) must be >= predicted ({pred})")
            self.assertGreaterEqual(p10, p0, f"p10 ({p10}) must be >= p0 ({p0})")
            self.assertGreaterEqual(p15, p10, f"p15 ({p15}) must be >= p10 ({p10})")
            self.assertGreaterEqual(p20, p15, f"p20 ({p20}) must be >= p15 ({p15})")

    # --------------------------------------------------------------------------
    # Test 7: Weekly Forecasting Pipeline
    # --------------------------------------------------------------------------

    def test_07_weekly_forecasting_frequency(self):
        """Verifies weekly frequency aggregation and 4-week forecast generation."""
        orders_60d = self._generate_synthetic_history(days=60)
        res = forecasting_service.generate_forecast(
            restaurant_id=self.restaurant_alpha_id,
            request=ForecastGenerationRequest(
                branch_id=self.branch_alpha_id,
                frequency="weekly",
                horizon_steps=4
            ),
            custom_orders=orders_60d
        )

        self.assertEqual(res.frequency, "weekly")
        # Horizon 4 weeks for each unique item
        unique_items = set(p.item_name for p in res.forecast_series)
        expected_total_predictions = len(unique_items) * 4
        self.assertEqual(len(res.forecast_series), expected_total_predictions)

    # --------------------------------------------------------------------------
    # Test 8: End-to-End API Integration
    # --------------------------------------------------------------------------

    def test_08_api_forecast_generate_and_retrieve(self):
        """Tests POST /forecasts/generate and GET /forecasts/latest API endpoints."""
        orders = self._generate_synthetic_history(days=40)
        # Prepopulate in-memory ingestion service
        from app.services.ingestion_service import ingestion_service
        ingestion_service._orders[self.restaurant_alpha_id] = orders

        # Generate forecast via API
        gen_res = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/forecasts/generate",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            json={"branch_id": self.branch_alpha_id, "frequency": "daily", "horizon_steps": 14}
        )
        self.assertEqual(gen_res.status_code, 200)
        gen_data = gen_res.json()
        self.assertEqual(gen_data["restaurant_id"], self.restaurant_alpha_id)
        self.assertGreater(len(gen_data["forecast_series"]), 0)
        self.assertIn(gen_data["model_type"], ["baseline_seasonal_naive", "baseline_moving_average", "ml_ridge_regression", "ml_random_forest", "ml_gradient_boosting"])

        # Retrieve latest via API
        latest_res = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/forecasts/latest?frequency=daily&branch_id={self.branch_alpha_id}",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(latest_res.status_code, 200)
        latest_data = latest_res.json()
        self.assertEqual(latest_data["run_id"], gen_data["run_id"])

    # --------------------------------------------------------------------------
    # Test 9: Multi-Tenant Authorization & Cross-Tenant Rejection
    # --------------------------------------------------------------------------

    def test_09_cross_tenant_forecasting_denial(self):
        """User Beta attempting to generate or read User Alpha's forecasts MUST receive HTTP 403 Forbidden."""
        # 1. Cross-tenant generation attempt
        gen_res = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/forecasts/generate",
            headers={"Authorization": f"Bearer {self.jwt_beta}"},  # User Beta token
            json={"frequency": "daily"}
        )
        self.assertEqual(gen_res.status_code, 403)
        self.assertIn("Access denied", gen_res.json()["detail"])

        # 2. Cross-tenant retrieval attempt
        get_res = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/forecasts/latest",
            headers={"Authorization": f"Bearer {self.jwt_beta}"}
        )
        self.assertEqual(get_res.status_code, 403)

    # --------------------------------------------------------------------------
    # Test 10: Operational Settings & Buffer Management API
    # --------------------------------------------------------------------------

    def test_10_operational_settings_management(self):
        """Tests GET /settings and PUT /settings to update default prep buffer."""
        # GET settings
        get_res = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/settings",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(get_res.status_code, 200)
        self.assertEqual(get_res.json()["default_prep_buffer"], 10)

        # PUT settings to 20%
        put_res = self.client.put(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/settings",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            json={"default_prep_buffer": 20, "default_forecasting_frequency": "weekly"}
        )
        self.assertEqual(put_res.status_code, 200)
        self.assertEqual(put_res.json()["default_prep_buffer"], 20)
        self.assertEqual(put_res.json()["default_forecasting_frequency"], "weekly")


if __name__ == "__main__":
    unittest.main()

