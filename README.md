# StorePulse — Week-ahead sales forecast

Minimal Vite + React + TypeScript app that combines `sample-store-sales.csv` with [Open-Meteo](https://open-meteo.com) weather to predict the next 7 days of store sales.

## Run

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## What it does

- Loads historical sales for Bergen, Oslo, and Trondheim
- Fetches 7-day forecast + recent historical weather from Open-Meteo
- Predicts daily sales from weekday baselines, promotion uplift, and learned rain/cold effects
- Charts: 7-day forecast, weekday patterns, store comparison
- **Export Excel** — workbook for store staff (`Week forecast`, `Store summary`, `Weekday patterns`, `Recent actuals`)

## Stack

- Vite, React 19, TypeScript
- Recharts, Papa Parse, SheetJS (`xlsx`), date-fns
- Open-Meteo Forecast + Archive APIs (no API key)
