export interface SalesRecord {
  date: string
  store: string
  lat: number
  lon: number
  sales_nok: number
  promotion: boolean
}

export interface StoreInfo {
  name: string
  lat: number
  lon: number
}

export interface DailyWeather {
  date: string
  tempMean: number
  precipSum: number
  weatherCode: number
}

/** Sales row joined with Open-Meteo historical weather for that store/date */
export interface MergedSalesWeather {
  date: string
  store: string
  sales_nok: number
  promotion: boolean
  tempMean: number
  precipSum: number
  weatherCode: number
  isRain: boolean
}

export interface DayPrediction {
  date: string
  store: string
  predictedSales: number
  weekdayBaseline: number
  weatherAdjustment: number
  promotionAssumed: boolean
  tempMean: number
  precipSum: number
  weatherCode: number
  confidence: 'high' | 'medium' | 'low'
  insight: string
}

export interface StoreWeekForecast {
  store: string
  predictions: DayPrediction[]
  weekTotal: number
  vsLastWeekPct: number
  staffingHint: string
}

export interface WeekdayPattern {
  weekday: number
  label: string
  avgSales: number
}