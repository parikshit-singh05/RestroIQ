# RestroIQ Modeling Benchmark

This directory contains the artifacts produced by the true walk-forward validation process across weeks 136-145.

## Methodology
- **Validation:** Strict chronological walk-forward. Validation week demands were predicted recursively. No future actual target values were used to compute historical lags/rolling features. This guarantees a leakage-free benchmark.
- **Models Evaluated:** Baseline, Random Forest, XGBoost, LightGBM, CatBoost.
- **Target Transformation:** Both raw `num_orders` and `log1p(num_orders)` were modeled and evaluated independently.
- **Metrics Evaluated:** MAE, RMSE, RMSLE, R2.

## Best Model Selection
**RandomForest (log1p)** achieved the best RMSLE of **0.5331**.
*(Note: This model was fully retrained and revalidated after the exact weather-feature null correction was implemented).*

## Saved Artifacts
- `best_model.pkl`: The trained best model instance.
- `categorical_encoder.pkl`: OrdinalEncoder fitted strictly on the training data.
- `model_comparison.csv`: The complete matrix of metrics for all models and transformations.
- `model_metadata.json`: Feature and column configuration necessary for serving the model.
