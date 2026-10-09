export interface ForecastSummary {
  week: number
  total_predicted_orders: number
  average_predicted_orders: number
  highest_demand_category: string
  highest_demand_city: string
}

export interface HistorySummary {
  week: number
  total_orders: number
  average_orders: number
}

export interface InventoryRecommendation {
  week: number
  center_id: number
  meal_id: number
  predicted_orders: number
  prep_0pct: number
  prep_10pct: number
  prep_15pct: number
  prep_20pct: number
  potential_surplus_10pct: number
  potential_surplus_15pct: number
  potential_surplus_20pct: number
}

export interface CenterInfo {
  center_id: number
  city_code: number
  region_code: number
  center_type: string
  op_area: number
  simulated_city: string
  state: string
  latitude: number
  longitude: number
}

export interface MealInfo {
  meal_id: number
  category: string
  cuisine: string
}

export interface DetailedForecast {
  id: number
  week: number
  center_id: number
  meal_id: number
  category: string
  cuisine: string
  simulated_city: string
  state: string
  start_date: string
  checkout_price: number
  predicted_orders: number
}
export interface CenterAnalysis {
  trend?: any[];
  center_id: number;
  simulated_city: string;
  state: string;
  center_type: string;
  op_area: number;
  latitude: number;
  longitude: number;
  predicted_orders: number;
  peak_week: number;
  share_of_network: number;
  average_weekly_orders: number;
  weekly_trajectory: { week: number; predicted_orders: number }[];
  historical_trajectory: { week: number; num_orders: number }[];
  top_categories: { category: string; predicted_orders: number }[];
  top_meals: { meal_id: number; category: string; cuisine: string; predicted_orders: number }[];
}

export interface CenterContribution {
  center_id: number
  simulated_city: string
  center_type: string
  predicted_orders: number
}

export interface MealAnalysis {
  trend?: any[];
  meal_id: number
  category: string
  cuisine: string
  predicted_orders: number
  historical_orders: number
  share_of_network: number
  average_weekly_orders: number
  peak_week: number
  weekly_trajectory: { week: number, predicted_orders: number }[]
  historical_trajectory: { week: number, num_orders: number }[]
  center_contributions: CenterContribution[]
}

