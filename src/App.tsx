import { useEffect, useMemo, useState } from 'react'
import { CorrelationTab } from './components/CorrelationTab'
import { ForecastChart } from './components/ForecastChart'
import { InsightCards } from './components/InsightCards'
import { StoreCompareChart } from './components/StoreCompareChart'
import { WeekdayChart } from './components/WeekdayChart'
import { getStores, loadSalesData } from './data/loadSales'
import { fetchAllForecasts, fetchAllHistorical } from './data/weather'
import { exportDashboardExcel } from './lib/exportExcel'
import { salesDateRange } from './lib/mergeWeather'
import { predictAllStores, weekdayPatterns } from './lib/predict'
import type { DailyWeather, DayPrediction, SalesRecord } from './types'
import './App.css'

type Status = 'loading' | 'ready' | 'error'
type TabId = 'forecast' | 'correlations'

export default function App() {
  const [status, setStatus] = useState<Status>('loading')
  const [error, setError] = useState<string | null>(null)
  const [sales, setSales] = useState<SalesRecord[]>([])
  const [forecastWeather, setForecastWeather] = useState<Map<string, DailyWeather[]>>(
    new Map(),
  )
  const [historicalWeather, setHistoricalWeather] = useState<
    Map<string, DailyWeather[]>
  >(new Map())
  const [selectedStore, setSelectedStore] = useState('all')
  const [assumePromo, setAssumePromo] = useState(false)
  const [tab, setTab] = useState<TabId>('forecast')

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        setStatus('loading')
        const records = await loadSalesData()
        const stores = getStores(records)
        const { startDate, endDate } = salesDateRange(records)
        const [forecastMap, historicalMap] = await Promise.all([
          fetchAllForecasts(stores),
          fetchAllHistorical(stores, startDate, endDate),
        ])

        if (cancelled) return

        setSales(records)
        setForecastWeather(forecastMap)
        setHistoricalWeather(historicalMap)
        setStatus('ready')
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Something went wrong')
        setStatus('error')
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const stores = useMemo(() => getStores(sales), [sales])

  const forecasts = useMemo(() => {
    if (status !== 'ready' || forecastWeather.size === 0) return []
    return predictAllStores(
      sales,
      forecastWeather,
      historicalWeather,
      assumePromo,
    )
  }, [sales, forecastWeather, historicalWeather, assumePromo, status])

  const activeForecasts = useMemo(() => {
    if (selectedStore === 'all') return forecasts
    return forecasts.filter((f) => f.store === selectedStore)
  }, [forecasts, selectedStore])

  const chartPredictions = useMemo((): DayPrediction[] => {
    if (selectedStore === 'all') {
      const byDate = new Map<string, DayPrediction>()

      for (const f of forecasts) {
        for (const p of f.predictions) {
          const existing = byDate.get(p.date)
          if (!existing) {
            byDate.set(p.date, { ...p, store: 'All stores' })
          } else {
            existing.predictedSales += p.predictedSales
            existing.weekdayBaseline += p.weekdayBaseline
            existing.tempMean = (existing.tempMean + p.tempMean) / 2
            existing.precipSum = (existing.precipSum + p.precipSum) / 2
          }
        }
      }

      return [...byDate.values()]
    }
    return activeForecasts[0]?.predictions ?? []
  }, [activeForecasts, forecasts, selectedStore])

  const weekdayData = useMemo(() => {
    if (stores.length === 0) return []
    if (selectedStore === 'all') {
      const maps = stores.map((s) => weekdayPatterns(sales, s.name))
      return maps[0].map((p, i) => ({
        ...p,
        avgSales: Math.round(
          maps.reduce((sum, m) => sum + m[i].avgSales, 0) / maps.length,
        ),
      }))
    }
    return weekdayPatterns(sales, selectedStore)
  }, [sales, selectedStore, stores])

  function handleExport() {
    const patterns = new Map(
      stores.map((s) => [s.name, weekdayPatterns(sales, s.name)]),
    )
    exportDashboardExcel(forecasts, patterns, sales)
  }

  if (status === 'loading') {
    return (
      <div className="shell center">
        <p className="status">
          Loading sales & merging Open-Meteo historical weather…
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="shell center">
        <p className="status error">{error}</p>
      </div>
    )
  }

  const storeLabel =
    selectedStore === 'all' ? 'All stores' : selectedStore

  return (
    <div className="shell">
      <header className="top">
        <div>
          <p className="brand">StorePulse</p>
          <h1>
            {tab === 'forecast'
              ? 'Week-ahead sales forecast'
              : 'Weather–sales correlations'}
          </h1>
          <p className="lede">
            {tab === 'forecast'
              ? 'Historical sales + Open-Meteo weather → actionable outlook for the next 7 days.'
              : 'Historical CSV sales merged with Open-Meteo archive weather to inspect temperature and rain correlations.'}
          </p>
        </div>
        <div className="controls">
          <label className="field">
            <span>Store</span>
            <select
              value={selectedStore}
              onChange={(e) => setSelectedStore(e.target.value)}
            >
              <option value="all">All stores</option>
              {stores.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {tab === 'forecast' && (
            <label className="toggle">
              <input
                type="checkbox"
                checked={assumePromo}
                onChange={(e) => setAssumePromo(e.target.checked)}
              />
              <span>Assume promotions</span>
            </label>
          )}
          <button type="button" className="btn" onClick={handleExport}>
            Export Excel
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Dashboard sections">
        <button
          type="button"
          className={tab === 'forecast' ? 'tab active' : 'tab'}
          onClick={() => setTab('forecast')}
        >
          Forecast
        </button>
        <button
          type="button"
          className={tab === 'correlations' ? 'tab active' : 'tab'}
          onClick={() => setTab('correlations')}
        >
          Correlations
        </button>
      </nav>

      {tab === 'forecast' ? (
        <>
          <InsightCards forecasts={forecasts} selectedStore={selectedStore} />

          <div className="layout">
            <ForecastChart predictions={chartPredictions} storeLabel={storeLabel} />
            <WeekdayChart patterns={weekdayData} storeLabel={storeLabel} />
          </div>

          {forecasts.length > 1 && <StoreCompareChart forecasts={forecasts} />}

          <section className="panel ideas">
            <header className="panel-header">
              <h2>Ideas to add next</h2>
              <p>Useful extensions for daily store operations</p>
            </header>
            <ul className="idea-list">
              <li>
                <strong>Staffing planner</strong> — auto-suggest headcount bands from
                predicted sales bands and peak hours.
              </li>
              <li>
                <strong>Promo simulator</strong> — toggle promo per day and see lift vs
                margin cost before locking the weekly plan.
              </li>
              <li>
                <strong>Stock alerts</strong> — flag SKUs that historically sell out on
                high-traffic weather days.
              </li>
              <li>
                <strong>Live actuals vs forecast</strong> — mid-week accuracy check so
                managers can reallocate staff between stores.
              </li>
              <li>
                <strong>SMS / Teams digest</strong> — Monday morning summary to each
                store manager with their 7-day outlook.
              </li>
              <li>
                <strong>Event calendar</strong> — fold in local holidays, paydays, and
                concerts near each mall.
              </li>
            </ul>
          </section>
        </>
      ) : (
        <CorrelationTab
          sales={sales}
          historicalWeather={historicalWeather}
          selectedStore={selectedStore}
        />
      )}

      <footer className="foot">
        Weather via Open-Meteo · Sales from sample-store-sales.csv · Historical
        merge by store + date
      </footer>
    </div>
  )
}