"""
Synthetic POS Dataset Generator for RestroIQ 3.0
Generates realistic heterogeneous POS transaction datasets (CSV & XLSX)
for "The Spice Garden Cafe & Bistro" across 2 branches over 16 weeks (~112 days).
"""

import os
import csv
import random
from datetime import date, datetime, timedelta
from typing import List, Dict, Any

try:
    import openpyxl
except ImportError:
    openpyxl = None


# Seed for reproducible realistic patterns
random.seed(42)

MENU_ITEMS = [
    # Starters
    {"item_id": "starter-paneer-tikka", "dish_name": "Paneer Tikka", "category": "Starters", "rate": 260.0, "base_daily": 14},
    {"item_id": "starter-chicken-65", "dish_name": "Chicken 65", "category": "Starters", "rate": 290.0, "base_daily": 18},
    {"item_id": "starter-hara-bhara", "dish_name": "Hara Bhara Kabab", "category": "Starters", "rate": 220.0, "base_daily": 10},
    {"item_id": "starter-crispy-corn", "dish_name": "Crispy Corn", "category": "Starters", "rate": 210.0, "base_daily": 12},
    {"item_id": "starter-fish-amritsari", "dish_name": "Fish Amritsari", "category": "Starters", "rate": 340.0, "base_daily": 8},

    # Main Course
    {"item_id": "main-butter-chicken", "dish_name": "Butter Chicken", "category": "Main Course", "rate": 380.0, "base_daily": 26},
    {"item_id": "main-dal-makhani", "dish_name": "Dal Makhani", "category": "Main Course", "rate": 280.0, "base_daily": 22},
    {"item_id": "main-paneer-butter-masala", "dish_name": "Paneer Butter Masala", "category": "Main Course", "rate": 310.0, "base_daily": 20},
    {"item_id": "main-mutton-rogan-josh", "dish_name": "Mutton Rogan Josh", "category": "Main Course", "rate": 460.0, "base_daily": 9},
    {"item_id": "main-kadhai-paneer", "dish_name": "Kadhai Paneer", "category": "Main Course", "rate": 300.0, "base_daily": 15},
    {"item_id": "bread-garlic-naan", "dish_name": "Garlic Naan", "category": "Breads", "rate": 65.0, "base_daily": 45},
    {"item_id": "bread-butter-roti", "dish_name": "Butter Roti", "category": "Breads", "rate": 35.0, "base_daily": 55},

    # Biryanis & Rice
    {"item_id": "rice-hyd-chicken-biryani", "dish_name": "Hyderabadi Chicken Biryani", "category": "Biryanis & Rice", "rate": 350.0, "base_daily": 32},
    {"item_id": "rice-lucknowi-mutton-biryani", "dish_name": "Lucknowi Mutton Biryani", "category": "Biryanis & Rice", "rate": 440.0, "base_daily": 14},
    {"item_id": "rice-veg-dum-biryani", "dish_name": "Veg Dum Biryani", "category": "Biryanis & Rice", "rate": 270.0, "base_daily": 18},
    {"item_id": "rice-jeera-rice", "dish_name": "Jeera Rice", "category": "Biryanis & Rice", "rate": 160.0, "base_daily": 16},

    # Beverages
    {"item_id": "bev-masala-chai", "dish_name": "Masala Chai", "category": "Beverages", "rate": 60.0, "base_daily": 25},
    {"item_id": "bev-mango-lassi", "dish_name": "Mango Lassi", "category": "Beverages", "rate": 110.0, "base_daily": 28},
    {"item_id": "bev-fresh-lime-soda", "dish_name": "Fresh Lime Soda", "category": "Beverages", "rate": 90.0, "base_daily": 30},
    {"item_id": "bev-cold-coffee", "dish_name": "Cold Coffee", "category": "Beverages", "rate": 140.0, "base_daily": 20},
]

BRANCHES = [
    {"branch_code": "IND01", "location_name": "Indiranagar, Bengaluru", "volume_multiplier": 1.15},
    {"branch_code": "KOR02", "location_name": "Koramangala, Bengaluru", "volume_multiplier": 1.00},
]

