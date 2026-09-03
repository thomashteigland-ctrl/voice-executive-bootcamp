import type {
  DailyWeather,
  MergedSalesWeather,
  SalesRecord,
} from '../types'

const RAIN_MM_THRESHOLD = 1

/** Join sales CSV rows with Open-Meteo historical weather by store + date */
export function mergeSalesWithWeather(
  sales: SalesRecord[],
  weatherByStore: Map<string, DailyWeather[]>,
  options?: { store?: string; rainThresholdMm?: number },
): MergedSalesWeather[] {
  const rainThreshold = options?.rainThresholdMm ?? RAIN_MM_THRESHOLD
  const storeFilter = options?.store

  const weatherIndex = new Map<string, DailyWeather>()
  for (const [store, days] of weatherByStore) {
    for (const day of days) {
      weatherIndex.set(`${store}|${day.date}`, day)
    }
  }

  const merged: MergedSalesWeather[] = []
  for (const row of sales) {
    if (storeFilter && storeFilter !== 'all' && row.store !== storeFilter) {
      continue
    }
    if (row.sales_nok <= 0) continue

    const weather = weatherIndex.get(`${row.store}|${row.date}`)
    if (!weather) continue

    merged.push({
      date: row.date,
      store: row.store,
      sales_nok: row.sales_nok,
      promotion: row.promotion,
      tempMean: weather.tempMean,
      precipSum: weather.precipSum,
      weatherCode: weather.weatherCode,
      isRain: weather.precipSum >= rainThreshold,
    })
  }

  return merged
}

/** Pearson correlation (−1…1) between two series */
export function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0
  let sumY2 = 0

  for (let i = 0; i < n; i++) {
    sumX += xs[i]
    sumY += ys[i]
    sumXY += xs[i] * ys[i]
    sumX2 += xs[i] * xs[i]
    sumY2 += ys[i] * ys[i]
  }

  const num = n * sumXY - sumX * sumY
  const den = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY))
  if (den === 0) return null
  return num / den
}

export function average(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

export function salesDateRange(sales: SalesRecord[]): {
  startDate: string
  endDate: string
} {
  const dates = sales.map((r) => r.date).sort()
  return {
    startDate: dates[0] ?? '2024-01-01',
    endDate: dates.at(-1) ?? formatFallbackEnd(),
  }
}

function formatFallbackEnd(): string {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}