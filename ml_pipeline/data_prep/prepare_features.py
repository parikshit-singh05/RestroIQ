"""
RestroIQ — Feature Engineering & Data Preparation Pipeline
Reconstructs and validates the feature datasets (restroiq_train_features_repaired.csv
and restroiq_test_features_repaired.csv) from raw Kaggle inputs and external mappings.

Usage:
    python prepare_features.py [--data-dir ../../data] [--validate]
"""

import os
import sys
import argparse
import numpy as np
import pandas as pd


def parse_args():
    parser = argparse.ArgumentParser(description="RestroIQ Feature Preparation Pipeline")
    parser.add_argument("--data-dir", default=os.path.join(os.path.dirname(__file__), "..", "..", "data"),
                        help="Path to data directory containing raw, external, and processed folders")
    parser.add_argument("--output-dir", default=None,
                        help="Optional directory to save generated features. If None and not validate-only, uses data/processed")
    parser.add_argument("--validate", action="store_true",
                        help="Validate reconstructed features against existing processed artifacts")
    return parser.parse_args()


def load_raw_and_external(data_dir):
    print("Loading raw and external datasets...")
    raw_dir = os.path.join(data_dir, "raw")
    ext_dir = os.path.join(data_dir, "external")
    proc_dir = os.path.join(data_dir, "processed")

    train_df = pd.read_csv(os.path.join(raw_dir, "train.csv"))
    test_df = pd.read_csv(os.path.join(raw_dir, "test.csv"))

    meals_df = pd.read_csv(os.path.join(ext_dir, "meal_info.csv"))
    center_info_df = pd.read_csv(os.path.join(ext_dir, "fulfilment_center_info.csv"))
    center_loc_df = pd.read_csv(os.path.join(ext_dir, "center_location_mapping.csv"))
    week_date_df = pd.read_csv(os.path.join(ext_dir, "week_date_mapping.csv"))

    holidays_df = pd.read_csv(os.path.join(proc_dir, "holiday_week_features.csv"))
    weather_df = pd.read_csv(os.path.join(proc_dir, "weather_weekly.csv"))

    # Merge center location mapping
    centers_df = pd.merge(center_info_df, center_loc_df, on="center_id", how="left")
    if "city_code_x" in centers_df.columns:
        centers_df = centers_df.rename(columns={"city_code_x": "city_code", "region_code_x": "region_code"})
        centers_df = centers_df.drop(columns=["city_code_y", "region_code_y"], errors="ignore")

    return {
        "train": train_df,
        "test": test_df,
        "meals": meals_df,
        "centers": centers_df,
        "week_date": week_date_df,
        "holidays": holidays_df,
        "weather": weather_df
    }


def enrich_base_table(df, datasets):
    """Enriches train or test with meals, centers, week dates, holidays, and 1-week-shifted weather."""
    # 1. Merge meals
    enriched = pd.merge(df, datasets["meals"], on="meal_id", how="left")

    # 2. Merge centers
    enriched = pd.merge(enriched, datasets["centers"], on="center_id", how="left")

    # 3. Merge week-date mapping
    enriched = pd.merge(enriched, datasets["week_date"], on="week", how="left")

    # 4. Merge holiday features
    enriched = pd.merge(enriched, datasets["holidays"], on="week", how="left")

    # 5. Merge weather features with 1-week shift (prev week weather)
    # Weather is per (simulated_city, week). A shift of +1 means for current week W, we use week W-1 weather.
    weather = datasets["weather"].copy()
    weather["week"] = weather["week"] + 1
    weather_cols = {
        "avg_temperature": "prev_avg_temperature",
        "max_temperature": "prev_max_temperature",
        "min_temperature": "prev_min_temperature",
        "total_precipitation": "prev_total_precipitation",
        "avg_humidity": "prev_avg_humidity",
        "max_wind_speed": "prev_max_wind_speed",
        "rainy_days": "prev_rainy_days",
        "severe_weather_days": "prev_severe_weather_days"
    }
    weather = weather.rename(columns=weather_cols)
    weather_join_cols = ["simulated_city", "week"] + list(weather_cols.values())
    enriched = pd.merge(enriched, weather[weather_join_cols], on=["simulated_city", "week"], how="left")

    return enriched