# Day of week multipliers (0 = Monday, 6 = Sunday)
DOW_MULTIPLIERS = {
    0: 0.75,  # Monday slower
    1: 0.80,  # Tuesday slow
    2: 0.85,  # Wednesday steady
    3: 0.95,  # Thursday picking up
    4: 1.45,  # Friday busy
    5: 1.70,  # Saturday peak
    6: 1.55,  # Sunday peak family rush
}


def generate_dataset(days_count: int = 112, start_date: date = None) -> List[Dict[str, Any]]:
    """
    Generates a realistic sequence of POS orders over days_count days.
    """
    if start_date is None:
        # 16 weeks ending late October 2026
        start_date = date(2026, 7, 10)

    rows: List[Dict[str, Any]] = []
    order_seq = 1000

    for day_idx in range(days_count):
        current_date = start_date + timedelta(days=day_idx)
        dow = current_date.weekday()
        dow_factor = DOW_MULTIPLIERS[dow]

        # Gentle organic growth trend (~10% increase over 16 weeks)
        growth_factor = 1.0 + (day_idx / days_count) * 0.12

        for branch in BRANCHES:
            b_factor = branch["volume_multiplier"]
            branch_label = branch["location_name"]
            b_code = branch["branch_code"]

            # Number of unique orders for this branch today
            num_orders = int(random.randint(45, 65) * dow_factor * b_factor * growth_factor)

            for _ in range(num_orders):
                order_seq += 1
                bill_no = f"SG-{b_code}-{current_date.strftime('%y%m%d')}-{order_seq:05d}"

                # Order time during meal hours (Lunch 12:00-15:30 or Dinner 18:30-23:00)
                if random.random() < 0.38:
                    # Lunch
                    hour = random.randint(12, 15)
                    minute = random.randint(0, 59)
                else:
                    # Dinner
                    hour = random.randint(18, 22)
                    minute = random.randint(0, 59)
                order_time_str = f"{hour:02d}:{minute:02d}:00"

                # Number of items per order (1 to 4 items)
                items_in_order = random.choices([1, 2, 3, 4], weights=[0.25, 0.45, 0.20, 0.10])[0]
                selected_items = random.sample(MENU_ITEMS, items_in_order)

                for item in selected_items:
                    # Quantity per line item
                    qty = random.choices([1, 2, 3], weights=[0.75, 0.20, 0.05])[0]
                    rate = item["rate"]

                    # Occasional discount (10% off for combo / Happy Hours)
                    discount = 0.0
                    if dow >= 4 and random.random() < 0.15:
                        discount = round((rate * qty) * 0.10, 2)

                    net_total = round((rate * qty) - discount, 2)

                    rows.append({
                        "Bill_No": bill_no,
                        "Bill_Date": current_date.strftime("%Y-%m-%d"),
                        "Bill_Time": order_time_str,
                        "Outlet_Location": branch_label,
                        "Dish_Name": item["dish_name"],
                        "Menu_Category": item["category"],
                        "Qty_Sold": qty,
                        "Rate_INR": rate,
                        "Discount_Amt": discount,
                        "Net_Total": net_total,
                    })

    return rows


def write_csv(rows: List[Dict[str, Any]], filepath: str) -> None:
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    fieldnames = list(rows[0].keys())
    with open(filepath, mode="w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_xlsx(rows: List[Dict[str, Any]], filepath: str) -> None:
    if openpyxl is None:
        print("Warning: openpyxl not installed. Skipping .xlsx export.")
        return
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "POS_Sales_Export"

    headers = list(rows[0].keys())
    ws.append(headers)

    for r in rows:
        ws.append([r[h] for h in headers])

    wb.save(filepath)


def main():
    print("[*] Generating synthetic POS dataset for The Spice Garden Cafe & Bistro...")
    rows = generate_dataset(days_count=112)
    print(f"[*] Generated {len(rows):,} order line items across 112 days.")

    data_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
    csv_path = os.path.join(data_dir, "synthetic_spice_garden_pos_orders.csv")
    xlsx_path = os.path.join(data_dir, "synthetic_spice_garden_pos_orders.xlsx")

    write_csv(rows, csv_path)
    print(f"[+] Successfully wrote CSV: {csv_path} ({os.path.getsize(csv_path) / 1024:.1f} KB)")

    write_xlsx(rows, xlsx_path)
    if os.path.exists(xlsx_path):
        print(f"[+] Successfully wrote XLSX: {xlsx_path} ({os.path.getsize(xlsx_path) / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
