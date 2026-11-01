"""
RestroIQ 3.0 — Operations Service
Handles:
- Restaurant Analytics & Sales Trends
- Predictive Inventory Preparation & Safety Buffers
- Menu Intelligence & Lifecycle Tracking
- Multi-Branch Extended Management & Outlets Metrics
- Restaurant Profile & Team Member Role Management
"""

import math
import uuid
from datetime import datetime, date, timedelta, timezone
from typing import Dict, List, Optional, Any, Tuple
from collections import defaultdict

import pandas as pd

from app.core.config import settings
from app.core.supabase import get_tenant_supabase_client
from app.core.security import has_sufficient_role
from app.services.tenant_service import tenant_service
from app.services.ingestion_service import ingestion_service
from app.services.forecasting_service import forecasting_service
from app.schemas.operations_schemas import (
    TenantAnalyticsResponse,
    AnalyticsTimelinePoint,
    CategorySalesItem,
    TopSellingItem,
    SlowMovingItem,
    BranchComparisonItem,
    DayOfWeekDistribution,
    PromotionAnalysis,
    ModelAccuracySummary,
    TenantInventoryResponse,
    InventoryPrepItem,
    ForecastVsActualPoint,
    PrepTargetsSummary,
    TenantMenuResponse,
    MenuItemDetail,
    MenuItemCreate,
    MenuItemUpdate,
    BranchDetailResponse,
    BranchUpdate,
    RestaurantProfileUpdate
)


