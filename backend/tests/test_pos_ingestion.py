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

        # Setup Primary Branch for Alpha
        branch_res_1 = tenant_service.create_branch(
            restaurant_id=cls.restaurant_alpha_id,
            data=BranchCreate(
                branch_code="IND01",
                branch_name="Indiranagar, Bengaluru",
                city="Bengaluru",
                is_primary=True
            )
        )
        cls.branch_alpha_id = branch_res_1.id

        # Setup Secondary Branch for Alpha (Multi-Branch Tenant)
        branch_res_2 = tenant_service.create_branch(
            restaurant_id=cls.restaurant_alpha_id,
            data=BranchCreate(
                branch_code="KOR02",
                branch_name="Koramangala, Bengaluru",
                city="Bengaluru",
                is_primary=False
            )
        )
        cls.branch_alpha_2_id = branch_res_2.id

        # Setup Single-Branch Tenant Gamma (Solo Cafe)
        cls.user_gamma = str(uuid.uuid4())
        cls.jwt_gamma = make_test_jwt(cls.user_gamma, "gamma@solocafe.com")
        res_gamma = tenant_service.create_restaurant(
            user_id=cls.user_gamma,
            user_email="gamma@solocafe.com",
            data=RestaurantCreate(
                name="Solo Coffee Roasters",
                currency="INR",
                timezone="Asia/Kolkata",
                operational_model="quick_service"
            )
        )
        cls.restaurant_gamma_id = res_gamma.id
        # TenantService automatically creates 1 default branch ('MAIN') for Gamma
        gamma_branches = tenant_service.list_branches(cls.restaurant_gamma_id)
        cls.branch_gamma_id = gamma_branches[0].id

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

        date_sug = next(s for s in suggestions_list if s.canonical_field == "order_date")
        self.assertTrue(date_sug.confidence >= 0.95)
        self.assertTrue(date_sug.required)

    def test_02_flexible_date_parsing(self):
        """Verify date normalization handles ISO, Indian DD-MM-YYYY, DD/MM/YYYY, and Excel dates."""
        self.assertEqual(str(ingestion_service.parse_flexible_date("2026-08-15")), "2026-08-15")
        self.assertEqual(str(ingestion_service.parse_flexible_date("15-08-2026")), "2026-08-15")
        self.assertEqual(str(ingestion_service.parse_flexible_date("15/08/2026")), "2026-08-15")
        self.assertEqual(str(ingestion_service.parse_flexible_date("2026/08/15")), "2026-08-15")
        self.assertIsNone(ingestion_service.parse_flexible_date("invalid-date-string"))
        self.assertIsNone(ingestion_service.parse_flexible_date(""))

    def test_03_validation_detects_fatal_errors_and_anomalies(self):
        """Verify row-level validator detects unparseable dates, negative quantities, missing required fields."""
        headers = ["Date", "Dish", "Quantity", "Price"]
        rows = [
            {"Date": "2026-08-01", "Dish": "Paneer Tikka", "Quantity": "2", "Price": "260"},
            {"Date": "2026-08-01", "Dish": "Butter Chicken", "Quantity": "-1", "Price": "380"},
            {"Date": "not-a-date", "Dish": "Dal Makhani", "Quantity": "1", "Price": "280"},
            {"Date": "2026-08-02", "Dish": "", "Quantity": "3", "Price": "65"},
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

    def test_06_branch_assignment_single_branch_requires_explicit_confirmation(self):
        """Single-branch restaurant (Gamma) requires explicit branch confirmation when branch column is absent."""
        csv_content = (
            "Order_Date,Item,Units,Total\n"
            "2026-08-01,Espresso,2,240\n"
            "2026-08-01,Croissant,1,160\n"
        ).encode("utf-8")

        mapping_json = json.dumps({
            "order_date": "Order_Date",
            "item_name": "Item",
            "quantity": "Units",
            "net_sales": "Total"
        })

        # 1. Single-branch without explicit confirmation: MUST BE REJECTED to prevent silent assignment
        res_rejected = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_gamma_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_gamma}"},
            files={"file": ("single_branch.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json}
        )
        self.assertEqual(res_rejected.status_code, 400)
        self.assertIn("Explicit branch confirmation required", res_rejected.json()["detail"])

        # 2. With explicit branch confirmation: succeeds cleanly
        res_confirmed = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_gamma_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_gamma}"},
            files={"file": ("single_branch.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json, "branch_id": self.branch_gamma_id}
        )
        self.assertEqual(res_confirmed.status_code, 200)
        data = res_confirmed.json()
        self.assertEqual(data["inserted_rows"], 2)
        self.assertEqual(data["status"], "completed")

    def test_07_branch_assignment_multi_branch_with_column(self):
        """Multi-branch restaurant (Alpha) where file maps branch column assigns each line to its correct branch."""
        csv_content = (
            "Date,Dish,Qty,Branch\n"
            "2026-08-05,Paneer Tikka,2,IND01\n"
            "2026-08-05,Chicken 65,1,KOR02\n"
        ).encode("utf-8")

        mapping_json = json.dumps({
            "order_date": "Date",
            "item_name": "Dish",
            "quantity": "Qty",
            "branch_code": "Branch"
        })

        res = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            files={"file": ("multi_branch.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json}
        )
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["inserted_rows"], 2)

    def test_08_branch_assignment_multi_branch_ambiguous_rejected(self):
        """MANDATORY: Multi-branch restaurant where file lacks branch column and NO fallback branch is given MUST be rejected."""
        csv_content = (
            "Date,Dish,Qty\n"
            "2026-08-06,Dal Makhani,2\n"
        ).encode("utf-8")

        mapping_json = json.dumps({
            "order_date": "Date",
            "item_name": "Dish",
            "quantity": "Qty"
        })

        # No branch_id provided for multi-branch restaurant Alpha -> MUST FAIL
        res = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            files={"file": ("ambiguous.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Ambiguous branch assignment", res.json()["detail"])
        self.assertIn("Silent assignment to primary branch is strictly prohibited", res.json()["detail"])

    def test_09_branch_assignment_multi_branch_explicit_confirmation(self):
        """Multi-branch restaurant where file lacks branch column succeeds when user explicitly confirms branch_id."""
        csv_content = (
            "Date,Dish,Qty\n"
            "2026-08-07,Mutton Rogan Josh,1\n"
        ).encode("utf-8")

        mapping_json = json.dumps({
            "order_date": "Date",
            "item_name": "Dish",
            "quantity": "Qty"
        })

        # Explicitly passing branch_id confirms user selection
        res = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            files={"file": ("confirmed_branch.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json, "branch_id": self.branch_alpha_2_id}
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["inserted_rows"], 1)

    def test_10_branch_assignment_unrecognized_branch_rejected(self):
        """File containing an unrecognized branch name without user confirmation is rejected."""
        csv_content = (
            "Date,Dish,Qty,Branch\n"
            "2026-08-08,Butter Chicken,1,NonExistentOutlet\n"
        ).encode("utf-8")

        mapping_json = json.dumps({
            "order_date": "Date",
            "item_name": "Dish",
            "quantity": "Qty",
            "branch_code": "Branch"
        })

        res = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            files={"file": ("unrecognized_branch.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json}
        )
        self.assertEqual(res.status_code, 400)
        self.assertIn("Unrecognized branch", res.json()["detail"])

    def test_11_storage_upload_reference_and_signed_download_url(self):
        """Verify uploads track storage path {restaurant_id}/{upload_id}/{filename} and support signed download URLs."""
        csv_content = (
            "Bill_No,Bill_Date,Dish_Name,Qty_Sold\n"
            "B-901,2026-08-09,Cold Coffee,2\n"
        ).encode("utf-8")

        mapping_json = json.dumps({
            "order_date": "Bill_Date",
            "item_name": "Dish_Name",
            "quantity": "Qty_Sold",
            "order_id": "Bill_No"
        })

        commit_res = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/commit",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"},
            files={"file": ("beverages.csv", io.BytesIO(csv_content), "text/csv")},
            data={"mapping": mapping_json, "branch_id": self.branch_alpha_id}
        )
        self.assertEqual(commit_res.status_code, 200)
        commit_data = commit_res.json()
        upload_id = commit_data["upload_id"]
        storage_path = commit_data["storage_path"]

        # Verify storage path structure follows {restaurant_id}/{upload_id}/{filename}
        expected_prefix = f"{self.restaurant_alpha_id}/{upload_id}/"
        self.assertTrue(storage_path.startswith(expected_prefix))
        self.assertIn("beverages.csv", storage_path)

        # Verify signed download URL generation
        dl_res = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/{upload_id}/download-url",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(dl_res.status_code, 200)
        dl_data = dl_res.json()
        self.assertEqual(dl_data["upload_id"], upload_id)
        self.assertIn("restaurant-uploads", dl_data["download_url"])
        self.assertEqual(dl_data["storage_path"], storage_path)

        # Cross-tenant denial: Tenant Beta cannot get download URL for Alpha's file
        dl_unauth = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/{upload_id}/download-url",
            headers={"Authorization": f"Bearer {self.jwt_beta}"}
        )
        self.assertEqual(dl_unauth.status_code, 403)

    def test_12_synthetic_dataset_isolation_and_purge(self):
        """Verify synthetic sample data is tagged, isolated, and completely purgeable without affecting real orders."""
        # Load sample data
        res_sample = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/load-sample",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(res_sample.status_code, 200)
        self.assertTrue(res_sample.json()["is_sample"])

        # Check summary indicates sample data is active
        summary_res = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/orders/summary",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(summary_res.status_code, 200)
        summary = summary_res.json()
        self.assertTrue(summary["is_sample_active"])
        self.assertGreater(summary["sample_orders_count"], 1000)

        # Purge sample data
        purge_res = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/sample",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(purge_res.status_code, 200)
        purge_data = purge_res.json()
        self.assertGreater(purge_data["deleted_orders_count"], 1000)

        # Check summary again: sample data is NO LONGER active, but real previously committed records remain!
        summary_after = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/orders/summary",
            headers={"Authorization": f"Bearer {self.jwt_alpha}"}
        )
        self.assertEqual(summary_after.status_code, 200)
        after_data = summary_after.json()
        self.assertFalse(after_data["is_sample_active"])
        self.assertEqual(after_data["sample_orders_count"], 0)
        # Real orders from earlier tests (batch1, multi_branch, beverages) are preserved!
        self.assertGreater(after_data["total_line_items"], 0)

    def test_13_cross_tenant_isolation_on_ingestion(self):
        """Ensure Tenant Beta cannot upload data to or read order summaries of Tenant Alpha."""
        csv_content = b"Date,Dish,Quantity\n2026-08-01,Butter Chicken,1\n"
        res_unauth = self.client.post(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/preview",
            headers={"Authorization": f"Bearer {self.jwt_beta}"},
            files={"file": ("hack.csv", io.BytesIO(csv_content), "text/csv")}
        )
        self.assertEqual(res_unauth.status_code, 403)
        self.assertIn("Access denied", res_unauth.json()["detail"])

        res_unauth_summary = self.client.get(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/orders/summary",
            headers={"Authorization": f"Bearer {self.jwt_beta}"}
        )
        self.assertEqual(res_unauth_summary.status_code, 403)
        self.assertIn("Access denied", res_unauth_summary.json()["detail"])

        # Beta cannot purge Alpha's sample data
        res_unauth_purge = self.client.delete(
            f"/api/v1/tenant/restaurants/{self.restaurant_alpha_id}/uploads/sample",
            headers={"Authorization": f"Bearer {self.jwt_beta}"}
        )
        self.assertEqual(res_unauth_purge.status_code, 403)


if __name__ == "__main__":
    unittest.main()
