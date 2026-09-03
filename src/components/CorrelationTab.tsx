import {
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { formatNok } from '../lib/exportExcel'
import {
  average,
  mergeSalesWithWeather,
  pearsonCorrelation,
} from '../lib/mergeWeather'
import type { DailyWeather, SalesRecord } from '../types'

interface Props {
  sales: SalesRecord[]
  historicalWeather: Map<string, DailyWeather[]>
  selectedStore: string
}

function corrLabel(r: number | null): string {
  if (r == null) return 'n/a'
  const abs = Math.abs(r)
  const strength =
    abs < 0.1 ? 'negligible' : abs < 0.3 ? 'weak' : abs < 0.5 ? 'moderate' : 'strong'
  const dir = r > 0 ? 'positive' : 'negative'
  return `r = ${r.toFixed(2)} (${strength} ${dir})`
}

export function CorrelationTab({
  sales,
  historicalWeather,
  selectedStore,
}: Props) {
  const merged = mergeSalesWithWeather(sales, historicalWeather, {
    store: selectedStore,
  })

  const tempPoints = merged.map((row) => ({
    x: row.tempMean,
    y: row.sales_nok,
    date: row.date,
    store: row.store,
    promo: row.promotion,
  }))

  // Binary rain axis with light jitter so overlapping points are visible
  const rainPoints = merged.map((row, i) => {
    const jitter = ((i % 17) - 8) * 0.018
    return {
      x: (row.isRain ? 1 : 0) + jitter,
      y: row.sales_nok,
      rain: row.isRain,
      date: row.date,
      store: row.store,
      precip: row.precipSum,
    }
  })

  const tempCorr = pearsonCorrelation(
    tempPoints.map((p) => p.x),
    tempPoints.map((p) => p.y),
  )

  const rainSales = merged.filter((r) => r.isRain).map((r) => r.sales_nok)
  const drySales = merged.filter((r) => !r.isRain).map((r) => r.sales_nok)
  const rainAvg = average(rainSales)
  const dryAvg = average(drySales)
  const rainLiftPct =
    dryAvg > 0 ? ((rainAvg - dryAvg) / dryAvg) * 100 : 0

  // Point-biserial ≈ Pearson of sales vs 0/1 rain flag
  const rainCorr = pearsonCorrelation(
    merged.map((r) => (r.isRain ? 1 : 0)),
    merged.map((r) => r.sales_nok),
  )

  const storeLabel =
    selectedStore === 'all' ? 'All stores' : selectedStore

  if (merged.length === 0) {
    return (
      <section className="panel">
        <header className="panel-header">
          <h2>Weather correlations</h2>
          <p>No overlapping historical sales + weather rows yet.</p>
        </header>
      </section>
    )
  }

  return (
    <div className="corr-tab">
      <div className="insight-grid corr-stats">
        <article className="insight">
          <span className="insight-label">Merged historical days</span>
          <strong className="insight-value">{merged.length.toLocaleString('nb-NO')}</strong>
          <span>{storeLabel} · sales CSV ∩ Open-Meteo archive</span>
        </article>
        <article className="insight">
          <span className="insight-label">Sales vs temperature</span>
          <strong className="insight-value">{corrLabel(tempCorr)}</strong>
          <span>Pearson correlation on daily means</span>
        </article>
        <article className="insight">
          <span className="insight-label">Rain vs dry average</span>
          <strong className="insight-value">
            {rainLiftPct >= 0 ? '+' : ''}
            {rainLiftPct.toFixed(1)}%
          </strong>
          <span>
            Rain {formatNok(rainAvg)} · Dry {formatNok(dryAvg)} · {corrLabel(rainCorr)}
          </span>
        </article>
      </div>

      <div className="layout corr-layout">
        <section className="panel">
          <header className="panel-header">
            <h2>Sales vs temperature</h2>
            <p>
              Each point is one historical store-day (Open-Meteo mean °C × CSV sales)
            </p>
          </header>
          <div className="chart-wrap chart-tall">
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Temp"
                  unit="°C"
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: 'Temperature (°C)',
                    position: 'insideBottom',
                    offset: -2,
                    fill: 'var(--muted)',
                    fontSize: 12,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Sales"
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  label={{
                    value: 'Sales (NOK)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--muted)',
                    fontSize: 12,
                  }}
                />
                <ZAxis range={[28, 28]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  formatter={(value, name) => {
                    if (name === 'Temp') return [`${Number(value).toFixed(1)}°C`, 'Temp']
                    if (name === 'Sales') return [formatNok(Number(value)), 'Sales']
                    return [value, String(name)]
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | (typeof tempPoints)[0]
                      | undefined
                    return row
                      ? `${row.date} · ${row.store}${row.promo ? ' · promo' : ''}`
                      : ''
                  }}
                />
                <Scatter data={tempPoints} fill="var(--accent)" fillOpacity={0.45} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <header className="panel-header">
            <h2>Sales vs rain (yes / no)</h2>
            <p>
              Rain = ≥1 mm precipitation that day. Jitter on the x-axis separates stacked points.
            </p>
          </header>
          <div className="chart-wrap chart-tall">
            <ResponsiveContainer width="100%" height={380}>
              <ScatterChart margin={{ top: 8, right: 16, left: 4, bottom: 8 }}>
                <CartesianGrid stroke="var(--grid)" />
                <XAxis
                  type="number"
                  dataKey="x"
                  domain={[-0.35, 1.35]}
                  ticks={[0, 1]}
                  tickFormatter={(v) => (v === 0 ? 'Dry' : v === 1 ? 'Rain' : '')}
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  label={{
                    value: 'Rain day?',
                    position: 'insideBottom',
                    offset: -2,
                    fill: 'var(--muted)',
                    fontSize: 12,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Sales"
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                  tick={{ fill: 'var(--muted)', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                  label={{
                    value: 'Sales (NOK)',
                    angle: -90,
                    position: 'insideLeft',
                    fill: 'var(--muted)',
                    fontSize: 12,
                  }}
                />
                <ZAxis range={[28, 28]} />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    background: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                  formatter={(value, name) => {
                    if (name === 'Sales') return [formatNok(Number(value)), 'Sales']
                    return [value, String(name)]
                  }}
                  labelFormatter={(_, payload) => {
                    const row = payload?.[0]?.payload as
                      | (typeof rainPoints)[0]
                      | undefined
                    return row
                      ? `${row.date} · ${row.store} · ${row.rain ? 'Rain' : 'Dry'} (${row.precip.toFixed(1)} mm)`
                      : ''
                  }}
                />
                <Scatter data={rainPoints} fillOpacity={0.5}>
                  {rainPoints.map((entry, index) => (
                    <Cell
                      key={`rain-${index}`}
                      fill={entry.rain ? 'var(--accent)' : 'var(--ink-soft)'}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  )
}