class OperationsService:
    def __init__(self):
        # In-memory stores for menu items metadata cache
        self._menu_catalog: Dict[str, List[Dict[str, Any]]] = defaultdict(list)

    # ==========================================================================
    # 1. RESTAURANT ANALYTICS WORKSPACE
    # ==========================================================================

    def get_restaurant_analytics(
        self,
        restaurant_id: str,
        branch_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        category: Optional[str] = None,
        user_jwt: Optional[str] = None
    ) -> TenantAnalyticsResponse:
        """
        Computes restaurant analytics strictly from genuine POS transaction records.
        Filters out synthetic sample data and cancelled/refunded orders.
        """
        # Fetch order records
        records = ingestion_service._orders.get(restaurant_id, [])

        if not records and settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                q = client.table("normalized_order_items").select("*").eq("restaurant_id", restaurant_id)
                res = q.execute()
                if res.data:
                    records = res.data
                    ingestion_service._orders[restaurant_id] = records
            except Exception as e:
                print(f"[OperationsService] Supabase read note: {e}")

        # Clean genuine orders
        clean_records = []
        for r in records:
            if r.get("promotion_tag") == "synthetic_sample" or str(r.get("order_id", "")).startswith("SAMPLE-SG-"):
                continue
            if r.get("order_status") in ("cancelled", "refunded"):
                continue
            clean_records.append(r)

        # Apply filters
        if branch_id:
            clean_records = [r for r in clean_records if r.get("branch_id") == branch_id]
        if category:
            clean_records = [r for r in clean_records if r.get("category", "").lower() == category.lower()]
        if start_date:
            clean_records = [r for r in clean_records if str(r.get("order_date", "")) >= start_date]
        if end_date:
            clean_records = [r for r in clean_records if str(r.get("order_date", "")) <= end_date]

        # Restaurant currency
        rest_meta = tenant_service._restaurants.get(restaurant_id, {})
        currency = rest_meta.get("currency", "INR")
        currency_symbol = rest_meta.get("currency_symbol", "₹")

        # Empty state handling
        if not clean_records:
            return TenantAnalyticsResponse(
                restaurant_id=restaurant_id,
                branch_id=branch_id,
                currency=currency,
                currency_symbol=currency_symbol,
                total_revenue=0.0,
                total_orders=0,
                average_order_value=0.0,
                total_units_sold=0.0,
                timeline=[],
                category_distribution=[],
                top_selling_items=[],
                slow_moving_items=[],
                branch_comparison=[],
                day_of_week_distribution=[
                    DayOfWeekDistribution(day_name=name, day_index=idx, orders=0, revenue=0.0)
                    for idx, name in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
                ],
                promotion_analysis=PromotionAnalysis(
                    has_promotions=False,
                    promo_orders_count=0,
                    promo_revenue=0.0,
                    regular_orders_count=0,
                    regular_revenue=0.0,
                    promo_aov=0.0,
                    regular_aov=0.0,
                    promo_share_pct=0.0
                ),
                model_accuracy=None,
                data_sufficiency="insufficient"
            )

        # Aggregate data structures
        total_revenue = 0.0
        total_units = 0.0
        order_ids_set = set()
        order_revenues: Dict[str, float] = defaultdict(float)

        daily_revenue: Dict[str, float] = defaultdict(float)
        daily_units: Dict[str, float] = defaultdict(float)
        daily_order_ids: Dict[str, set] = defaultdict(set)

        category_revenue: Dict[str, float] = defaultdict(float)
        category_quantity: Dict[str, float] = defaultdict(float)

        item_quantity: Dict[str, float] = defaultdict(float)
        item_revenue: Dict[str, float] = defaultdict(float)
        item_category_map: Dict[str, str] = {}
        item_last_sale: Dict[str, str] = {}

        dow_revenue: Dict[int, float] = defaultdict(float)
        dow_order_ids: Dict[int, set] = defaultdict(set)

        promo_revenue = 0.0
        regular_revenue = 0.0
        promo_orders = set()
        regular_orders = set()

        branch_orders_map: Dict[str, set] = defaultdict(set)
        branch_revenue_map: Dict[str, float] = defaultdict(float)

        for r in clean_records:
            ord_id = str(r.get("order_id", ""))
            d_str = str(r.get("order_date", ""))
            cat = str(r.get("category", "General"))
            it_name = str(r.get("item_name", "Item"))
            b_id = str(r.get("branch_id", ""))
            qty = float(r.get("quantity") or 0.0)
            net_sales = float(r.get("net_sales") or (qty * float(r.get("unit_price") or 0.0)))
            promo_tag = str(r.get("promotion_tag") or "none").strip().lower()

            total_revenue += net_sales
            total_units += qty
            order_ids_set.add(ord_id)
            order_revenues[ord_id] += net_sales

            # Daily timeline
            daily_revenue[d_str] += net_sales
            daily_units[d_str] += qty
            daily_order_ids[d_str].add(ord_id)

            # Category
            category_revenue[cat] += net_sales
            category_quantity[cat] += qty

            # Item
            item_quantity[it_name] += qty
            item_revenue[it_name] += net_sales
            item_category_map[it_name] = cat
            if it_name not in item_last_sale or d_str > item_last_sale[it_name]:
                item_last_sale[it_name] = d_str

            # Day of week
            try:
                dt_obj = pd.to_datetime(d_str)
                dow = dt_obj.weekday()  # 0 = Monday, 6 = Sunday
                dow_revenue[dow] += net_sales
                dow_order_ids[dow].add(ord_id)
            except Exception:
                pass

            # Promotion analysis
            if promo_tag not in ("none", "", "null", "false"):
                promo_revenue += net_sales
                promo_orders.add(ord_id)
            else:
                regular_revenue += net_sales
                regular_orders.add(ord_id)

            # Branch
            if b_id:
                branch_orders_map[b_id].add(ord_id)
                branch_revenue_map[b_id] += net_sales

        # Average Order Value strictly calculated
        total_orders_count = len(order_ids_set)
        aov = round(total_revenue / total_orders_count, 2) if total_orders_count > 0 else 0.0

        # Timeline
        timeline: List[AnalyticsTimelinePoint] = []
        for d in sorted(daily_revenue.keys()):
            timeline.append(AnalyticsTimelinePoint(
                date=d,
                revenue=round(daily_revenue[d], 2),
                orders=len(daily_order_ids[d]),
                units_sold=round(daily_units[d], 1)
            ))

        # Category distribution
        category_distribution: List[CategorySalesItem] = []
        for cat, c_rev in sorted(category_revenue.items(), key=lambda x: x[1], reverse=True):
            pct = round((c_rev / total_revenue) * 100.0, 1) if total_revenue > 0 else 0.0
            category_distribution.append(CategorySalesItem(
                category=cat,
                revenue=round(c_rev, 2),
                quantity=round(category_quantity[cat], 1),
                percentage=pct
            ))

        # Top selling items (top 10 by quantity)
        sorted_items = sorted(item_quantity.items(), key=lambda x: x[1], reverse=True)
        top_selling: List[TopSellingItem] = []
        for it_name, qty in sorted_items[:10]:
            rev = item_revenue[it_name]
            unit_p = round(rev / qty, 2) if qty > 0 else 0.0
            top_selling.append(TopSellingItem(
                item_name=it_name,
                category=item_category_map.get(it_name, "General"),
                quantity=round(qty, 1),
                revenue=round(rev, 2),
                average_unit_price=unit_p
            ))

        # Slow moving items (bottom 10 with days since last sale)
        today = date.today()
        slow_moving: List[SlowMovingItem] = []
        for it_name, qty in reversed(sorted_items[-10:]):
            rev = item_revenue[it_name]
            last_date_str = item_last_sale.get(it_name)
            try:
                last_dt = pd.to_datetime(last_date_str).date()
                days_since = (today - last_dt).days
            except Exception:
                days_since = 0

            slow_moving.append(SlowMovingItem(
                item_name=it_name,
                category=item_category_map.get(it_name, "General"),
                quantity=round(qty, 1),
                revenue=round(rev, 2),
                days_since_last_sale=max(0, days_since)
            ))

        # Day of week distribution (Mon - Sun)
        dow_names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        dow_list: List[DayOfWeekDistribution] = []
        for idx, name in enumerate(dow_names):
            dow_list.append(DayOfWeekDistribution(
                day_name=name,
                day_index=idx,
                orders=len(dow_order_ids[idx]),
                revenue=round(dow_revenue[idx], 2)
            ))

        # Branch comparison
        branch_meta_list = tenant_service.list_branches(restaurant_id)
        branch_map = {b.id: b for b in branch_meta_list}
        branch_comparison: List[BranchComparisonItem] = []

        all_branch_ids = set(branch_orders_map.keys()) | set(branch_map.keys())
        for b_id in all_branch_ids:
            b_info = branch_map.get(b_id)
            b_name = b_info.branch_name if b_info else "Outlet"
            b_city = b_info.city if b_info else ""
            b_orders = len(branch_orders_map.get(b_id, set()))
            b_rev = branch_revenue_map.get(b_id, 0.0)
            b_aov = round(b_rev / b_orders, 2) if b_orders > 0 else 0.0

            branch_comparison.append(BranchComparisonItem(
                branch_id=b_id,
                branch_name=b_name,
                city=b_city,
                total_revenue=round(b_rev, 2),
                total_orders=b_orders,
                average_order_value=b_aov
            ))

        # Promotion analysis
        promo_orders_count = len(promo_orders)
        regular_orders_count = len(regular_orders)
        has_promos = promo_orders_count > 0
        promo_aov = round(promo_revenue / promo_orders_count, 2) if promo_orders_count > 0 else 0.0
        regular_aov = round(regular_revenue / regular_orders_count, 2) if regular_orders_count > 0 else 0.0
        promo_share = round((promo_revenue / total_revenue) * 100.0, 1) if total_revenue > 0 else 0.0

        promo_analysis = PromotionAnalysis(
            has_promotions=has_promos,
            promo_orders_count=promo_orders_count,
            promo_revenue=round(promo_revenue, 2),
            regular_orders_count=regular_orders_count,
            regular_revenue=round(regular_revenue, 2),
            promo_aov=promo_aov,
            regular_aov=regular_aov,
            promo_share_pct=promo_share
        )

        # Model accuracy from latest forecast evaluation
        model_accuracy = None
        evaluations = forecasting_service._evaluations.get(restaurant_id, [])
        if evaluations:
            latest_eval = evaluations[-1]
            w_start = latest_eval.get("evaluation_start_date")
            w_end = latest_eval.get("evaluation_end_date")
            eval_window = f"{w_start} to {w_end}" if w_start and w_end else None
            model_accuracy = ModelAccuracySummary(
                model_name=latest_eval.get("model_name", "seasonal_naive"),
                baseline_name=latest_eval.get("baseline_name", "seasonal_naive"),
                test_mae=latest_eval.get("test_mae"),
                test_rmse=latest_eval.get("test_rmse"),
                test_wape=latest_eval.get("test_wape"),
                sufficiency_verdict=latest_eval.get("sufficiency_verdict", "adequate"),
                evaluation_window=eval_window
            )

        return TenantAnalyticsResponse(
            restaurant_id=restaurant_id,
            branch_id=branch_id,
            currency=currency,
            currency_symbol=currency_symbol,
            total_revenue=round(total_revenue, 2),
            total_orders=total_orders_count,
            average_order_value=aov,
            total_units_sold=round(total_units, 1),
            timeline=timeline,
            category_distribution=category_distribution,
            top_selling_items=top_selling,
            slow_moving_items=slow_moving,
            branch_comparison=branch_comparison,
            day_of_week_distribution=dow_list,
            promotion_analysis=promo_analysis,
            model_accuracy=model_accuracy,
            data_sufficiency="adequate" if len(daily_revenue) >= 28 else ("marginal" if len(daily_revenue) >= 14 else "insufficient")
        )

    # ==========================================================================
    # 2. INVENTORY PREPARATION & SAFETY BUFFER PLANNING
    # ==========================================================================

    def get_inventory_planning(
        self,
        restaurant_id: str,
        branch_id: Optional[str] = None,
        frequency: str = "daily",
        search: Optional[str] = None,
        category: Optional[str] = None,
        user_jwt: Optional[str] = None
    ) -> TenantInventoryResponse:
        """
        Calculates upcoming kitchen preparation requirements based on latest demand forecasts.
        Includes safety buffer targets (0%, 10%, 15%, 20%) satisfying mathematical invariants.
        """
        # Look up latest forecast run
        latest_run = None
        runs = forecasting_service.list_forecast_runs(restaurant_id, user_jwt=user_jwt)
        matching_runs = [r for r in runs if r.frequency == frequency and (not branch_id or r.branch_id == branch_id)]

        if matching_runs:
            latest_run = matching_runs[0]
            forecast_data = forecasting_service.get_forecast_results_by_run(restaurant_id, latest_run.run_id, user_jwt=user_jwt)
        else:
            # Check latest without branch filter
            if runs:
                latest_run = runs[0]
                forecast_data = forecasting_service.get_forecast_results_by_run(restaurant_id, latest_run.run_id, user_jwt=user_jwt)
            else:
                forecast_data = None

        # Fetch historical sales to compute daily average
        historical_orders = ingestion_service._orders.get(restaurant_id, [])
        item_hist_qty: Dict[str, float] = defaultdict(float)
        item_hist_dates: Dict[str, set] = defaultdict(set)
        for r in historical_orders:
            if r.get("promotion_tag") == "synthetic_sample" or str(r.get("order_id", "")).startswith("SAMPLE-SG-"):
                continue
            it = str(r.get("item_name", ""))
            qty = float(r.get("quantity") or 0.0)
            d = str(r.get("order_date", ""))
            item_hist_qty[it] += qty
            item_hist_dates[it].add(d)

        # Empty state when no forecast is present
        if not forecast_data or not forecast_data.forecast_series:
            return TenantInventoryResponse(
                restaurant_id=restaurant_id,
                branch_id=branch_id,
                branch_name="All Outlets",
                forecast_run_id=None,
                frequency=frequency,
                forecast_start_date=None,
                forecast_end_date=None,
                default_buffer=10,
                total_predicted_units=0.0,
                prep_targets_summary=PrepTargetsSummary(prep_0=0, prep_10=0, prep_15=0, prep_20=0),
                items=[],
                forecast_vs_actual=[]
            )

        predictions = forecast_data.forecast_series

        # Apply search and category filtering
        if category and category.lower() != "all":
            predictions = [p for p in predictions if p.category.lower() == category.lower()]
        if search:
            s = search.lower().strip()
            predictions = [p for p in predictions if s in p.item_name.lower() or s in p.category.lower()]

        # Aggregate across horizon per item
        item_prep_map: Dict[str, Dict[str, Any]] = {}
        for p in predictions:
            it = p.item_name
            if it not in item_prep_map:
                item_prep_map[it] = {
                    "item_name": it,
                    "category": p.category,
                    "predicted_units": 0.0,
                    "prep_0pct": 0,
                    "prep_10pct": 0,
                    "prep_15pct": 0,
                    "prep_20pct": 0
                }
            item_prep_map[it]["predicted_units"] += p.predicted_orders
            item_prep_map[it]["prep_0pct"] += p.prep_0pct
            item_prep_map[it]["prep_10pct"] += p.prep_10pct
            item_prep_map[it]["prep_15pct"] += p.prep_15pct
            item_prep_map[it]["prep_20pct"] += p.prep_20pct

        # Determine velocity/demand tiers
        total_pred_units = sum(i["predicted_units"] for i in item_prep_map.values())
        sorted_by_units = sorted(item_prep_map.values(), key=lambda x: x["predicted_units"], reverse=True)
        count = len(sorted_by_units)
        top_cut = max(1, int(count * 0.25))
        bottom_cut = max(1, int(count * 0.25))

        prep_items: List[InventoryPrepItem] = []
        for idx, item_data in enumerate(sorted_by_units):
            it = item_data["item_name"]
            if idx < top_cut:
                tier = "high"
            elif idx >= (count - bottom_cut):
                tier = "low"
            else:
                tier = "normal"

            # Historical daily avg
            distinct_d = len(item_hist_dates.get(it, set()))
            daily_avg = round(item_hist_qty[it] / distinct_d, 1) if distinct_d > 0 else 0.0

            prep_items.append(InventoryPrepItem(
                item_name=it,
                category=item_data["category"],
                predicted_units=round(item_data["predicted_units"], 1),
                prep_0pct=int(item_data["prep_0pct"]),
                prep_10pct=int(item_data["prep_10pct"]),
                prep_15pct=int(item_data["prep_15pct"]),
                prep_20pct=int(item_data["prep_20pct"]),
                demand_tier=tier,
                historical_daily_avg=daily_avg
            ))

        # Overall preparation targets summary
        summary_0 = sum(i.prep_0pct for i in prep_items)
        summary_10 = sum(i.prep_10pct for i in prep_items)
        summary_15 = sum(i.prep_15pct for i in prep_items)
        summary_20 = sum(i.prep_20pct for i in prep_items)

        # Forecast vs actual historical comparison where date overlap exists
        forecast_vs_actual: List[ForecastVsActualPoint] = []
        actual_date_item: Dict[Tuple[str, str], float] = defaultdict(float)
        for r in historical_orders:
            d_str = str(r.get("order_date", ""))
            it = str(r.get("item_name", ""))
            actual_date_item[(d_str, it)] += float(r.get("quantity") or 0.0)

        for p in forecast_data.forecast_series:
            key = (p.forecast_date, p.item_name)
            if key in actual_date_item:
                act = actual_date_item[key]
                pred = p.predicted_orders
                variance = round(act - pred, 2)
                var_pct = round((variance / act) * 100.0, 1) if act > 0 else 0.0
                forecast_vs_actual.append(ForecastVsActualPoint(
                    date=p.forecast_date,
                    item_name=p.item_name,
                    category=p.category,
                    forecasted=round(pred, 1),
                    actual=round(act, 1),
                    variance=variance,
                    variance_pct=var_pct
                ))

        return TenantInventoryResponse(
            restaurant_id=restaurant_id,
            branch_id=branch_id or (latest_run.branch_id if latest_run else None),
            branch_name=forecast_data.branch_name,
            forecast_run_id=forecast_data.run_id,
            frequency=forecast_data.frequency,
            forecast_start_date=forecast_data.start_date,
            forecast_end_date=forecast_data.end_date,
            default_buffer=forecast_data.default_buffer,
            total_predicted_units=round(total_pred_units, 1),
            prep_targets_summary=PrepTargetsSummary(
                prep_0=summary_0,
                prep_10=summary_10,
                prep_15=summary_15,
                prep_20=summary_20
            ),
            items=prep_items,
            forecast_vs_actual=forecast_vs_actual
        )

    # ==========================================================================
    # 3. MENU INTELLIGENCE & LIFECYCLE MANAGEMENT
    # ==========================================================================

    def get_menu_catalog(
        self,
        restaurant_id: str,
        category: Optional[str] = None,
        search: Optional[str] = None,
        user_jwt: Optional[str] = None
    ) -> TenantMenuResponse:
        """
        Returns full menu catalog augmented with sales volume, velocity ranking, and demand projections.
        """
        # Fetch registered menu items from local cache or Supabase
        registered_items = self._menu_catalog.get(restaurant_id, [])
        if not registered_items and settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                res = client.table("menu_items").select("*").eq("restaurant_id", restaurant_id).execute()
                if res.data:
                    registered_items = res.data
                    self._menu_catalog[restaurant_id] = registered_items
            except Exception as e:
                print(f"[OperationsService] Supabase menu_items read: {e}")

        # Compute historical metrics from POS ingestion records
        historical_orders = ingestion_service._orders.get(restaurant_id, [])
        item_sales_volume: Dict[str, float] = defaultdict(float)
        item_revenue: Dict[str, float] = defaultdict(float)
        item_categories: Dict[str, str] = {}
        for r in historical_orders:
            if r.get("promotion_tag") == "synthetic_sample" or str(r.get("order_id", "")).startswith("SAMPLE-SG-"):
                continue
            it = str(r.get("item_name", ""))
            qty = float(r.get("quantity") or 0.0)
            sales = float(r.get("net_sales") or (qty * float(r.get("unit_price") or 0.0)))
            item_sales_volume[it] += qty
            item_revenue[it] += sales
            if it not in item_categories:
                item_categories[it] = str(r.get("category", "General"))

        # Merge registered menu items and observed items
        all_item_names = set(item_sales_volume.keys()) | set(r.get("item_name") for r in registered_items if r.get("item_name"))
        reg_map = {r.get("item_name"): r for r in registered_items}

        # Look up latest daily forecast per item
        latest_item_forecast: Dict[str, float] = {}
        runs = forecasting_service.list_forecast_runs(restaurant_id)
        if runs:
            latest_res = forecasting_service.get_forecast_results_by_run(restaurant_id, runs[0].run_id)
            if latest_res:
                for p in latest_res.forecast_series:
                    latest_item_forecast[p.item_name] = latest_item_forecast.get(p.item_name, 0.0) + p.predicted_orders

        # Velocity ranking based on sales volume percentile
        sorted_by_sales = sorted(all_item_names, key=lambda it: item_sales_volume.get(it, 0.0), reverse=True)
        total_unique = len(sorted_by_sales)
        top_cut = max(1, int(total_unique * 0.25))
        bottom_cut = max(1, int(total_unique * 0.25))

        menu_items_list: List[MenuItemDetail] = []
        categories_set = set()

        for idx, it_name in enumerate(sorted_by_sales):
            reg = reg_map.get(it_name, {})
            cat = reg.get("category") or item_categories.get(it_name, "General")
            categories_set.add(cat)

            # Filtering
            if category and category.lower() != "all" and cat.lower() != category.lower():
                continue
            if search:
                s = search.lower().strip()
                sku = str(reg.get("sku") or "").lower()
                if s not in it_name.lower() and s not in cat.lower() and s not in sku:
                    continue

            # Velocity rank
            if idx < top_cut:
                rank = "high"
            elif idx >= (total_unique - bottom_cut):
                rank = "slow"
            else:
                rank = "steady"

            menu_items_list.append(MenuItemDetail(
                id=reg.get("id"),
                item_name=it_name,
                category=cat,
                sku=reg.get("sku"),
                price=reg.get("price"),
                introduced_date=reg.get("introduced_date"),
                discontinued_date=reg.get("discontinued_date"),
                total_historical_sales=round(item_sales_volume.get(it_name, 0.0), 1),
                total_historical_revenue=round(item_revenue.get(it_name, 0.0), 2),
                velocity_rank=rank,
                latest_forecast_daily=round(latest_item_forecast[it_name], 1) if it_name in latest_item_forecast else None,
                is_active=reg.get("is_active", True)
            ))

        return TenantMenuResponse(
            restaurant_id=restaurant_id,
            categories=sorted(categories_set),
            total_items=len(menu_items_list),
            items=menu_items_list
        )

    def create_menu_item(
        self,
        restaurant_id: str,
        data: MenuItemCreate,
        user_jwt: Optional[str] = None
    ) -> MenuItemDetail:
        """Registers a new menu item in the catalog."""
        item_id = str(uuid.uuid4())
        rec = {
            "id": item_id,
            "restaurant_id": restaurant_id,
            "item_name": data.item_name.strip(),
            "category": data.category.strip() or "General",
            "sku": data.sku,
            "price": data.price,
            "introduced_date": data.introduced_date,
            "discontinued_date": None,
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Replicate to live Supabase if connected
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("menu_items").insert({
                    "id": item_id,
                    "restaurant_id": restaurant_id,
                    "item_name": data.item_name.strip(),
                    "category": data.category.strip() or "General"
                }).execute()
            except Exception as e:
                print(f"[OperationsService] Supabase menu_items insert note: {e}")

        # In-memory store
        items = self._menu_catalog[restaurant_id]
        # Remove existing if duplicate name
        self._menu_catalog[restaurant_id] = [i for i in items if i.get("item_name") != data.item_name.strip()]
        self._menu_catalog[restaurant_id].append(rec)

        return MenuItemDetail(
            id=item_id,
            item_name=rec["item_name"],
            category=rec["category"],
            sku=rec["sku"],
            price=rec["price"],
            introduced_date=rec["introduced_date"],
            discontinued_date=None,
            total_historical_sales=0.0,
            total_historical_revenue=0.0,
            velocity_rank="steady",
            latest_forecast_daily=None,
            is_active=True
        )

    def update_menu_item(
        self,
        restaurant_id: str,
        item_name: str,
        data: MenuItemUpdate,
        user_jwt: Optional[str] = None
    ) -> MenuItemDetail:
        """Updates metadata for an existing menu item."""
        items = self._menu_catalog.setdefault(restaurant_id, [])
        target = next((i for i in items if i.get("item_name") == item_name), None)

        if not target:
            target = {
                "id": str(uuid.uuid4()),
                "restaurant_id": restaurant_id,
                "item_name": item_name,
                "category": data.category or "General",
                "sku": data.sku,
                "price": data.price,
                "introduced_date": data.introduced_date,
                "discontinued_date": data.discontinued_date,
                "is_active": data.is_active if data.is_active is not None else True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            items.append(target)
        else:
            if data.category is not None:
                target["category"] = data.category
            if data.sku is not None:
                target["sku"] = data.sku
            if data.price is not None:
                target["price"] = data.price
            if data.introduced_date is not None:
                target["introduced_date"] = data.introduced_date
            if data.discontinued_date is not None:
                target["discontinued_date"] = data.discontinued_date
            if data.is_active is not None:
                target["is_active"] = data.is_active

        # Replicate to live Supabase if connected
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("menu_items").update({
                    "category": target["category"],
                    "introduced_date": target.get("introduced_date"),
                    "discontinued_date": target.get("discontinued_date")
                }).eq("restaurant_id", restaurant_id).eq("item_name", item_name).execute()
            except Exception as e:
                print(f"[OperationsService] Supabase menu_items update note: {e}")

        return MenuItemDetail(
            id=target.get("id"),
            item_name=target["item_name"],
            category=target["category"],
            sku=target.get("sku"),
            price=target.get("price"),
            introduced_date=target.get("introduced_date"),
            discontinued_date=target.get("discontinued_date"),
            total_historical_sales=0.0,
            total_historical_revenue=0.0,
            velocity_rank="steady",
            latest_forecast_daily=None,
            is_active=target.get("is_active", True)
        )

    # ==========================================================================
    # 4. EXTENDED MULTI-BRANCH MANAGEMENT
    # ==========================================================================

    def list_branches_with_metrics(
        self,
        restaurant_id: str,
        user_jwt: Optional[str] = None
    ) -> List[BranchDetailResponse]:
        """Lists branches with order volume, revenue, and active closures count."""
        branches = tenant_service.list_branches(restaurant_id)
        orders = ingestion_service._orders.get(restaurant_id, [])

        branch_orders_count: Dict[str, set] = defaultdict(set)
        branch_rev_count: Dict[str, float] = defaultdict(float)
        for r in orders:
            if r.get("promotion_tag") == "synthetic_sample" or str(r.get("order_id", "")).startswith("SAMPLE-SG-"):
                continue
            b_id = str(r.get("branch_id", ""))
            ord_id = str(r.get("order_id", ""))
            net = float(r.get("net_sales") or 0.0)
            if b_id and ord_id:
                branch_orders_count[b_id].add(ord_id)
                branch_rev_count[b_id] += net

        output: List[BranchDetailResponse] = []
        for b in branches:
            closures = forecasting_service.list_branch_closures(restaurant_id, b.id, user_jwt=user_jwt)
            output.append(BranchDetailResponse(
                id=b.id,
                restaurant_id=b.restaurant_id,
                branch_code=b.branch_code,
                branch_name=b.branch_name,
                city=b.city,
                state=b.state,
                is_active=b.is_active,
                is_primary=b.is_primary,
                operating_days=getattr(b, "operating_days", "mon,tue,wed,thu,fri,sat,sun") or "mon,tue,wed,thu,fri,sat,sun",
                total_orders=len(branch_orders_count.get(b.id, set())),
                total_revenue=round(branch_rev_count.get(b.id, 0.0), 2),
                closures_count=len(closures),
                created_at=b.created_at
            ))
        return output

    def get_branch_detail(
        self,
        restaurant_id: str,
        branch_id: str,
        user_jwt: Optional[str] = None
    ) -> BranchDetailResponse:
        """Retrieves details and metrics for a specific branch."""
        branches = self.list_branches_with_metrics(restaurant_id, user_jwt=user_jwt)
        target = next((b for b in branches if b.id == branch_id), None)
        if not target:
            raise KeyError(f"Branch '{branch_id}' not found.")
        return target

    def update_branch(
        self,
        restaurant_id: str,
        branch_id: str,
        data: BranchUpdate,
        actor_id: str,
        user_jwt: Optional[str] = None
    ) -> BranchDetailResponse:
        """Updates outlet settings and operating calendar."""
        actor_role = tenant_service.resolve_user_membership(restaurant_id, actor_id)
        if not actor_role or not has_sufficient_role(actor_role, "admin"):
            raise PermissionError("Only admins or owners can modify branch configurations.")

        branches = tenant_service._branches.get(restaurant_id, [])
        target = next((b for b in branches if b["id"] == branch_id), None)
        if not target:
            raise KeyError(f"Branch '{branch_id}' not found.")

        if data.branch_name is not None:
            target["branch_name"] = data.branch_name.strip()
        if data.city is not None:
            target["city"] = data.city.strip()
        if data.state is not None:
            target["state"] = data.state.strip()
        if data.is_active is not None:
            target["is_active"] = data.is_active
        if data.operating_days is not None:
            target["operating_days"] = data.operating_days.strip().lower()

        if data.is_primary:
            for b in branches:
                b["is_primary"] = (b["id"] == branch_id)

        # Replicate to Supabase if connected
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurant_branches").update({
                    "branch_name": target["branch_name"],
                    "city": target["city"],
                    "is_active": target["is_active"],
                    "is_primary": target["is_primary"],
                    "operating_days": target.get("operating_days", "mon,tue,wed,thu,fri,sat,sun")
                }).eq("id", branch_id).execute()
            except Exception as e:
                print(f"[OperationsService] Supabase branch update note: {e}")

        return self.get_branch_detail(restaurant_id, branch_id, user_jwt=user_jwt)

    def delete_branch(
        self,
        restaurant_id: str,
        branch_id: str,
        actor_id: str,
        user_jwt: Optional[str] = None
    ):
        """Removes a branch outlet. Cannot delete the only outlet or primary outlet."""
        actor_role = tenant_service.resolve_user_membership(restaurant_id, actor_id)
        if actor_role != "owner":
            raise PermissionError("Only restaurant owners can delete branch outlets.")

        branches = tenant_service._branches.get(restaurant_id, [])
        if len(branches) <= 1:
            raise ValueError("Cannot delete the only branch outlet in a restaurant organization.")

        target = next((b for b in branches if b["id"] == branch_id), None)
        if not target:
            raise KeyError(f"Branch '{branch_id}' not found.")

        if target.get("is_primary"):
            raise ValueError("Cannot delete the primary branch outlet. Promote another outlet to primary first.")

        tenant_service._branches[restaurant_id] = [b for b in branches if b["id"] != branch_id]

        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurant_branches").delete().eq("id", branch_id).execute()
            except Exception as e:
                print(f"[OperationsService] Supabase branch delete note: {e}")

    # ==========================================================================
    # 5. RESTAURANT PROFILE & TEAM RBAC EXTENDED
    # ==========================================================================

    def update_restaurant_profile(
        self,
        restaurant_id: str,
        data: RestaurantProfileUpdate,
        actor_id: str,
        user_jwt: Optional[str] = None
    ) -> Dict[str, Any]:
        """Updates restaurant metadata (name, currency, timezone, cuisine)."""
        actor_role = tenant_service.resolve_user_membership(restaurant_id, actor_id)
        if not actor_role or not has_sufficient_role(actor_role, "admin"):
            raise PermissionError("Only admins or owners can update restaurant profile settings.")

        rest = tenant_service._restaurants.get(restaurant_id)
        if not rest:
            raise KeyError("Restaurant not found.")

        if data.name is not None and data.name.strip():
            rest["name"] = data.name.strip()
        if data.currency is not None:
            rest["currency"] = data.currency.strip().upper()
            rest["currency_symbol"] = "₹" if rest["currency"] == "INR" else ("$" if rest["currency"] == "USD" else "€")
        if data.timezone is not None:
            rest["timezone"] = data.timezone.strip()
        if data.operational_model is not None:
            rest["operational_model"] = data.operational_model.strip()

        # Update in live Supabase if connected
        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurants").update({
                    "name": rest["name"],
                    "currency": rest["currency"],
                    "currency_symbol": rest["currency_symbol"],
                    "timezone": rest["timezone"],
                    "operational_model": rest["operational_model"]
                }).eq("id", restaurant_id).execute()
            except Exception as e:
                print(f"[OperationsService] Supabase restaurant profile update note: {e}")

        return rest

    def update_member_role(
        self,
        restaurant_id: str,
        membership_id: str,
        new_role: str,
        actor_id: str,
        user_jwt: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Updates role of an existing restaurant member.
        Enforces:
        - Only current owners can promote or demote members to/from 'owner'.
        - Prevents demoting the sole owner of a restaurant.
        """
        actor_role = tenant_service.resolve_user_membership(restaurant_id, actor_id)
        if not actor_role or not has_sufficient_role(actor_role, "admin"):
            raise PermissionError("Only admins or owners can change member roles.")

        members = tenant_service._memberships.get(restaurant_id, [])
        target = next((m for m in members if m["id"] == membership_id), None)
        if not target:
            raise KeyError("Membership record not found.")

        current_role = target["role"]
        normalized_new_role = new_role.lower().strip()

        if current_role == normalized_new_role:
            return target

        if (current_role == "owner" or normalized_new_role == "owner") and actor_role != "owner":
            raise PermissionError("Only restaurant owners can grant or revoke the owner role.")

        # Protection: Prevent demoting the only owner
        if current_role == "owner" and normalized_new_role != "owner":
            owner_count = sum(1 for m in members if m["role"] == "owner")
            if owner_count <= 1:
                raise ValueError("Cannot demote the only owner of this restaurant organization.")

        target["role"] = normalized_new_role

        if settings.SUPABASE_URL and settings.SUPABASE_KEY and user_jwt:
            try:
                client = get_tenant_supabase_client(user_jwt)
                client.table("restaurant_memberships").update({"role": normalized_new_role}).eq("id", membership_id).execute()
            except Exception as e:
                print(f"[OperationsService] Supabase member role update note: {e}")

        return target


operations_service = OperationsService()
