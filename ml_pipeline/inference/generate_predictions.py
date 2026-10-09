import pandas as pd
import numpy as np
import json
import os
import joblib

dataset_dir = '../../data'
models_dir = '../../models'

print("Loading data and models...")
model = joblib.load(os.path.join(models_dir, 'best_model.pkl'))
encoder = joblib.load(os.path.join(models_dir, 'categorical_encoder.pkl'))

with open(os.path.join(models_dir, 'model_metadata.json'), 'r') as f:
    metadata = json.load(f)
features = metadata['features']
cat_cols = metadata['cat_cols']

train_df = pd.read_csv(os.path.join(dataset_dir, 'processed/restroiq_train_features_repaired.csv'))
test_df = pd.read_csv(os.path.join(dataset_dir, 'processed/restroiq_test_features_repaired.csv'))
orig_test = pd.read_csv(os.path.join(dataset_dir, 'raw/test.csv'))

# Pre-fill master demand
master_demand = {}
for _, row in train_df.iterrows():
    master_demand[(row['center_id'], row['meal_id'], row['week'])] = row['num_orders']

test_df = test_df.sort_values(['week', 'center_id', 'meal_id']).reset_index(drop=True)
all_preds = {} 
detailed_rows = []

print("Running strict recursive walk-forward forecasting for Weeks 146-155...")
for w in range(146, 156):
    w_df = test_df[test_df.week == w].copy()
    
    # Dynamically generate lag/rolling features using only PAST demand
    l1, l2, l3, l4 = [], [], [], []
    r4, r8, r12 = [], [], []
    
    for _, row in w_df.iterrows():
        c, m = row['center_id'], row['meal_id']
        lag_vals = [master_demand.get((c, m, w - i), np.nan) for i in range(1, 13)]
        
        l1.append(lag_vals[0])
        l2.append(lag_vals[1])
        l3.append(lag_vals[2])
        l4.append(lag_vals[3])
        
        v4 = [v for v in lag_vals[:4] if not np.isnan(v)]
        r4.append(np.mean(v4) if v4 else np.nan)
        
        v8 = [v for v in lag_vals[:8] if not np.isnan(v)]
        r8.append(np.mean(v8) if v8 else np.nan)
        
        v12 = [v for v in lag_vals[:12] if not np.isnan(v)]
        r12.append(np.mean(v12) if v12 else np.nan)
        
    w_df['lag_1_orders'] = l1
    w_df['lag_2_orders'] = l2
    w_df['lag_3_orders'] = l3
    w_df['lag_4_orders'] = l4
    w_df['rolling_4_mean'] = r4
    w_df['rolling_8_mean'] = r8
    w_df['rolling_12_mean'] = r12
    
    # Save original categorical features for detailed output before encoding
    w_df_orig = w_df.copy()
    
    # Encode categorical features
    w_df[cat_cols] = encoder.transform(w_df[cat_cols].astype(str))
    
    # Predict (Model expects log1p target, we use expm1 to transform back)
    X = w_df[features].fillna(-1)
    pred_log1p = model.predict(X)
    pred = np.maximum(0, np.expm1(pred_log1p))
    
    # Store predictions and recursively update master demand for FUTURE lags
    for idx, (_, row) in enumerate(w_df_orig.iterrows()):
        c, m, req_id = row['center_id'], row['meal_id'], row['id']
        p = pred[idx]
        
        master_demand[(c, m, w)] = p
        all_preds[req_id] = p
        
        detailed_rows.append({
            'id': req_id,
            'week': w,
            'center_id': c,
            'meal_id': m,
            'category': row['category'],
            'cuisine': row['cuisine'],
            'simulated_city': row['simulated_city'],
            'state': row['state'],
            'start_date': row['start_date'],
            'checkout_price': row['checkout_price'],
            'predicted_orders': p
        })

