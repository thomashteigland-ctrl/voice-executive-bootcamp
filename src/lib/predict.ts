import { format, getDay, parseISO, subDays } from 'date-fns'
import type {
  DailyWeather,
  DayPrediction,
  SalesRecord,
  StoreWeekForecast,
  WeekdayPattern,
} from '../types'
import { weatherLabel } from '../data/weather'

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface WeatherEffect {
  rainBoost: number
  coldPenalty: number
  warmBoost: number
}

function getWeekday(dateStr: string): number {
  return getDay(parseISO(dateStr))
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 0
  return nums.reduce((a, b) => a + b, 0) / nums.length
}

/** Day-of-week baseline from non-zero sales days */
export function weekdayPatterns(
  records: SalesRecord[],
  store: string,
): WeekdayPattern[] {
  const byDay: number[][] = Array.from({ length: 7 }, () => [])

  for (const row of records) {
    if (row.store !== store || row.sales_nok <= 0) continue
    byDay[getWeekday(row.date)].push(row.sales_nok)
  }

  return byDay.map((sales, weekday) => ({
    weekday,
    label: WEEKDAY_LABELS[weekday],
    avgSales: Math.round(avg(sales)),
  }))
}

/** Promotion uplift: avg promo day / avg non-promo day */
export function promotionMultiplier(
  records: SalesRecord[],
  store: string,
): number {
  const storeRows = records.filter((r) => r.store === store && r.sales_nok > 0)
  const promo = storeRows.filter((r) => r.promotion).map((r) => r.sales_nok)
  const normal = storeRows.filter((r) => !r.promotion).map((r) => r.sales_nok)
  if (promo.length < 5 || normal.length < 5) return 1.15
  return avg(promo) / avg(normal)
}

/**
 * Estimate weather effects from overlapping sales + historical weather.
 * Indoor malls in Norway often see higher traffic on wet days.
 */
export function estimateWeatherEffect(
  records: SalesRecord[],
  store: string,
  historical: DailyWeather[],
): WeatherEffect {
  const weatherByDate = new Map(historical.map((w) => [w.date, w]))
  const wet: number[] = []
  const dry: number[] = []
  const cold: number[] = []
  const mild: number[] = []
  const warm: number[] = []

  for (const row of records) {
    if (row.store !== store || row.sales_nok <= 0) continue
    const w = weatherByDate.get(row.date)
    if (!w) continue

    if (w.precipSum >= 2) wet.push(row.sales_nok)
    else dry.push(row.sales_nok)

    if (w.tempMean < 0) cold.push(row.sales_nok)
    else if (w.tempMean > 18) warm.push(row.sales_nok)
    else mild.push(row.sales_nok)
  }

  const dryAvg = avg(dry) || 1
  const mildAvg = avg(mild) || 1

  return {
    rainBoost: wet.length >= 8 ? avg(wet) / dryAvg : 1.06,
    coldPenalty: cold.length >= 8 ? avg(cold) / mildAvg : 0.94,
    warmBoost: warm.length >= 8 ? avg(warm) / mildAvg : 1.02,
  }
}

function weatherAdjustment(
  weather: DailyWeather,
  effect: WeatherEffect,
): { factor: number; insight: string } {
  let factor = 1
  const notes: string[] = []

  if (weather.precipSum >= 5) {
    factor *= effect.rainBoost
    notes.push(`Heavy ${weatherLabel(weather.weatherCode).toLowerCase()} — expect more indoor traffic`)
  } else if (weather.precipSum >= 1) {
    factor *= 1 + (effect.rainBoost - 1) * 0.5
    notes.push('Light precipitation — mild indoor uplift')
  }

  if (weather.tempMean < 0) {
    factor *= effect.coldPenalty
    notes.push('Cold day — plan for lower footfall')
  } else if (weather.tempMean > 18) {
    factor *= effect.warmBoost
    notes.push('Mild/warm — outdoor competition for attention')
  }

  if (notes.length === 0) {
    notes.push('Neutral weather — lean on weekday pattern')
  }

  return { factor, insight: notes[0] }
}

function lastWeekTotal(records: SalesRecord[], store: string): number {
  const latest = records
    .filter((r) => r.store === store)
    .map((r) => r.date)
    .sort()
    .at(-1)

  if (!latest) return 0
  const end = parseISO(latest)
  const start = subDays(end, 6)
  const startStr = format(start, 'yyyy-MM-dd')

  return records
    .filter(
      (r) =>
        r.store === store && r.date >= startStr && r.date <= latest,
    )
    .reduce((sum, r) => sum + r.sales_nok, 0)
}

export function predictWeek(
  records: SalesRecord[],
  store: string,
  forecast: DailyWeather[],
  historical: DailyWeather[],
  assumePromotion = false,
): StoreWeekForecast {
  const patterns = weekdayPatterns(records, store)
  const baselineByDay = new Map(patterns.map((p) => [p.weekday, p.avgSales]))
  const promoMult = promotionMultiplier(records, store)
  const effect = estimateWeatherEffect(records, store, historical)

  const predictions: DayPrediction[] = forecast.map((day) => {
    const weekday = getWeekday(day.date)
    const weekdayBaseline = baselineByDay.get(weekday) ?? avg(
      records.filter((r) => r.store === store && r.sales_nok > 0).map((r) => r.sales_nok),
    )
    const { factor, insight } = weatherAdjustment(day, effect)
    const promoFactor = assumePromotion ? promoMult : 1
    const predictedSales = Math.round(weekdayBaseline * factor * promoFactor)

    const sampleSize = records.filter(
      (r) => r.store === store && getWeekday(r.date) === weekday && r.sales_nok > 0,
    ).length

    const confidence: DayPrediction['confidence'] =
      sampleSize >= 40 ? 'high' : sampleSize >= 20 ? 'medium' : 'low'

    return {
      date: day.date,
      store,
      predictedSales,
      weekdayBaseline,
      weatherAdjustment: factor,
      promotionAssumed: assumePromotion,
      tempMean: day.tempMean,
      precipSum: day.precipSum,
      weatherCode: day.weatherCode,
      confidence,
      insight,
    }
  })

  const weekTotal = predictions.reduce((s, p) => s + p.predictedSales, 0)
  const prev = lastWeekTotal(records, store)
  const vsLastWeekPct = prev > 0 ? ((weekTotal - prev) / prev) * 100 : 0

  const peak = [...predictions].sort((a, b) => b.predictedSales - a.predictedSales)[0]
  const staffingHint = peak
    ? `Peak expected ${format(parseISO(peak.date), 'EEE d MMM')} (~${Math.round(peak.predictedSales / 1000)}k NOK) — schedule extra floor staff.`
    : 'Insufficient data for staffing hint.'

  return {
    store,
    predictions,
    weekTotal,
    vsLastWeekPct,
    staffingHint,
  }
}

export function predictAllStores(
  records: SalesRecord[],
  forecasts: Map<string, DailyWeather[]>,
  historical: Map<string, DailyWeather[]>,
  assumePromotion = false,
): StoreWeekForecast[] {
  const stores = [...forecasts.keys()].sort()
  return stores.map((store) =>
    predictWeek(
      records,
      store,
      forecasts.get(store) ?? [],
      historical.get(store) ?? [],
      assumePromotion,
    ),
  )
}