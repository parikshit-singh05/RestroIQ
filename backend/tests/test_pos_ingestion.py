import io
import json
import uuid
import unittest
from datetime import datetime, timezone
import jwt
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.tenant_service import tenant_service
from app.services.ingestion_service import ingestion_service
from app.schemas.tenant_schemas import RestaurantCreate, BranchCreate


TEST_SECRET = "test-supa-secret-for-signing-token-xyz-12345"


def make_test_jwt(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    iss = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1" if settings.SUPABASE_URL else "https://supabase.local/auth/v1"
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "iss": iss,
        "iat": int(now.timestamp()),
        "exp": int(now.timestamp()) + 3600
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


class TestPosIngestionEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Configure secret for deterministic signature verification in tests
        settings.SUPABASE_JWT_SECRET = TEST_SECRET
        cls.client = TestClient(app)

        # Setup Tenant Alpha (Spice Garden)
        cls.user_alpha = str(uuid.uuid4())
        cls.jwt_alpha = make_test_jwt(cls.user_alpha, "alpha@spicegarden.com")

        res_alpha = tenant_service.create_restaurant(
            user_id=cls.user_alpha,
            user_email="alpha@spicegarden.com",
            data=RestaurantCreate(
                name="Spice Garden Bistro",
                currency="INR",
                timezone="Asia/Kolkata",
                operational_model="dine_in_and_delivery"
            )
        )
        cls.restaurant_alpha_id = res_alpha.id

        # Setup Secondary Branch for Alpha
        branch_res = tenant_service.create_branch(
            restaurant_id=cls.restaurant_alpha_id,
            data=BranchCreate(
                branch_code="IND01",
                branch_name="Indiranagar, Bengaluru",
                city="Bengaluru",
                is_primary=True
            )
        )
        cls.branch_alpha_id = branch_res.id

        # Setup Tenant Beta (Independent competitor)
        cls.user_beta = str(uuid.uuid4())
        cls.jwt_beta = make_test_jwt(cls.user_beta, "beta@tandooristreet.com")

        res_beta = tenant_service.create_restaurant(
            user_id=cls.user_beta,
            user_email="beta@tandooristreet.com",
            data=RestaurantCreate(
                name="Tandoori Street",
                currency="INR",
                timezone="Asia/Kolkata",
                operational_model="dine_in"
            )
        )
        cls.restaurant_beta_id = res_beta.id

    def test_01_auto_column_matching_canonical_and_synonyms(self):
        """Verify column mapper correctly identifies canonical names and arbitrary POS synonyms."""
        sample_pos_headers = [
            "Bill_No",
            "Bill_Date",
            "Bill_Time",
            "Outlet_Location",
            "Dish_Name",
            "Menu_Category",
            "Qty_Sold",
            "Rate_INR",
            "Discount_Amt",
            "Net_Total"
        ]

        suggested, suggestions_list = ingestion_service.auto_match_columns(sample_pos_headers)

        self.assertEqual(suggested["order_date"], "Bill_Date")
        self.assertEqual(suggested["item_name"], "Dish_Name")
        self.assertEqual(suggested["quantity"], "Qty_Sold")
        self.assertEqual(suggested["order_id"], "Bill_No")
        self.assertEqual(suggested["branch_code"], "Outlet_Location")
        self.assertEqual(suggested["unit_price"], "Rate_INR")
        self.assertEqual(suggested["net_sales"], "Net_Total")
        self.assertEqual(suggested["category"], "Menu_Category")

        # Verify suggestions list has high confidence
        date_sug = next(s for s in suggestions_list if s.canonical_field == "order_date")
        self.assertTrue(date_sug.confidence >= 0.95)
        self.assertTrue(date_sug.required)

    def test_02_flexible_date_parsing(self):
        """Verify date normalization handles ISO, Indian DD-MM-YYYY, DD/MM/YYYY, and Excel dates."""
        self.assertEqual(str(ingestion_service.parse_flexible_date("2026-08-15")), "2026-08-15")
        self.assertEqual(str(ingestion_service.parse_flexible_date("15-08-2026")), "2026-08-15")
        self.assertEqual(str(ingestion_service.parse_flexible_date("15/08/2026")), "2026-08-15")
        self.assertEqual(str(ingestion_service.parse_flexible_date("2026/08/15")), "2026-08-15")
        # Invalid date
        self.assertIsNone(ingestion_service.parse_flexible_date("invalid-date-string"))
        self.assertIsNone(ingestion_service.parse_flexible_date(""))

    def test_03_validation_detects_fatal_errors_and_anomalies(self):
        """Verify row-level validator detects unparseable dates, negative quantities, missing required fields."""
        headers = ["Date", "Dish", "Quantity", "Price"]
        rows = [
            {"Date": "2026-08-01", "Dish": "Paneer Tikka", "Quantity": "2", "Price": "260"},
            {"Date": "2026-08-01", "Dish": "Butter Chicken", "Quantity": "-1", "Price": "380"},  # Negative qty (refund)
            {"Date": "not-a-date", "Dish": "Dal Makhani", "Quantity": "1", "Price": "280"},       # Invalid date
            {"Date": "2026-08-02", "Dish": "", "Quantity": "3", "Price": "65"},                  # Missing item name
        ]

        mapping = {
            "order_date": "Date",
            "item_name": "Dish",
            "quantity": "Quantity",
            "unit_price": "Price"
        }

        result = ingestion_service.validate_dataset(headers, rows, mapping)
        self.assertEqual(result.total_rows, 4)
        self.assertEqual(result.valid_rows, 1)
        self.assertEqual(result.invalid_rows, 3)
        self.assertTrue(any("Quantity must be strictly positive" in e.message for e in result.errors))
        self.assertTrue(any("Invalid or unparseable order date" in e.message for e in result.errors))
        self.assertTrue(any("Missing or blank menu item" in e.message for e in result.errors))

    def test_04_preview_upload_api(self):
        """Test POST /tenant/restaurants/{id}/uploads/preview endpoint."""
        csv_content = (
            "Bill_No,Bill_Date,Dish_Name,Qty_Sold,Rate_INR\n"
            "B-001,2026-08-01,Butter Chicken,2,380\n"
            "B-002,2026-08-01,Garlic Naan,4,65\n"
        ).encode("utf-8")

        response = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/preview",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            files={"file": ("sales_preview.csv", io.BytesIO(csv_content), "text/csv")}
        )

        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["file_name"], "sales_preview.csv")
        self.assertEqual(data["file_format"], "csv")
        self.assertIn("Dish_Name", data["detected_headers"])
        self.assertEqual(data["suggested_mapping"]["item_name"], "Dish_Name")
        self.assertEqual(data["suggested_mapping"]["quantity"], "Qty_Sold")
        self.assertEqual(len(data["preview_rows"]), 2)

    def test_05_commit_upload_and_idempotency(self):
        """Test POST /tenant/restaurants/{id}/uploads/commit and re-upload deduplication."""
        csv_content = (
            "Bill_No,Bill_Date,Dish_Name,Qty_Sold,Rate_INR\n"
            "B-101,2026-08-10,Paneer Butter Masala,2,310\n"
            "B-101,2026-08-10,Garlic Naan,3,65\n"
            "B-102,2026-08-10,Hyderabadi Chicken Biryani,1,350\n"
        ).encode("utf-8")

        mapping_json = json.dumps({
            "order_date": "Bill_Date",
            "item_name": "Dish_Name",
            "quantity": "Qty_Sold",
            "order_id": "Bill_No",
            "unit_price": "Rate_INR"
        })

        # First commit
        res1 = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            files={"file": ("batch1.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json, "branch_id": self.branch_alpha_id}
        )

        self.assertEqual(res1.status_code, 200)
        d1 = res1.json()
        self.assertEqual(d1["inserted_rows"], 3)
        self.assertEqual(d1["duplicate_rows"], 0)
        self.assertEqual(d1["status"], "completed")

        # Second commit of exact same file (should result in 0 new rows, 3 duplicates)
        res2 = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            files={"file": ("batch1.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json, "branch_id": self.branch_alpha_id}
        )

        self.assertEqual(res2.status_code, 200)
        d2 = res2.json()
        self.assertEqual(d2["inserted_rows"], 0)
        self.assertEqual(d2["duplicate_rows"], 3)
        self.assertEqual(d2["status"], "completed")

    def test_06_load_sample_dataset_and_historical_summary(self):
        """Test POST /tenant/restaurants/{id}/uploads/load-sample and GET orders/summary."""
        res_sample = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/load-sample",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(res_sample.status_code, 200)
        sample_data = res_sample.json()
        self.assertGreater(sample_data["inserted_rows"], 1000)
        self.assertEqual(sample_data["status"], "completed")

        # Now test historical summary endpoint
        res_summary = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/orders/summary",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(res_summary.status_code, 200)
        summary = res_summary.json()
        self.assertGreater(summary["total_orders"], 100)
        self.assertGreater(summary["total_sales"], 10000.0)
        self.assertEqual(summary["currency_symbol"], "₹")
        self.assertGreaterEqual(summary["total_days"], 84)
        # Should be classified as 'adequate' since it has 112 days (>84 days)
        self.assertEqual(summary["data_sufficiency"], "adequate")
        self.assertGreater(len(summary["top_items"]), 0)
        self.assertGreater(len(summary["daily_velocity"]), 0)

    def test_07_cross_tenant_isolation_on_ingestion(self):
        """Ensure Tenant Beta cannot upload data to or read order summaries of Tenant Alpha."""
        # Beta tries to preview upload to Alpha's restaurant
        csv_content = b"Date,Dish,Quantity\n2026-08-01,Butter Chicken,1\n"
        res_unauth = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/preview",
            headers={"Authorization": f"Bearer {self.jwt_beta}"},
            files={"file": ("hack.csv", io.BytesIO(csv_content), "text/csv")}
        )
        self.assertEqual(res_unauth.status_code, 403)
        self.assertIn("Access denied", res_unauth.json()["detail"])

        # Beta tries to read Alpha's order summary
        res_unauth_summary = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/orders/summary",
            headers={"Authorization": f"Bearer {self.jwt_beta}"}
        )
        self.assertEqual(res_unauth_summary.status_code, 403)
        self.assertIn("Access denied", res_unauth_summary.json()["detail"])


if __name__ == "__main__":
    unittest.main()