print("\nGenerating Output Files...")
# 1. Prediction CSV
preds_df = pd.DataFrame({'id': orig_test['id']})
preds_df['num_orders'] = preds_df['id'].map(all_preds)
preds_df.to_csv(os.path.join(dataset_dir, 'processed/restroiq_test_predictions.csv'), index=False)

# 2. Detailed Forecasts
detailed_df = pd.DataFrame(detailed_rows)
detailed_df.to_csv(os.path.join(dataset_dir, 'processed/restroiq_forecasts_detailed.csv'), index=False)

# 3. Inventory Recommendations
inv_df = detailed_df[['week', 'center_id', 'meal_id', 'predicted_orders']].copy()
inv_df['prep_0pct'] = np.ceil(inv_df['predicted_orders'])
for pct in [10, 15, 20]:
    mult = 1 + (pct / 100.0)
    inv_df[f'prep_{pct}pct'] = np.ceil(inv_df['predicted_orders'] * mult)
    inv_df[f'potential_surplus_{pct}pct'] = inv_df[f'prep_{pct}pct'] - inv_df['predicted_orders']
inv_df.to_csv(os.path.join(dataset_dir, 'processed/inventory_recommendations.csv'), index=False)

# 4. Business Summary
summary_rows = []
for w in range(146, 156):
    w_det = detailed_df[detailed_df.week == w]
    total_ord = w_det['predicted_orders'].sum()
    avg_ord = w_det['predicted_orders'].mean()
    top_cat = w_det.groupby('category')['predicted_orders'].sum().idxmax()
    top_city = w_det.groupby('simulated_city')['predicted_orders'].sum().idxmax()
    summary_rows.append({
        'week': w,
        'total_predicted_orders': total_ord,
        'average_predicted_orders': avg_ord,
        'highest_demand_category': top_cat,
        'highest_demand_city': top_city
    })
sum_df = pd.DataFrame(summary_rows)
sum_df.to_csv(os.path.join(dataset_dir, 'processed/forecast_summary.csv'), index=False)

print("\n--- FINAL VALIDATION REPORT ---")
print(f"Prediction Count: {len(preds_df)}")
print(f"Exact ID set/order match with test.csv: {preds_df['id'].equals(orig_test['id'])}")
print(f"Duplicate IDs: {preds_df['id'].duplicated().sum()}")
print(f"Missing Predictions: {preds_df['num_orders'].isna().sum()}")
print(f"Negative Predictions: {(preds_df['num_orders'] < 0).sum()}")
print(f"Weeks correctly bounded 146-155: {detailed_df['week'].min() == 146 and detailed_df['week'].max() == 155}")
print(f"Prediction structure exactly like sample_submission: {list(preds_df.columns) == ['id', 'num_orders']}")

print("\n--- PREDICTION STATISTICS ---")
print(f"Min: {preds_df['num_orders'].min():.2f}")
print(f"Mean: {preds_df['num_orders'].mean():.2f}")
print(f"Median: {preds_df['num_orders'].median():.2f}")
print(f"Max: {preds_df['num_orders'].max():.2f}")

print("\n--- WEEKLY TOTALS ---")
for w, tot in zip(sum_df['week'], sum_df['total_predicted_orders']):
    print(f"Week {w}: {tot:.0f} orders")

print("\n--- TOP 10 CENTER/MEAL COMBOS (Total Demand) ---")
top10 = inv_df.groupby(['center_id', 'meal_id'])['predicted_orders'].sum().reset_index().sort_values('predicted_orders', ascending=False).head(10)
for _, row in top10.iterrows():
    print(f"Center {row['center_id']:>3} | Meal {row['meal_id']:>4} -> {row['predicted_orders']:>5.0f} total orders")

print("\n--- GENERATED FILES ---")
print("1. dataset/restroiq_test_predictions.csv")
print("2. dataset/restroiq_forecasts_detailed.csv")
print("3. dataset/inventory_recommendations.csv")
print("4. dataset/forecast_summary.csv")
print("\nFORECAST PIPELINE COMPLETED SUCCESSFULLY.")

