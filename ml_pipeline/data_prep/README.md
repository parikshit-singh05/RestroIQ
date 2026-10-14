# RestroIQ Data Preparation & Feature Engineering Pipeline

This directory provides the end-to-end data preparation code to reconstruct `restroiq_train_features_repaired.csv` and `restroiq_test_features_repaired.csv` from raw Kaggle source files and external metadata mappings.

## Inputs
- `data/raw/train.csv`: Historical demand records (Weeks 1 to 145)
- `data/raw/test.csv`: Future fulfillment records (Weeks 146 to 155)
- `data/external/meal_info.csv`: Meal taxonomy (`category`, `cuisine`)
- `data/external/fulfilment_center_info.csv`: Center metadata (`center_type`, `op_area`, etc.)
- `data/external/center_location_mapping.csv`: Simulated geographic coordinates and cities
- `data/external/week_date_mapping.csv`: Weekly date intervals
- `data/processed/holiday_week_features.csv`: Holiday occurrence features
- `data/processed/weather_weekly.csv`: Simulated weekly weather features

## Feature Engineering Methodology
1. **Enrichment:** Base transaction records are joined with center, meal, calendar, holiday, and weather datasets.
2. **Zero-Leakage Weather Shift:** Weather features (`prev_avg_temperature`, `prev_total_precipitation`, etc.) are shifted by 1 week ($W - 1$), ensuring forecasts strictly rely on observed prior-week meteorological conditions.
3. **Pricing Signals:** `discount_amount`, `discount_percent`, and `price_ratio` are derived from `base_price` and `checkout_price`.
4. **Calendar Signals:** `month`, `quarter`, `year`, `week_of_year`, `is_month_start`, `is_month_end`, and trigonometric cyclic encoding (`week_sin`, `week_cos`).
5. **Historical Demand Lags & Rolling Statistics:**
   - Lags: `lag_1_orders`, `lag_2_orders`, `lag_3_orders`, `lag_4_orders`.
   - Rolling windows: `rolling_4_mean`, `rolling_8_mean`, `rolling_12_mean`.
   - All lags and rolling statistics are calculated strictly using past observations to prevent target leakage.

## Execution
```bash
python prepare_features.py --data-dir ../../data --validate
```
To output newly generated CSVs to a custom directory:
```bash
python prepare_features.py --data-dir ../../data --output-dir ../../data/processed_new
```
