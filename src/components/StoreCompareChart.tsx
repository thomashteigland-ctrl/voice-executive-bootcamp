import { format, parseISO } from 'date-fns'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNok } from '../lib/exportExcel'
import type { StoreWeekForecast } from '../types'

interface Props {
  forecasts: StoreWeekForecast[]
}

export function StoreCompareChart({ forecasts }: Props) {
  const days = forecasts[0]?.predictions.map((p) => p.date) ?? []
  const data = days.map((date) => {
    const row: Record<string, string | number> = {
      day: format(parseISO(date), 'EEE'),
    }
    for (const f of forecasts) {
      const pred = f.predictions.find((p) => p.date === date)
      row[f.store] = pred?.predictedSales ?? 0
    }
    return row
  })

  const colors = ['var(--accent)', 'var(--ink)', 'var(--warn)']

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Store comparison</h2>
        <p>Where to push staffing and promotions this week</p>
      </header>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tick={{ fill: 'var(--muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                borderRadius: 8,
              }}
              formatter={(value, name) => [formatNok(Number(value)), String(name)]}
            />
            <Legend />
            {forecasts.map((f, i) => (
              <Bar
                key={f.store}
                dataKey={f.store}
                fill={colors[i % colors.length]}
                radius={[3, 3, 0, 0]}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}