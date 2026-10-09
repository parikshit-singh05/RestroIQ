import pandas as pd
import os
from app.core.config import settings
import math

class DataService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DataService, cls).__new__(cls)
            cls._instance._load_data()
        return cls._instance

    def _load_data(self):
        try:
            self.summary_df = pd.read_csv(os.path.join(settings.PROCESSED_DIR, "forecast_summary.csv"))
            self.inventory_df = pd.read_csv(os.path.join(settings.PROCESSED_DIR, "inventory_recommendations.csv"))
            self.detailed_df = pd.read_csv(os.path.join(settings.PROCESSED_DIR, "restroiq_forecasts_detailed.csv"))
            
            # Load historical data for chart context
            train_raw = pd.read_csv(os.path.join(settings.DATA_DIR, "raw", "train.csv"))
            recent_hist = train_raw[(train_raw['week'] >= 136) & (train_raw['week'] <= 145)]
            hist_grouped = recent_hist.groupby('week').agg(
                total_orders=('num_orders', 'sum'),
                average_orders=('num_orders', 'mean')
            ).reset_index()
            self.history_df = hist_grouped
            
            center_info = pd.read_csv(os.path.join(settings.EXTERNAL_DIR, "fulfilment_center_info.csv"))
            center_loc = pd.read_csv(os.path.join(settings.EXTERNAL_DIR, "center_location_mapping.csv"))
            self.centers_df = pd.merge(center_info, center_loc, on="center_id", how="left").rename(columns={"city_code_x": "city_code", "region_code_x": "region_code"}).drop(columns=["city_code_y", "region_code_y"], errors="ignore")
            
            self.meals_df = pd.read_csv(os.path.join(settings.EXTERNAL_DIR, "meal_info.csv"))
            
            # Load lightweight analytics dataframe
            cols = ['week', 'center_id', 'meal_id', 'num_orders', 'category', 'cuisine', 'simulated_city', 'emailer_for_promotion', 'homepage_featured', 'holiday_present', 'prev_avg_humidity', 'prev_total_precipitation', 'prev_avg_temperature', 'discount_percent']
            self.analytics_df = pd.read_csv(os.path.join(settings.PROCESSED_DIR, "restroiq_train_features_repaired.csv"), usecols=cols)
            import json
            with open(os.path.join(settings.PROCESSED_DIR, "feature_importances.json"), "r") as f:
                self.feature_importances = json.load(f)

            print("Data loaded successfully into memory.")
        except Exception as e:
            print(f"Error loading data: {e}")
            raise e

    def _clean_dict(self, records):
        clean = []
        for r in records:
            clean.append({k: (None if isinstance(v, float) and math.isnan(v) else v) for k, v in r.items()})
        return clean

    def get_forecast_summary(self):
        return self._clean_dict(self.summary_df.to_dict(orient="records"))
        
    def get_history_summary(self):
        return self._clean_dict(self.history_df.to_dict(orient="records"))

    def get_inventory(self, week: int = None, limit: int = 1000):
        df = self.inventory_df
        if week:
            df = df[df['week'] == week]
        return self._clean_dict(df.head(limit).to_dict(orient="records"))

    def get_detailed_forecasts(self, week: int = None, limit: int = 1000):
        df = self.detailed_df
        if week is not None:
            df = df[df['week'] == week]
        return self._clean_dict(df.head(limit).to_dict(orient="records"))

    def get_centers(self):
        return self._clean_dict(self.centers_df.to_dict(orient="records"))

    def get_meals(self):
        return self._clean_dict(self.meals_df.to_dict(orient="records"))



    def get_analytics(self, start_week: int = None, end_week: int = None, city: str = None, center_id: int = None, category: str = None, cuisine: str = None):
        df = self.analytics_df
        
        if start_week: df = df[df['week'] >= start_week]
        if end_week: df = df[df['week'] <= end_week]
        if city: df = df[df['simulated_city'] == city]
        if center_id: df = df[df['center_id'] == center_id]
        if category: df = df[df['category'] == category]
        if cuisine: df = df[df['cuisine'] == cuisine]
        
        if df.empty:
            return {"trend": [], "distribution": {}, "promotion": {}, "context": {}, "model": self.feature_importances}
            
        # 1. Trend
        trend = df.groupby('week').agg(
            total_orders=('num_orders', 'sum'),
            average_orders=('num_orders', 'mean')
        ).reset_index().to_dict(orient='records')
        
        # 2. Distribution (Totals by Category, Cuisine, Center, City)
        total_filtered_demand = int(df['num_orders'].sum())
        def get_dist(col):
            d = df.groupby(col)['num_orders'].sum().reset_index()
            d.columns = ['name', 'value']
            return d.sort_values('value', ascending=False).head(20).to_dict(orient='records')
            
        distribution = {
            "total_demand": total_filtered_demand,
            "category": get_dist('category'),
            "cuisine": get_dist('cuisine'),
            "center": get_dist('center_id'),
            "city": get_dist('simulated_city')
        }
        
        # 3. Promotion
        def get_promo(col):
            d = df.groupby(col)['num_orders'].mean().reset_index()
            no_val = d[d[col] == 0]['num_orders'].values
            yes_val = d[d[col] == 1]['num_orders'].values
            return {
                "no": float(no_val[0]) if len(no_val) else 0.0,
                "yes": float(yes_val[0]) if len(yes_val) else 0.0,
                "no_n": int(len(df[df[col] == 0])),
                "yes_n": int(len(df[df[col] == 1]))
            }
            
        promotion = {
            "emailer": get_promo('emailer_for_promotion'),
            "homepage": get_promo('homepage_featured')
        }
        
        # 4. Context (Holiday and Weather)
        df_rain = df[df['prev_total_precipitation'] > 0]
        df_no_rain = df[df['prev_total_precipitation'] <= 0]
        rain_yes_mean = float(df_rain['num_orders'].mean()) if not df_rain.empty else 0.0
        rain_no_mean = float(df_no_rain['num_orders'].mean()) if not df_no_rain.empty else 0.0

        context = {
            "holiday": get_promo('holiday_present'),
            "rain": {
                "yes": rain_yes_mean,
                "no": rain_no_mean,
                "yes_n": len(df_rain),
                "no_n": len(df_no_rain)
            }
        }
        
        return {
            "trend": trend,
            "distribution": distribution,
            "promotion": promotion,
            "context": context,
            "model": self.feature_importances
        }




    def get_centers_analysis(self):
        try:
            df = self.detailed_df
            
            # 1. Total predicted demand
            center_totals = df.groupby('center_id')['predicted_orders'].sum().reset_index()
            total_network_demand = center_totals['predicted_orders'].sum()
            if total_network_demand == 0: total_network_demand = 1
            
            # 2. Peak week
            weekly = df.groupby(['center_id', 'week'])['predicted_orders'].sum().reset_index()
            idx = weekly.groupby('center_id')['predicted_orders'].idxmax()
            peak_weeks = weekly.loc[idx][['center_id', 'week']].rename(columns={'week': 'peak_week'})
            
            # 3. Weekly trajectory
            weekly_traj = weekly.groupby('center_id').apply(
                lambda x: x[['week', 'predicted_orders']].to_dict(orient='records')
            ).reset_index(name='weekly_trajectory')
            
            # 4. Top categories
            cats = df.groupby(['center_id', 'category'])['predicted_orders'].sum().reset_index()
            cats = cats.sort_values(['center_id', 'predicted_orders'], ascending=[True, False])
            top_cats = cats.groupby('center_id').apply(
                lambda x: x[['category', 'predicted_orders']].to_dict(orient='records')
            ).reset_index(name='top_categories')
            
            # 5. Top meals (limit 10)
            meals = df.groupby(['center_id', 'meal_id', 'category', 'cuisine'])['predicted_orders'].sum().reset_index()
            meals = meals.sort_values(['center_id', 'predicted_orders'], ascending=[True, False])
            top_meals = meals.groupby('center_id').apply(
                lambda x: x.head(20).to_dict(orient='records')
            ).reset_index(name='top_meals')
            
            # 6. Historical trajectory (Weeks 136-145)
            hist_df = self.analytics_df[(self.analytics_df['week'] >= 136) & (self.analytics_df['week'] <= 145)]
            hist_weekly = hist_df.groupby(['center_id', 'week'])['num_orders'].sum().reset_index()
            hist_traj = hist_weekly.groupby('center_id').apply(
                lambda x: x[['week', 'num_orders']].to_dict(orient='records')
            ).reset_index(name='historical_trajectory')
            
            # Merge
            res = self.centers_df.copy()
            res = pd.merge(res, center_totals, on='center_id', how='left')
            res = pd.merge(res, peak_weeks, on='center_id', how='left')
            res = pd.merge(res, weekly_traj, on='center_id', how='left')
            res = pd.merge(res, top_cats, on='center_id', how='left')
            res = pd.merge(res, top_meals, on='center_id', how='left')
            res = pd.merge(res, hist_traj, on='center_id', how='left')
            
            # Derived
            res['share_of_network'] = (res['predicted_orders'] / total_network_demand) * 100
            res['average_weekly_orders'] = res['predicted_orders'] / 10.0
            
            res = res.fillna({
                'predicted_orders': 0, 'peak_week': 0, 'share_of_network': 0, 'average_weekly_orders': 0
            })
            
            # Convert non-scalar lists safely (NaNs in dicts are handled by _clean_dict later, but let's be careful with empty lists)
            
            records = res.to_dict(orient='records')
            for r in records:
                if not isinstance(r.get('weekly_trajectory'), list): r['weekly_trajectory'] = []
                if not isinstance(r.get('top_categories'), list): r['top_categories'] = []
                if not isinstance(r.get('top_meals'), list): r['top_meals'] = []
                if not isinstance(r.get('historical_trajectory'), list): r['historical_trajectory'] = []
                
            return self._clean_dict(records)
        except Exception as e:
            print("Error in get_centers_analysis:", e)
            raise e




    def get_meals_analysis(self, week: int = None, city: str = None, center_id: int = None, category: str = None, cuisine: str = None):
        try:
            df_traj = self.detailed_df
            hist = self.analytics_df[(self.analytics_df['week'] >= 136) & (self.analytics_df['week'] <= 145)]
            
            if city: df_traj = df_traj[df_traj['simulated_city'] == city]
            if center_id: df_traj = df_traj[df_traj['center_id'] == center_id]
            if category: df_traj = df_traj[df_traj['category'] == category]
            if cuisine: df_traj = df_traj[df_traj['cuisine'] == cuisine]
            
            df = df_traj.copy()
            if week is not None: 
                df = df[df['week'] == week]
            
            if city: hist = hist[hist['simulated_city'] == city]
            if center_id: hist = hist[hist['center_id'] == center_id]
            if category: hist = hist[hist['category'] == category]
            if cuisine: hist = hist[hist['cuisine'] == cuisine]
            
            meal_totals = df.groupby('meal_id')['predicted_orders'].sum().reset_index() if not df.empty else pd.DataFrame(columns=['meal_id', 'predicted_orders'])
            total_network_demand = meal_totals['predicted_orders'].sum() if not meal_totals.empty else 1
            if total_network_demand == 0: total_network_demand = 1
            
            if not df_traj.empty:
                weekly = df_traj.groupby(['meal_id', 'week'])['predicted_orders'].sum().reset_index()
                idx = weekly.groupby('meal_id')['predicted_orders'].idxmax()
                peak_weeks = weekly.loc[idx][['meal_id', 'week']].rename(columns={'week': 'peak_week'})
                weekly_traj = weekly.groupby('meal_id').apply(lambda x: x[['week', 'predicted_orders']].to_dict(orient='records')).reset_index(name='weekly_trajectory')
            else:
                peak_weeks = pd.DataFrame(columns=['meal_id', 'peak_week'])
                weekly_traj = pd.DataFrame(columns=['meal_id', 'weekly_trajectory'])

            if not df.empty:
                center_contrib = df.groupby(['meal_id', 'center_id'])['predicted_orders'].sum().reset_index()
                center_contrib = center_contrib.merge(self.centers_df[['center_id', 'simulated_city', 'center_type']], on='center_id', how='left')
                center_contrib = center_contrib.sort_values(['meal_id', 'predicted_orders'], ascending=[True, False])
                center_contrib_dict = center_contrib.groupby('meal_id').apply(lambda x: x[['center_id', 'simulated_city', 'center_type', 'predicted_orders']].to_dict(orient='records')).reset_index(name='center_contributions')
            else:
                center_contrib_dict = pd.DataFrame(columns=['meal_id', 'center_contributions'])
                
            if not hist.empty:
                hist_weekly = hist.groupby(['meal_id', 'week'])['num_orders'].sum().reset_index()
                hist_traj = hist_weekly.groupby('meal_id').apply(lambda x: x[['week', 'num_orders']].to_dict(orient='records')).reset_index(name='historical_trajectory')
            else:
                hist_traj = pd.DataFrame(columns=['meal_id', 'historical_trajectory'])
                
            meals_base = self.meals_df.copy()
            if category: meals_base = meals_base[meals_base['category'] == category]
            if cuisine: meals_base = meals_base[meals_base['cuisine'] == cuisine]
            
            res = meals_base
            res = res.merge(meal_totals, on='meal_id', how='left')
            res = res.merge(peak_weeks, on='meal_id', how='left')
            res = res.merge(weekly_traj, on='meal_id', how='left')
            res = res.merge(hist_traj, on='meal_id', how='left')
            res = res.merge(center_contrib_dict, on='meal_id', how='left')
            
            res['share_of_network'] = (res['predicted_orders'].fillna(0) / total_network_demand) * 100
            
            num_weeks = 1 if week is not None else 10
            res['average_weekly_orders'] = res['predicted_orders'].fillna(0) / num_weeks
            
            res = res.fillna({'predicted_orders': 0, 'peak_week': 0, 'share_of_network': 0, 'average_weekly_orders': 0})
            
            records = res.to_dict(orient='records')
            for r in records:
                if not isinstance(r.get('weekly_trajectory'), list): r['weekly_trajectory'] = []
                if not isinstance(r.get('historical_trajectory'), list): r['historical_trajectory'] = []
                if not isinstance(r.get('center_contributions'), list): r['center_contributions'] = []
                
            return self._clean_dict(records)
        except Exception as e:
            print("Error in get_meals_analysis:", e)
            raise e



data_service = DataService()
