# EQE 充電儀表板 (EQE Charging Dashboard)

A standalone web app for tracking EV charging sessions, recreated from a Google Apps Script app.

## Features

- **新增充電紀錄**: Log charging sessions (date, start/end SOC, odometer, kWh, total cost)
- Automatically computes per-session efficiency (km/kWh, km per 1% SOC), distance driven, and unit price
- **歷史趨勢**: Filter by date range, view efficiency or cost trend charts (Chart.js), with a dashed average line
- **行程試算**: Predict SOC/kWh/cost needed for a planned trip distance, based on the selected period's average efficiency
- **充電紀錄**: List of all saved records with delete option

## Data storage

All data is stored in the browser's `localStorage` (key: `eqe_charging_records`). No backend or account required — data stays on the device/browser you use.

## Running

Just open `index.html` in a browser, or serve the folder as a static site (e.g. GitHub Pages).

## Origin

This was recreated from a Google Apps Script web app (`Code.gs` + `Index.html`) that stored data in a Google Sheet. The calculation logic (`processForm`, `getChartData`) was ported 1:1 to client-side JavaScript.
