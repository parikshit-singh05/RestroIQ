import unittest
import sys
import os
import math

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.api.endpoints import (
    health_check, get_summary, get_history, get_inventory,
    get_detailed_forecasts, get_centers, get_meals,
    get_analytics, get_centers_analysis, get_meals_analysis
)


class TestBackendServicesAndEndpoints(unittest.TestCase):
    def test_health_check(self):
        res = health_check()
        self.assertEqual(res, {"status": "ok"})

    def test_forecast_summary(self):
        res = get_summary()
        self.assertEqual(len(res), 10, "Summary must contain exactly 10 forecast weeks")
        weeks = [r['week'] for r in res]
        self.assertEqual(weeks, list(range(146, 156)), "Forecast horizon must be Weeks 146 through 155")
        for r in res:
            self.assertGreater(r['total_predicted_orders'], 0)
            self.assertGreater(r['average_predicted_orders'], 0)
            self.assertTrue(len(r['highest_demand_category']) > 0)
            self.assertTrue(len(r['highest_demand_city']) > 0)

    def test_history_summary(self):
        res = get_history()
        self.assertEqual(len(res), 10, "History summary must contain 10 historical weeks")
        weeks = [r['week'] for r in res]
        self.assertEqual(weeks, list(range(136, 146)), "Historical horizon must be Weeks 136 through 145")
        for r in res:
            self.assertGreater(r['total_orders'], 0)

    def test_inventory_endpoint_and_buffer_invariants(self):
        res = get_inventory(week=146, limit=100)
        self.assertTrue(len(res) > 0, "Inventory query should return records")
        for r in res:
            self.assertEqual(r['week'], 146)
            self.assertGreater(r['predicted_orders'], 0)
            # Mathematical invariants
            self.assertEqual(r['prep_0pct'], math.ceil(r['predicted_orders']))
            self.assertEqual(r['prep_10pct'], math.ceil(r['predicted_orders'] * 1.10))
            self.assertEqual(r['prep_15pct'], math.ceil(r['predicted_orders'] * 1.15))
            self.assertEqual(r['prep_20pct'], math.ceil(r['predicted_orders'] * 1.20))
            # Surplus formulas
            self.assertAlmostEqual(r['potential_surplus_10pct'], r['prep_10pct'] - r['predicted_orders'], places=4)
            self.assertAlmostEqual(r['potential_surplus_20pct'], r['prep_20pct'] - r['predicted_orders'], places=4)
            # Metadata
            self.assertIsNotNone(r.get('category'))
            self.assertIsNotNone(r.get('simulated_city'))

    def test_inventory_pagination(self):
        res1 = get_inventory(week=146, limit=10, skip=0)
        res2 = get_inventory(week=146, limit=10, skip=5)
        self.assertEqual(len(res1), 10)
        self.assertEqual(len(res2), 10)
        # res1 item 5 should match res2 item 0
        self.assertEqual(res1[5]['meal_id'], res2[0]['meal_id'])
        self.assertEqual(res1[5]['center_id'], res2[0]['center_id'])

    def test_detailed_forecasts_filtering_and_pagination(self):
        w146 = get_detailed_forecasts(week=146, limit=50)
        self.assertEqual(len(w146), 50)
        for r in w146:
            self.assertEqual(r['week'], 146)

        c10 = get_detailed_forecasts(center_id=10, limit=100)
        self.assertTrue(len(c10) > 0)
        for r in c10:
            self.assertEqual(r['center_id'], 10)

        m1062 = get_detailed_forecasts(meal_id=1062, limit=100)
        self.assertTrue(len(m1062) > 0)
        for r in m1062:
            self.assertEqual(r['meal_id'], 1062)

    def test_centers_and_meals_metadata(self):
        centers = get_centers()
        self.assertEqual(len(centers), 77, "Should have exactly 77 fulfillment centers")
        center_ids = {c['center_id'] for c in centers}
        self.assertEqual(len(center_ids), 77, "Center IDs must be unique")
        for c in centers:
            self.assertTrue(len(c['simulated_city']) > 0)
            self.assertIn(c['center_type'], ['TYPE_A', 'TYPE_B', 'TYPE_C'])
            self.assertGreater(c['op_area'], 0)

        meals = get_meals()
        self.assertEqual(len(meals), 51, "Should have exactly 51 meals")
        meal_ids = {m['meal_id'] for m in meals}
        self.assertEqual(len(meal_ids), 51, "Meal IDs must be unique")

    def test_analytics_filters(self):
        res = get_analytics()
        self.assertIn('trend', res)
        self.assertIn('distribution', res)
        self.assertIn('promotion', res)
        self.assertIn('context', res)
        self.assertIn('model', res)
        self.assertTrue(len(res['model']) > 0, "Model feature importances must be present")

        bev = get_analytics(category="Beverages")
        self.assertTrue(len(bev['trend']) > 0)

        empty = get_analytics(city="NonExistentCity")
        self.assertEqual(empty['trend'], [])
        self.assertEqual(empty['distribution'], {})

    def test_centers_analysis_and_real_wow_metric(self):
        ca = get_centers_analysis()
        self.assertEqual(len(ca), 77)
        shares = sum(c['share_of_network'] for c in ca)
        self.assertAlmostEqual(shares, 100.0, delta=0.5, msg="Share of network must sum to 100%")

        for c in ca:
            self.assertIn('wow_increase', c)
            self.assertFalse(math.isnan(c['wow_increase']))
            self.assertFalse(math.isinf(c['wow_increase']))
            self.assertEqual(len(c['weekly_trajectory']), 10)
            self.assertEqual(len(c['historical_trajectory']), 10)

        sorted_ca = sorted(ca, key=lambda x: x['wow_increase'], reverse=True)
        top_surge = sorted_ca[0]
        self.assertEqual(top_surge['center_id'], 162)
        self.assertAlmostEqual(top_surge['wow_increase'], 66.92, delta=0.1)

    def test_meals_analysis(self):
        ma = get_meals_analysis()
        self.assertEqual(len(ma), 51)
        for m in ma:
            self.assertGreater(m['predicted_orders'], 0)
            self.assertEqual(len(m['weekly_trajectory']), 10)
            self.assertEqual(len(m['historical_trajectory']), 10)
            self.assertTrue(len(m['center_contributions']) > 0)


    def test_cors_configuration(self):
        import asyncio
        from app.main import app

        async def run_cors_test():
            messages = []
            scope = {
                'type': 'http', 'method': 'GET', 'path': '/api/v1/health',
                'raw_path': b'/api/v1/health', 'query_string': b'',
                'headers': [(b'host', b'localhost'), (b'origin', b'https://restroiq.vercel.app')],
                'client': ('127.0.0.1', 12345), 'server': ('127.0.0.1', 8000),
                'scheme': 'http', 'http_version': '1.1'
            }
            async def receive():
                return {'type': 'http.request', 'body': b'', 'more_body': False}
            async def send(message):
                messages.append(message)
            await app(scope, receive, send)
            start_msg = [m for m in messages if m['type'] == 'http.response.start'][0]
            headers = dict(start_msg.get('headers', []))
            return start_msg.get('status'), headers

        status, headers = asyncio.run(run_cors_test())
        self.assertEqual(status, 200)
        self.assertEqual(headers.get(b'access-control-allow-origin'), b'https://restroiq.vercel.app')
        self.assertEqual(headers.get(b'access-control-allow-credentials'), b'true')


if __name__ == "__main__":
    unittest.main(verbosity=2)
