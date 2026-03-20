# AquaTrack Pro — Metropolitan Water Distribution Platform

> **Core Principle: Every page depends solely on your uploaded CSV. No data is hardcoded, assumed, or inserted automatically. Missing columns show explicit, actionable notices.**

---

## Quick Start

```bash
# Backend
cd backend && cp .env.example .env   # edit JWT_SECRET + ADMIN_EMAIL/PASSWORD
npm install && npm start             # http://localhost:5000

# Frontend (new terminal)
cd frontend && cp .env.example .env  # REACT_APP_API_URL=http://localhost:5000/api
npm install && npm start             # http://localhost:3000
```

---

## Sample Datasets (in `sample_datasets/`)

| File | Rows | Scenario | Pages Unlocked |
|------|------|----------|----------------|
| `01_full_featured.csv` | 450 | All columns present — 5 zones, 5 pipeline segments, 90 days | **All pages** |
| `02_zone_only.csv` | 720 | Zone data only, no pipeline — 6 zones, 120 days | Dashboard, Analytics, Zone Management, Map View |
| `03_pipeline_crisis.csv` | 420 | Pipeline crisis — 7 segments, high leakage, no zones | Dashboard, Pipeline Monitor, Pipeline Viz, Leakage Workflow |
| `04_minimal.csv` | 180 | Single meter, consumption only | Dashboard, Predictions, Analytics |

Upload any of these via the Upload page to instantly see what each page shows with that data.

---

## Column Reference

### For Zone Management & Map View
```
zone / area / district / region / sector / location / block / ward
```
Plus any numeric consumption column (e.g. `consumption`, `usage`, `volume`, `demand`).

### For Pipeline Visualization & Leakage Detection
```
pipe_segment / segment / pipeline / section
pressure / psi / bar / inlet / outlet
flow_rate / flow / discharge / velocity
leakage / loss / nrw / waste / unaccounted
```

### Minimal (Dashboard & Predictions only)
Any CSV with at least one numeric column.

### Full Example Header
```
date,zone,consumption,pressure,flow_rate,leakage,pipe_segment,temperature,population_served
```

---

## Features & Behavior by Page

| Page | Shows with any CSV | Requires zone column | Requires segment column |
|------|-------------------|---------------------|------------------------|
| Dashboard | ✅ KPIs, trend, forecast | — | — |
| Analytics | ✅ Trend chart | ✅ Zone charts | — |
| Predictions | ✅ Forecast, anomalies | — | — |
| Water Savings | ✅ Savings analysis | — | — |
| Pipeline Monitor | ✅ Pressure/flow stats | — | ✅ Segment table |
| **Zone Management** | ⚠️ Notice shown | ✅ Full zone analytics | ✅ Segment sub-tab |
| **Pipeline Visualization** | ⚠️ Notice shown | — | ✅ SVG network map |
| **Map View** | ⚠️ Notice shown | ✅ Interactive map | — |
| **Leakage Workflow** | ⚠️ Notice shown | ✅ Zone leakage | ✅ Segment leakage |
| Data Viewer | ✅ Raw data table | — | — |

⚠️ = Page loads but shows a clear "incomplete data" notice with exact column names needed.

---

## Architecture

```
aquatrack/
├── backend/
│   ├── routes/predictions.js   ← All /api/predictions/* endpoints
│   ├── services/
│   │   ├── csvProcessor.js     ← Parses CSV, computes stats, detects column types
│   │   ├── predictionEngine.js ← Generates forecasts, anomalies, pipeline analysis, zone distribution
│   │   └── savingsAnalyzer.js  ← Water savings opportunities
│   ├── db/db.js                ← JSON file database (no external DB)
│   └── server.js
├── frontend/src/pages/
│   ├── ZoneManagementPage.js      ← Zone analytics from /predictions/zones + /predictions/pipeline
│   ├── PipelineVisualizationPage.js ← SVG network from /predictions/pipeline
│   ├── MapViewPage.js             ← Leaflet map from /predictions/zones
│   └── LeakageWorkflowPage.js     ← Leakage records from pipeline + zone data
└── sample_datasets/
    ├── 01_full_featured.csv
    ├── 02_zone_only.csv
    ├── 03_pipeline_crisis.csv
    └── 04_minimal.csv
```

---

## Environment Variables

**backend/.env**
```
PORT=5000
JWT_SECRET=change_this_secret
ADMIN_EMAIL=admin@aquatrack.com
ADMIN_PASSWORD=admin123
CLIENT_URL=http://localhost:3000
```

**frontend/.env**
```
REACT_APP_API_URL=http://localhost:5000/api
```
