import axios from 'axios'
import type { CenterAnalysis, MealAnalysis, ForecastSummary, HistorySummary, InventoryRecommendation, CenterInfo, MealInfo } from './types'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1',
})

export const getForecastSummary = (): Promise<ForecastSummary[]> =>
  api.get('/summary').then(res => res.data)

export const getHistorySummary = (): Promise<HistorySummary[]> =>
  api.get('/history').then(res => res.data)


export interface AnalyticsData {
  model?: any;
  trend: { week: number, total_orders: number, average_orders: number }[]
  distribution: {
    category: { name: string, value: number }[]
    cuisine: { name: string, value: number }[]
    center: { name: number, value: number }[]
    city: { name: string, value: number }[]
  }
  promotion: {
    emailer: { yes: number, no: number, yes_n: number, no_n: number }
    homepage: { yes: number, no: number, yes_n: number, no_n: number }
  }
  context: {
    holiday: { yes: number, no: number, yes_n: number, no_n: number }
  }
}

export const getInventory = (week?: number, limit = 50000): Promise<InventoryRecommendation[]> =>
  api.get('/inventory', { params: { week, limit } }).then(res => res.data)

export const getCenters = (): Promise<CenterInfo[]> =>
  api.get('/centers').then(res => res.data)

export const getMeals = (): Promise<MealInfo[]> =>
  api.get('/meals').then(res => res.data)
export const getDetailedForecasts = (week?: number, limit = 5000): Promise<any[]> =>
  api.get('/forecasts/detailed', { params: { week, limit } }).then(res => res.data)

export const getAnalytics = (params: any = {}): Promise<AnalyticsData> => {
  const cleanParams: any = {}
  Object.keys(params).forEach(k => {
    if (params[k] !== '' && params[k] !== null && params[k] !== undefined) {
      const key = k === 'centerId' ? 'center_id' : k
      cleanParams[key] = params[k]
    }
  })
  return api.get('/analytics', { params: cleanParams }).then(res => res.data)
}

export const getCentersAnalysis = (): Promise<CenterAnalysis[]> => {
  return api.get('/centers/analysis').then(res => res.data)
}

export async function getMealsAnalysis(params?: { week?: number, city?: string, center_id?: number, category?: string, cuisine?: string }): Promise<MealAnalysis[]> {
  const res = await api.get('/meals/analysis', { params })
  return res.data
}
