# 🌊 AI-Powered Marine Debris & Sonar Anomaly Detection System
### Hydrographic Survey Workstation & Operational Ingestion Platform (PS 26057)

[![Live Dashboard](https://img.shields.io/badge/Live%20Dashboard-Vercel-black?style=for-the-badge&logo=vercel)](https://marine-debrie.vercel.app)
[![API Backend](https://img.shields.io/badge/API%20Backend-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://marine-debrie.onrender.com)
[![Swagger Docs](https://img.shields.io/badge/Interactive%20Docs-Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black)](https://marine-debrie.onrender.com/docs)
[![Database](https://img.shields.io/badge/Database-Neon%20Postgres-00E599?style=for-the-badge&logo=postgresql&logoColor=black)](https://neon.tech)

---

## 📌 Overview

During high-resolution side-scan sonar surveys, autonomous underwater vehicles (AUVs) and towfishes collect gigabytes of acoustic backscatter imagery across overlapping survey lines. While modern computer vision models (YOLO / U-Net) can flag potential seabed anomalies, raw ML inference outputs are messy:
- The same submerged hazard is detected multiple times across adjacent swath passes.
- Acoustic backscatter noise and seabed ripples trigger false positives.
- Raw bounding boxes lack geodetic coordinates and operational tracking.

This platform serves as the **operational bridge between raw machine learning output and hydrographic survey teams**. It ingests live or batched sonar detections, clusters multi-pass observations into single physical seafloor targets, verifies acoustic shadow relief, and presents everything in an analyst-friendly GIS command dashboard with one-click export for mission reporting.

```
  +-------------------------------------------------------------------------------+
  |                             SONAR DATA PIPELINE                               |
  +-------------------------------------------------------------------------------+
  |  Side-Scan Sonar Imagery (AUV / Towfish Swath)                                 |
  |     │                                                                         |
  |     ▼                                                                         |
  |  Acoustic ML Detector (Bounding Boxes + U-Net Acoustic Shadow Verification)   |
  +-------------------------------------------------------------------------------+
                                        │
           ┌────────────────────────────┴────────────────────────────┐
           ▼ (Mode A: Live REST / Multipart)                         ▼ (Mode B: Batch Archive)
     POST /api/detections                                      POST /api/missions/{id}/import
     (Single detection or frame)                               (ZIP package with images or JSON)
           │                                                         │
           └────────────────────────────┬────────────────────────────┘
                                        ▼
  +-------------------------------------------------------------------------------+
  |                          FASTAPI APPLICATION CORE                             |
  +-------------------------------------------------------------------------------+
  |  • Canonical Schema Normalization & Validation                                |
  |  • Target Consolidation Engine (1 Physical Target = 1 GIS Marker)             |
  |  • Spatial Centroid Averaging & Fused Multi-Pass Confidence                   |
  |  • Acoustic Shadow Relief Verification                                        |
  |  • Evidence Image Storage (Neon S3 Object Storage + Local Cache)              |
  +-------------------------------------------------------------------------------+
            │                                                      │
            ▼                                                      ▼
  +--------------------+                                 +--------------------+
  |  Neon PostgreSQL   |                                 | WebSocket Fanout   |
  |  Missions, Targets |                                 | (/ws/live-feed)    |
  |  & Observations    |                                 +--------------------+
  +--------------------+                                           │
            │                                                      ▼
            │                                            +--------------------+
            │                                            | React 18 Dashboard |
            │                                            | • Leaflet GIS Map  |
            │                                            | • Review Workflow  |
            │                                            | • Live Radar Feed  |
            │                                            +--------------------+
            ▼                                                      │
  +---------------------------------------------------+            │
  |  Deterministic Analytics & Export Engine          |<───────────┘
  |  • PDF Mission Reports (ReportLab)                |
  |  • Master Detection Spreadsheets (OpenPyXL Excel) |
  |  • GeoJSON / CSV Spatial Exports                  |
  +---------------------------------------------------+
```

---

## 🌐 Live Cloud Deployment

The complete application is deployed and accessible online:

| Component | Platform | URL |
| :--- | :--- | :--- |
| **Web Application Dashboard** | Vercel | [marine-debrie.vercel.app](https://marine-debrie.vercel.app) |
| **Backend REST API** | Render | [marine-debrie.onrender.com](https://marine-debrie.onrender.com) |
| **Interactive API Documentation** | Swagger UI | [marine-debrie.onrender.com/docs](https://marine-debrie.onrender.com/docs) |
| **Alternative API Documentation** | ReDoc | [marine-debrie.onrender.com/redoc](https://marine-debrie.onrender.com/redoc) |
| **Health Check & Diagnostics** | FastAPI | [marine-debrie.onrender.com/api/health](https://marine-debrie.onrender.com/api/health) |
| **Live Telemetry WebSocket** | WSS | `wss://marine-debrie.onrender.com/ws/live-feed` |

---

## 🎯 Key Capabilities

### 1. Multi-Pass Observation Consolidation
A central rule of hydrographic data management: **1 Physical Target = 1 GIS Marker**.
When a survey vessel or AUV runs multiple survey lines over an area, an obstacle (like a sunken shipping container or lost fishing gear) is imaged from several aspect angles. The backend groups these observations under a single canonical `target_id`, dynamically recalculating:
- **Centroid Coordinates**: Weighted average latitude and longitude across all valid survey passes.
- **Fused Confidence**: Balances the single highest-confidence acoustic pass with the historical average across all passes.
- **Observation History**: Every individual pass remains inspectable within the target detail view.

### 2. Acoustic Shadow Verification
In side-scan sonar, an acoustic return consists of two components: the **bright highlight** (high acoustic backscatter from the object face) and the **acoustic shadow** (the dark void behind the object where sound cannot reach).
- Elevated objects (containers, wrecks, boulders, ordnance) cast distinct acoustic shadows proportional to their height off the seabed.
- Flat seafloor clutter or sand ripples produce highlights with negligible shadows.
- Our schema explicitly tracks `shadow_verified` to prioritize genuine navigation hazards over false alarms.

### 3. Dual Ingestion Pipelines
* **Mode A: Live Real-Time Stream (`POST /api/detections`)**
  Designed for real-time edge processing aboard an AUV or survey vessel. Accepts canonical detection JSON alongside raw or cropped evidence image files via `multipart/form-data`. Ingested detections instantly fan out over WebSockets with radar ping animations on the active GIS view.
* **Mode B: Mission Batch Archive (`POST /api/missions/{id}/import`)**
  Designed for post-survey data ingestion. Accepts standard `.zip` packages containing a `detections.json` manifest and an `images/` directory, or standalone JSON files. The parser extracts assets, georeferences the items, and builds the mission register automatically.

### 4. Human-in-the-Loop Ground-Truthing
Automated detection is rarely trusted blindly in nautical charting. The dashboard includes a full analyst verification workflow:
- Filter detections by classification (`debris_net`, `pipe_cylinder`, `wreck_structure`, `cargo_container`, `naval_mine`), review state, or confidence score.
- Side-by-side evidence inspection modal showing bounding boxes and polygon segmentation overlays directly against acoustic imagery.
- Instant **Confirm** / **Reject** controls that update the PostgreSQL database and broadcast state changes in real time.

### 5. Publication-Grade Mission Reporting
Survey operations require formal reporting for port authorities, salvage teams, and environmental agencies:
- **Operational PDF Reports**: Multi-page documents with executive summaries, risk indices, depth correlation metrics, class breakdown charts, and target catalogs generated via ReportLab.
- **Master Excel Workbooks**: Formatted `.xlsx` tables with color-coded confidence levels, coordinate formatting, and physical dimensions generated via OpenPyXL.
- **Raw Spatial Exports**: Standard GeoJSON and CSV formats for import into ArcGIS, QGIS, or CARIS.

---

## 💻 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18, Vite 5, Tailwind CSS | High-performance SPA with modern dark maritime aesthetic |
| **GIS Mapping** | Leaflet, React-Leaflet | Georeferenced target markers, survey tracks, and bathymetric overlays |
| **Icons & UI** | Lucide React | Clean, responsive technical UI components |
| **Backend API** | FastAPI (Python 3.10+) | Asynchronous, typed REST endpoints with automatic OpenAPI generation |
| **Real-Time Feed** | WebSockets (native FastAPI) | Low-latency telemetry and live detection streaming |
| **Database** | PostgreSQL (Neon Serverless) / SQLite | Relational persistence with cascade rules, indexes, and JSON attributes |
| **Object Storage** | S3-Compatible (Neon Storage) | Cloud storage for high-resolution sonar evidence imagery |
| **Report Generation** | ReportLab, OpenPyXL | Automated PDF and formatted Excel survey report compilers |

---

## 📡 Canonical Data Schema

The platform enforces a standardized detection contract across both live streams and batch files:

```json
{
  "target_id": "TGT-042",
  "class": "debris_net",
  "confidence": 0.94,
  "latitude": 32.651280,
  "longitude": -117.554310,
  "estimated_size_m": 5.8,
  "shadow_verified": true,
  "status": "pending_review",
  "timestamp": "2026-09-11T18:45:00Z",
  "sonar_image_ref": "/api/images/img_debris_042.png",
  "bounding_box": {
    "x": 142,
    "y": 280,
    "width": 88,
    "height": 64
  },
  "segmentation": [
    [142, 280], [230, 290], [225, 344], [145, 340]
  ]
}
```

### Supported Anomaly Classes
- `debris_net` — Derelict ghost fishing nets and synthetic trawls
- `pipe_cylinder` — Subsea pipelines, exposed pipes, and cylindrical objects
- `wreck_structure` — Historic and modern shipwreck structures
- `cargo_container` — Lost ISO intermodal shipping containers
- `naval_mine` — High-risk acoustic mine anomalies
- `pipe_joint` — Pipeline free-spans, flanges, and connection points
- `concrete_block` — Anchor sinkers, construction blocks, and artificial reef units
- `tire` — Submerged automotive/industrial tire debris

---

## 🚀 Getting Started

### Prerequisites
- **Python**: Version 3.10 or higher (`python --version`)
- **Node.js**: Version 18.0 or higher (`node -v`)
- **Git**: Modern release (`git --version`)

---

### Option A: One-Click Startup (Windows)
If you are on Windows, start both the backend and frontend simultaneously with the root launch script:

```powershell
.\run.bat
```
This automatically starts FastAPI on `http://127.0.0.1:8000`, the Vite dev server on `http://localhost:3000`, and opens your default browser.

---

### Option B: Manual Setup

#### 1. Backend Setup (Terminal 1)
```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
# Windows:
python -m venv venv
.\venv\Scripts\Activate.ps1

# Linux / macOS:
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment variables
# (Default runs with local high-performance SQLite; to use PostgreSQL, set DATABASE_URL in .env)
copy .env.example .env

# Start FastAPI server
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Backend will be available at:
- **API Root**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive Swagger Docs**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Health Diagnostic**: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

#### 2. Frontend Setup (Terminal 2)
```bash
# Navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```

Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔌 API Reference Overview

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health, database connectivity status, and model statistics |
| `GET` | `/api/missions` | List all hydrographic survey missions with computed target metrics |
| `POST` | `/api/missions` | Register a new survey mission |
| `GET` | `/api/missions/{id}` | Retrieve single mission details and summary telemetry |
| `POST` | `/api/missions/{id}/import` | Import mission batch package (`.zip` with images or `.json` file) |
| `GET` | `/api/missions/{id}/export` | Export mission data in `pdf`, `excel`, `csv`, or `json` format |
| `GET` | `/api/detections` | Query individual detections with filtering by class, status, or mission |
| `POST` | `/api/detections` | Ingest real-time detection (JSON or `multipart/form-data` with image) |
| `GET` | `/api/detections/targets` | List consolidated physical targets (1 marker per physical seabed hazard) |
| `POST` | `/api/detections/{id}/review` | Human review ground-truthing (`confirm` or `reject`) |
| `GET` | `/api/reports/analysis` | Compute statistical distributions, risk scores, and mission analytics |
| `GET` | `/api/reports/export` | Download consolidated survey register in PDF or multi-sheet Excel |
| `WS` | `/ws/live-feed` | Real-time WebSocket event channel (`NEW_DETECTION`, `TARGET_REVIEWED`) |

---

## 🧪 Testing Live Ingestion

Once the backend is running, test the live ingestion pipeline using cURL or PowerShell:

### Using cURL
```bash
curl -X POST "http://127.0.0.1:8000/api/detections" \
     -H "Content-Type: application/json" \
     -d '{
       "target_id": "TGT-DEMO-01",
       "class": "debris_net",
       "confidence": 0.96,
       "latitude": 32.6512,
       "longitude": -117.5543,
       "estimated_size_m": 4.5,
       "shadow_verified": true,
       "status": "pending_review",
       "timestamp": "2026-09-11T12:00:00Z"
     }'
```

### Using PowerShell
```powershell
$payload = @{
    target_id = "TGT-DEMO-01"
    class = "cargo_container"
    confidence = 0.98
    latitude = 32.6489
    longitude = -117.5492
    estimated_size_m = 12.2
    shadow_verified = $true
    status = "pending_review"
    timestamp = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/detections" -Method Post -Body $payload -ContentType "application/json"
```

The new target will appear instantly on the live GIS map and detection feed via WebSocket broadcast with radar ping animation.

---

## 📁 Repository Structure

```
├── backend/
│   ├── app/
│   │   ├── api/             # REST routes (missions, detections, reports, auth, ws)
│   │   ├── db/              # SQLAlchemy models, Neon PostgreSQL bridge & repository
│   │   ├── ml/              # Abstract ML inference provider contracts
│   │   ├── parsers/         # Sonar manifest & telemetry parsers
│   │   ├── services/        # PDF (ReportLab), Excel (OpenPyXL), S3 Storage & analytics
│   │   └── main.py          # FastAPI application entrypoint & static mounts
│   ├── mock_data.py         # In-memory baseline data structures
│   ├── requirements.txt     # Python backend dependencies
│   └── Dockerfile           # Production container configuration
│
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI widgets, GIS map modals, header console
│   │   ├── context/         # Mission context and active survey state
│   │   ├── hooks/           # WebSocket and lifecycle hooks
│   │   ├── pages/           # Dashboard, GIS Map, Detections, Surveys, Reports, Upload
│   │   ├── services/        # Axios API clients (targets, missions, exports)
│   │   └── App.jsx          # Router & main shell layout
│   ├── package.json         # Frontend dependencies & build scripts
│   └── tailwind.config.js   # Custom maritime color palette & theme
│
├── .env.example             # Database & server configuration template
├── run.bat                  # Windows one-click local startup script
├── TERMINAL_RUN_GUIDE.md    # Comprehensive step-by-step terminal execution manual
└── README.md                # Project documentation
```

---

## 🛡️ License & Acknowledgements

Developed for **Problem Statement PS 26057** (AI-Powered Automated Underwater Marine Debris and Anomaly Detection System).

Built with modern open-source hydrographic computing standards. Contributions and feedback from marine surveyors, acoustic engineers, and software practitioners are welcome.