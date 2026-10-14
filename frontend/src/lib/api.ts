import axios from 'axios'
import type {
  CenterAnalysis,
  MealAnalysis,
  ForecastSummary,
  HistorySummary,
  InventoryRecommendation,
  CenterInfo,
  MealInfo,
  DetailedForecast
} from './types'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1',
  timeout: 45000, // 45 seconds to accommodate Render free-tier cold starts
})

// Optional retry on network error or 503/504 cold-start response (max 1 retry)
api.interceptors.response.use(
  response => response,
  async error => {
    const config = error.config
    if (!config || config._hasRetried) {
      return Promise.reject(error)
    }
    const status = error.response ? error.response.status : null
    const isColdStart = status === 503 || status === 504 || error.code === 'ECONNABORTED' || !status
    if (isColdStart) {
      config._hasRetried = true
      // Short delay before single wake-up retry
      await new Promise(resolve => setTimeout(resolve, 2000))
      return api(config)
    }
    return Promise.reject(error)
  }
)

export const getForecastSummary = (): Promise<ForecastSummary[]> =>
  api.get('/summary').then(res => res.data)

export const getHistorySummary = (): Promise<HistorySummary[]> =>
  api.get('/history').then(res => res.data)

export interface AnalyticsData {
  model?: any[]
  raw_sample?: any[]
  trend: { week: number; total_orders: number; average_orders: number }[]
  distribution: {
    category: { name: string; value: number }[]
    cuisine: { name: string; value: number }[]
    center: { name: number; value: number }[]
    city: { name: string; value: number }[]
    total_demand?: number
  }
  promotion: {
    emailer: { yes: number; no: number; yes_n: number; no_n: number }
    homepage: { yes: number; no: number; yes_n: number; no_n: number }
  }
  context: {
    holiday: { yes: number; no: number; yes_n: number; no_n: number }
    rain?: { yes: number; no: number; yes_n: number; no_n: number }
  }
}

export interface InventoryQueryParams {
  week?: number
  center_id?: number
  category?: string
  limit?: number
  skip?: number
}

export const getInventory = (
  weekOrParams?: number | InventoryQueryParams,
  limit = 5000
): Promise<InventoryRecommendation[]> => {
  let params: any = {}
  if (typeof weekOrParams === 'number') {
    params = { week: weekOrParams, limit }
  } else if (typeof weekOrParams === 'object' && weekOrParams !== null) {
    params = { limit, ...weekOrParams }
  } else {
    params = { limit }
  }
  const cleanParams: any = {}
  Object.keys(params).forEach(k => {
    if (params[k] !== '' && params[k] !== null && params[k] !== undefined) {
      cleanParams[k] = params[k]
    }
  })
  return api.get('/inventory', { params: cleanParams }).then(res => res.data)
}

export const getCenters = (): Promise<CenterInfo[]> =>
  api.get('/centers').then(res => res.data)

export const getMeals = (): Promise<MealInfo[]> =>
  api.get('/meals').then(res => res.data)

export interface DetailedForecastQueryParams {
  week?: number
  center_id?: number
  meal_id?: number
  city?: string
  category?: string
  cuisine?: string
  limit?: number
  skip?: number
}

export const getDetailedForecasts = (
  weekOrParams?: number | DetailedForecastQueryParams,
  limit = 1000
): Promise<DetailedForecast[]> => {
  let params: any = {}
  if (typeof weekOrParams === 'number') {
    params = { week: weekOrParams, limit }
  } else if (typeof weekOrParams === 'object' && weekOrParams !== null) {
    params = { limit, ...weekOrParams }
  } else {
    params = { limit }
  }
  const cleanParams: any = {}
  Object.keys(params).forEach(k => {
    if (params[k] !== '' && params[k] !== null && params[k] !== undefined) {
      cleanParams[k] = params[k]
    }
  })
  return api.get('/forecasts/detailed', { params: cleanParams }).then(res => res.data)
}

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

export async function getMealsAnalysis(params?: {
  week?: number
  city?: string
  center_id?: number
  category?: string
  cuisine?: string
}): Promise<MealAnalysis[]> {
  const res = await api.get('/meals/analysis', { params })
  return res.data
}
