# RestroIQ Modeling Benchmark

This directory contains the artifacts produced by the true walk-forward validation process across weeks 136-145.

## Methodology
- **Validation:** Strict chronological walk-forward. Validation week demands were predicted recursively. No future actual target values were used to compute historical lags/rolling features. This guarantees a leakage-free benchmark.
- **Models Evaluated:** Baseline (Previous Week Demand), Random Forest, and Extra Trees. (Scripts in `ml_pipeline/training/train_models.py` include support for XGBoost, LightGBM, and CatBoost when their respective libraries are installed).
- **Target Transformation:** Both raw `num_orders` and `log1p(num_orders)` were modeled and evaluated independently.
- **Metrics Evaluated:** MAE, RMSE, RMSLE, R2.

## Benchmark Results (from `model_comparison.csv`)
| Model | Target | MAE | RMSE | RMSLE | R² |
|---|---|---|---|---|---|
| Baseline | raw | 112.06 | 214.62 | 1.5691 | 0.3979 |
| RandomForest | raw | 76.21 | 132.55 | 0.5753 | 0.7703 |
| **RandomForest** | **log1p** | **76.37** | **141.75** | **0.5331** | **0.7374** |
| ExtraTrees | raw | 74.02 | 120.41 | 0.5913 | 0.8105 |
| ExtraTrees | log1p | 74.14 | 128.97 | 0.5357 | 0.7826 |

## Best Model Selection
**RandomForest (log1p)** achieved the best RMSLE of **0.5331**, outperforming the naïve baseline (RMSLE 1.5691) by over 66%.

## Saved Artifacts
- `best_model.pkl`: The trained best model instance (RandomForestRegressor, n_estimators=30, max_depth=12).
- `categorical_encoder.pkl`: OrdinalEncoder fitted strictly on the training data.
- `model_comparison.csv`: The complete matrix of metrics for evaluated models and transformations.
- `model_metadata.json`: Feature and column configuration necessary for serving the model.
