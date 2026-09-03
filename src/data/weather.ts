import { format, min as minDate, parseISO, subDays } from 'date-fns'
import type { DailyWeather, StoreInfo } from '../types'

interface OpenMeteoDaily {
  time: string[]
  temperature_2m_mean?: (number | null)[]
  temperature_2m_max?: (number | null)[]
  precipitation_sum: (number | null)[]
  weather_code: (number | null)[]
}

interface OpenMeteoResponse {
  daily: OpenMeteoDaily
}

function parseDaily(daily: OpenMeteoDaily): DailyWeather[] {
  const rows: DailyWeather[] = []
  for (let i = 0; i < daily.time.length; i++) {
    const temp =
      daily.temperature_2m_mean?.[i] ?? daily.temperature_2m_max?.[i]
    const precip = daily.precipitation_sum[i]
    if (temp == null || precip == null) continue
    rows.push({
      date: daily.time[i],
      tempMean: temp,
      precipSum: precip,
      weatherCode: daily.weather_code[i] ?? 0,
    })
  }
  return rows
}

/** 7-day forecast from Open-Meteo */
export async function fetchForecast(store: StoreInfo): Promise<DailyWeather[]> {
  const params = new URLSearchParams({
    latitude: String(store.lat),
    longitude: String(store.lon),
    daily: 'temperature_2m_mean,precipitation_sum,weather_code',
    timezone: 'Europe/Oslo',
    forecast_days: '7',
  })

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params}`,
  )
  if (!response.ok) {
    throw new Error(`Weather forecast failed for ${store.name}`)
  }

  const data = (await response.json()) as OpenMeteoResponse
  return parseDaily(data.daily)
}

/**
 * Historical weather for a date window (aligned to sales CSV coverage).
 * Archive data typically lags ~1–2 days behind today.
 */
export async function fetchHistoricalWeather(
  store: StoreInfo,
  startDate: string,
  endDate: string,
): Promise<DailyWeather[]> {
  const archiveEnd = format(
    minDate([parseISO(endDate), subDays(new Date(), 2)]),
    'yyyy-MM-dd',
  )

  if (archiveEnd < startDate) {
    return []
  }

  const params = new URLSearchParams({
    latitude: String(store.lat),
    longitude: String(store.lon),
    start_date: startDate,
    end_date: archiveEnd,
    daily: 'temperature_2m_mean,precipitation_sum,weather_code',
    timezone: 'Europe/Oslo',
  })

  const response = await fetch(
    `https://archive-api.open-meteo.com/v1/archive?${params}`,
  )
  if (!response.ok) {
    throw new Error(`Historical weather failed for ${store.name}`)
  }

  const data = (await response.json()) as OpenMeteoResponse
  return parseDaily(data.daily)
}

export async function fetchAllForecasts(
  stores: StoreInfo[],
): Promise<Map<string, DailyWeather[]>> {
  const results = await Promise.all(
    stores.map(async (store) => {
      const weather = await fetchForecast(store)
      return [store.name, weather] as const
    }),
  )
  return new Map(results)
}

export async function fetchAllHistorical(
  stores: StoreInfo[],
  startDate: string,
  endDate: string,
): Promise<Map<string, DailyWeather[]>> {
  const results = await Promise.all(
    stores.map(async (store) => {
      const weather = await fetchHistoricalWeather(store, startDate, endDate)
      return [store.name, weather] as const
    }),
  )
  return new Map(results)
}

/** WMO weather code → short label for staff */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly cloudy'
  if (code <= 48) return 'Fog'
  if (code <= 57) return 'Drizzle'
  if (code <= 67) return 'Rain'
  if (code <= 77) return 'Snow'
  if (code <= 82) return 'Showers'
  if (code <= 86) return 'Snow showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}