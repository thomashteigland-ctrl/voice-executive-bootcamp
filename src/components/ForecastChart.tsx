import { format, parseISO } from 'date-fns'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { weatherLabel } from '../data/weather'
import { formatNok } from '../lib/exportExcel'
import type { DayPrediction } from '../types'

interface Props {
  predictions: DayPrediction[]
  storeLabel: string
}

export function ForecastChart({ predictions, storeLabel }: Props) {
  const data = predictions.map((p) => ({
    day: format(parseISO(p.date), 'EEE d'),
    predicted: p.predictedSales,
    baseline: p.weekdayBaseline,
    temp: p.tempMean,
    precip: p.precipSum,
    weather: weatherLabel(p.weatherCode),
    insight: p.insight,
  }))

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>7-day sales forecast</h2>
        <p>{storeLabel} — predicted vs weekday baseline, with weather context</p>
      </header>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="sales"
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
              unit="°"
            />
            <Tooltip
              contentStyle={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontSize: 13,
              }}
              formatter={(value, name) => {
                const n = typeof value === 'number' ? value : Number(value)
                if (name === 'temp') return [`${n.toFixed(1)}°C`, 'Temp']
                if (name === 'predicted') return [formatNok(n), 'Predicted']
                if (name === 'baseline') return [formatNok(n), 'Baseline']
                return [n, String(name)]
              }}
              labelFormatter={(label, payload) => {
                const row = payload?.[0]?.payload as (typeof data)[0] | undefined
                return row ? `${label} · ${row.weather}` : String(label)
              }}
            />
            <Legend />
            <Bar
              yAxisId="sales"
              dataKey="predicted"
              name="Predicted"
              fill="var(--accent)"
              radius={[4, 4, 0, 0]}
              maxBarSize={48}
            />
            <Line
              yAxisId="sales"
              type="monotone"
              dataKey="baseline"
              name="Weekday baseline"
              stroke="var(--ink-soft)"
              strokeDasharray="4 4"
              dot={false}
              strokeWidth={2}
            />
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              name="Temp °C"
              stroke="var(--warn)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}