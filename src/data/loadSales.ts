import Papa from 'papaparse'
import type { SalesRecord, StoreInfo } from '../types'

interface CsvRow {
  date: string
  store: string
  lat: string
  lon: string
  sales_nok: string
  promotion: string
}

export async function loadSalesData(): Promise<SalesRecord[]> {
  const response = await fetch('/sample-store-sales.csv')
  if (!response.ok) {
    throw new Error('Failed to load sales data')
  }

  const text = await response.text()
  const parsed = Papa.parse<CsvRow>(text, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length > 0) {
    console.warn('CSV parse warnings:', parsed.errors.slice(0, 3))
  }

  return parsed.data
    .filter((row) => row.date && row.store)
    .map((row) => ({
      date: row.date.trim(),
      store: row.store.trim(),
      lat: Number(row.lat),
      lon: Number(row.lon),
      sales_nok: Number(row.sales_nok),
      promotion: row.promotion.trim() === '1',
    }))
}

export function getStores(records: SalesRecord[]): StoreInfo[] {
  const map = new Map<string, StoreInfo>()
  for (const row of records) {
    if (!map.has(row.store)) {
      map.set(row.store, { name: row.store, lat: row.lat, lon: row.lon })
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export function filterByStore(records: SalesRecord[], store: string): SalesRecord[] {
  if (store === 'all') return records
  return records.filter((r) => r.store === store)
}