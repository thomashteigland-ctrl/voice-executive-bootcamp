import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatNok } from '../lib/exportExcel'
import type { WeekdayPattern } from '../types'

interface Props {
  patterns: WeekdayPattern[]
  storeLabel: string
}

export function WeekdayChart({ patterns, storeLabel }: Props) {
  // Mon–Sun order for staff planning
  const ordered = [1, 2, 3, 4, 5, 6, 0].map(
    (d) => patterns.find((p) => p.weekday === d)!,
  )

  return (
    <section className="panel">
      <header className="panel-header">
        <h2>Weekday demand pattern</h2>
        <p>{storeLabel} — historical average by day of week (staffing & stock)</p>
      </header>
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={ordered} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
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
              formatter={(value) => [formatNok(Number(value)), 'Avg sales']}
            />
            <Bar dataKey="avgSales" fill="var(--ink)" radius={[4, 4, 0, 0]} maxBarSize={40} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}