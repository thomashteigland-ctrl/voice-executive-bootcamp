import { format, parseISO } from 'date-fns'
import * as XLSX from 'xlsx'
import { weatherLabel } from '../data/weather'
import type { SalesRecord, StoreWeekForecast, WeekdayPattern } from '../types'

function nok(n: number): number {
  return Math.round(n)
}

export function exportDashboardExcel(
  forecasts: StoreWeekForecast[],
  weekdayByStore: Map<string, WeekdayPattern[]>,
  recentSales: SalesRecord[],
): void {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Coming week forecast
  const forecastRows = forecasts.flatMap((f) =>
    f.predictions.map((p) => ({
      Store: p.store,
      Date: p.date,
      Weekday: format(parseISO(p.date), 'EEEE'),
      'Predicted sales (NOK)': nok(p.predictedSales),
      'Weekday baseline (NOK)': nok(p.weekdayBaseline),
      'Weather factor': Number(p.weatherAdjustment.toFixed(3)),
      'Temp (°C)': Number(p.tempMean.toFixed(1)),
      'Precipitation (mm)': Number(p.precipSum.toFixed(1)),
      Weather: weatherLabel(p.weatherCode),
      Promotion: p.promotionAssumed ? 'Yes' : 'No',
      Confidence: p.confidence,
      Insight: p.insight,
    })),
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(forecastRows),
    'Week forecast',
  )

  // Sheet 2: Store summary
  const summaryRows = forecasts.map((f) => ({
    Store: f.store,
    'Week total (NOK)': nok(f.weekTotal),
    'vs last week (%)': Number(f.vsLastWeekPct.toFixed(1)),
    'Staffing hint': f.staffingHint,
    'Busiest day': f.predictions.reduce((a, b) =>
      a.predictedSales >= b.predictedSales ? a : b,
    ).date,
    'Quietest day': f.predictions.reduce((a, b) =>
      a.predictedSales <= b.predictedSales ? a : b,
    ).date,
  }))
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(summaryRows),
    'Store summary',
  )

  // Sheet 3: Weekday patterns
  const patternRows = [...weekdayByStore.entries()].flatMap(([store, patterns]) =>
    patterns.map((p) => ({
      Store: store,
      Weekday: p.label,
      'Avg sales (NOK)': p.avgSales,
    })),
  )
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(patternRows),
    'Weekday patterns',
  )

  // Sheet 4: Recent actuals (last 28 days per store for staff reference)
  const cutoff = recentSales
    .map((r) => r.date)
    .sort()
    .at(-1)
  if (cutoff) {
    const start = format(
      new Date(parseISO(cutoff).getTime() - 27 * 86400000),
      'yyyy-MM-dd',
    )
    const recentRows = recentSales
      .filter((r) => r.date >= start)
      .map((r) => ({
        Date: r.date,
        Store: r.store,
        'Sales (NOK)': r.sales_nok,
        Promotion: r.promotion ? 'Yes' : 'No',
      }))
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(recentRows),
      'Recent actuals',
    )
  }

  const stamp = format(new Date(), 'yyyy-MM-dd')
  XLSX.writeFile(wb, `sales-forecast-${stamp}.xlsx`)
}

export function formatNok(value: number): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}