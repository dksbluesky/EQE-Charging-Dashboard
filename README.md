# EQE 充電儀表板 (EQE Charging Dashboard)

A standalone web app for tracking EV charging sessions, recreated from a Google Apps Script app.

## Features

- **新增充電紀錄**: Log charging sessions (date, start/end SOC, odometer, kWh, total cost)
- Automatically computes per-session efficiency (km/kWh, km per 1% SOC), distance driven, and unit price
- **歷史趨勢**: Filter by date range, view efficiency or cost trend charts (Chart.js), with a dashed average line
- **行程試算**: Predict SOC/kWh/cost needed for a planned trip distance, based on the selected period's average efficiency
- **充電紀錄**: List of all saved records with delete option

## Data storage

Records are stored in browser `localStorage` (key: `eqe_charging_records`). JSON export/import remains available as a backup. Optional private sync lets devices share the same records through a separate Cloudflare Worker and D1 database. The pairing key stays in each device's browser storage; it is never checked into this repository.

### Set up optional cross-device sync

1. The dedicated Cloudflare D1 database and Worker are deployed at `https://eqe-charging-sync.dk0986.workers.dev`.
2. On the dashboard, open **同步設定**, generate a pairing key, and save it. Keep a private copy of that key. Tap **同步** once on the device containing the complete records to upload them.
3. On another device, enter the same key and tap **同步** to download. Keep a JSON export before first pairing if that device already has records. Tap **同步** after changes to upload or download. If both devices changed records, sync stops and asks you to resolve the conflict using backups.

The local PC server in `server.py` still reads the newest JSON from `D:\AI application code\EQE` when cloud sync is not configured. Once a pairing key is saved on that PC, the local raw folder is no longer loaded automatically, to prevent an older export replacing cloud records.

## Running

Just open `index.html` in a browser, or serve the folder as a static site (e.g. GitHub Pages).

## Origin

This was recreated from a Google Apps Script web app (`Code.gs` + `Index.html`) that stored data in a Google Sheet. The calculation logic (`processForm`, `getChartData`) was ported 1:1 to client-side JavaScript.