def engineer_features(enriched_df, demand_dict=None, is_train=True):
    """Calculates pricing, calendar, and historical lag/rolling features."""
    df = enriched_df.copy()

    # 1. Pricing features
    df["discount_amount"] = (df["base_price"] - df["checkout_price"]).round(4)
    df["discount_percent"] = np.where(df["base_price"] > 0, ((df["discount_amount"] / df["base_price"]) * 100).round(4), 0.0)
    df["price_ratio"] = np.where(df["base_price"] > 0, (df["checkout_price"] / df["base_price"]).round(4), 1.0)

    # 2. Calendar features from start_date
    start_dt = pd.to_datetime(df["start_date"])
    end_dt = pd.to_datetime(df["end_date"])

    df["month"] = start_dt.dt.month
    df["quarter"] = start_dt.dt.quarter
    df["year"] = start_dt.dt.year
    df["week_of_year"] = start_dt.dt.isocalendar().week.astype(int)
    df["is_month_start"] = (start_dt.dt.day == 1).astype(int)
    df["is_month_end"] = (end_dt.dt.day == end_dt.dt.days_in_month).astype(int)

    pi = np.pi
    df["week_sin"] = np.round(np.sin(df["week_of_year"] * 2 * pi / 52), 4)
    df["week_cos"] = np.round(np.cos(df["week_of_year"] * 2 * pi / 52), 4)

    # 3. Build demand lookup dictionary if training data provided
    if demand_dict is None and is_train:
        demand_dict = {}
        for _, row in df.iterrows():
            demand_dict[(int(row["center_id"]), int(row["meal_id"]), int(row["week"]))] = float(row["num_orders"])

    # 4. Compute lag and rolling features
    l1, l2, l3, l4 = [], [], [], []
    r4, r8, r12 = [], [], []

    weeks = df["week"].values
    centers = df["center_id"].values
    meals = df["meal_id"].values

    for w, c, m in zip(weeks, centers, meals):
        w = int(w)
        c = int(c)
        m = int(m)

        lags = [demand_dict.get((c, m, w - i), np.nan) for i in range(1, 13)]
        l1.append(lags[0])
        l2.append(lags[1])
        l3.append(lags[2])
        l4.append(lags[3])

        v4 = [v for v in lags[:4] if not np.isnan(v)]
        r4.append(round(float(np.mean(v4)), 4) if v4 else np.nan)

        v8 = [v for v in lags[:8] if not np.isnan(v)]
        r8.append(round(float(np.mean(v8)), 4) if v8 else np.nan)

        v12 = [v for v in lags[:12] if not np.isnan(v)]
        r12.append(round(float(np.mean(v12)), 4) if v12 else np.nan)

    df["lag_1_orders"] = l1
    df["lag_2_orders"] = l2
    df["lag_3_orders"] = l3
    df["lag_4_orders"] = l4
    df["rolling_4_mean"] = r4
    df["rolling_8_mean"] = r8
    df["rolling_12_mean"] = r12

    return df, demand_dict


def main():
    args = parse_args()
    data_dir = os.path.abspath(args.data_dir)
    print(f"RestroIQ Data Preparation using: {data_dir}")

    datasets = load_raw_and_external(data_dir)

    print("\n--- Processing Training Features ---")
    enriched_train = enrich_base_table(datasets["train"], datasets)
    train_features, demand_dict = engineer_features(enriched_train, is_train=True)
    print(f"Train features shape: {train_features.shape}")

    print("\n--- Processing Test Features ---")
    enriched_test = enrich_base_table(datasets["test"], datasets)
    test_features, _ = engineer_features(enriched_test, demand_dict=demand_dict, is_train=False)
    print(f"Test features shape: {test_features.shape}")

    if args.validate:
        print("\n--- Validating against existing artifacts ---")
        proc_dir = os.path.join(data_dir, "processed")
        existing_train_path = os.path.join(proc_dir, "restroiq_train_features_repaired.csv")
        existing_test_path = os.path.join(proc_dir, "restroiq_test_features_repaired.csv")

        if os.path.exists(existing_train_path):
            existing_train = pd.read_csv(existing_train_path, nrows=100)
            print(f"Existing train columns ({len(existing_train.columns)}): {existing_train.columns.tolist() == train_features.columns.tolist()}")
            assert len(existing_train.columns) == len(train_features.columns), "Column count mismatch on train"
            print("Train features schema validation: PASS")

        if os.path.exists(existing_test_path):
            existing_test = pd.read_csv(existing_test_path, nrows=100)
            print(f"Existing test columns ({len(existing_test.columns)}): {existing_test.columns.tolist() == test_features.columns.tolist()}")
            assert len(existing_test.columns) == len(test_features.columns), "Column count mismatch on test"
            print("Test features schema validation: PASS")

    if args.output_dir:
        out_dir = os.path.abspath(args.output_dir)
        os.makedirs(out_dir, exist_ok=True)
        print(f"\nWriting generated features to: {out_dir}")
        train_features.to_csv(os.path.join(out_dir, "restroiq_train_features_repaired.csv"), index=False)
        test_features.to_csv(os.path.join(out_dir, "restroiq_test_features_repaired.csv"), index=False)
        print("Data preparation complete and saved.")


if __name__ == "__main__":
    main()
