import { format, parseISO } from 'date-fns'
import { weatherLabel } from '../data/weather'
import { formatNok, formatPct } from '../lib/exportExcel'
import type { StoreWeekForecast } from '../types'

interface Props {
  forecasts: StoreWeekForecast[]
  selectedStore: string
}

export function InsightCards({ forecasts, selectedStore }: Props) {
  const visible =
    selectedStore === 'all'
      ? forecasts
      : forecasts.filter((f) => f.store === selectedStore)

  const combinedTotal = visible.reduce((s, f) => s + f.weekTotal, 0)
  const avgDelta =
    visible.reduce((s, f) => s + f.vsLastWeekPct, 0) / (visible.length || 1)

  const allDays = visible.flatMap((f) => f.predictions)
  const peak = allDays.reduce(
    (a, b) => (a.predictedSales >= b.predictedSales ? a : b),
    allDays[0],
  )
  const wetDays = allDays.filter((d) => d.precipSum >= 2).length

  return (
    <div className="insight-grid">
      <article className="insight">
        <span className="insight-label">Predicted week total</span>
        <strong className="insight-value">{formatNok(combinedTotal)}</strong>
        <span className={avgDelta >= 0 ? 'up' : 'down'}>
          {formatPct(avgDelta)} vs prior week
        </span>
      </article>

      {peak && (
        <article className="insight">
          <span className="insight-label">Peak day</span>
          <strong className="insight-value">
            {format(parseISO(peak.date), 'EEE d MMM')}
          </strong>
          <span>
            {formatNok(peak.predictedSales)}
            {selectedStore === 'all' ? ` · ${peak.store}` : ''}
          </span>
        </article>
      )}

      <article className="insight">
        <span className="insight-label">Wet days ahead</span>
        <strong className="insight-value">{wetDays}</strong>
        <span>Indoor traffic often rises on rainy days</span>
      </article>

      {visible.length === 1 && (
        <article className="insight insight-wide">
          <span className="insight-label">Action for floor staff</span>
          <p>{visible[0].staffingHint}</p>
          <ul className="day-insights">
            {visible[0].predictions.map((p) => (
              <li key={p.date}>
                <span>{format(parseISO(p.date), 'EEE')}</span>
                <span>{weatherLabel(p.weatherCode)}</span>
                <span>{p.insight}</span>
              </li>
            ))}
          </ul>
        </article>
      )}
    </div>
  )
}