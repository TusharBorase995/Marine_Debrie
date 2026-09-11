# UI Interaction, Button Behavior & Data Fetching Audit Survey
**Project**: S.A.G.A.R — Sovereign Acoustic Geospatial Analytics & Reconnaissance  
**Scope**: Frontend React Architecture (`src/pages`, `src/components`, `src/context`, `src/services`, `src/hooks`)  
**Audit Date**: September 2026  
**Status**: Comprehensive Survey (Read-Only Codebase Audit — No Code Alterations)

---

## Executive Summary

A complete, systematic survey of all UI buttons, event handlers, interactive modals, asynchronous data fetch pipelines, and WebSocket streams across the S.A.G.A.R web interface was conducted. 

While the core user interface delivers a high-fidelity, responsive experience with instant in-memory caching and clean visual workflows, **18 distinct vulnerability points** across 4 severity tiers were uncovered. These include potential runtime exceptions in Leaflet GIS mapping, unhandled blob responses during PDF export, triple-connection WebSocket redundancies, race conditions on async delete operations, and silent data fallbacks that can display incorrect target data.

---

## Audit Findings Matrix

| Ref ID | Severity | Category | Affected File & Lines | Summary |
| :--- | :--- | :--- | :--- | :--- |
| **CRIT-01** | 🔴 Critical | Runtime Crash | `src/components/GISMap.jsx:398-433` | Leaflet crashes with `Invalid LatLng object: (NaN, NaN)` if detection has null/invalid coordinates. |
| **CRIT-02** | 🔴 Critical | Network / Deserialization | `src/pages/Reports.jsx:74-96` & `exportService.js:23,53` | Axios `responseType: 'blob'` hides backend error details; alerts display `[object Blob]` on failure. |
| **CRIT-03** | 🔴 Critical | Hook Destructuring Bug | `src/pages/UploadPage.jsx:38, 321-326` | Destructures `isConnected` from `useWebSocket` (which returns `connected`); badge is hardcoded green. |
| **CRIT-04** | 🔴 Critical | Infinite Polling Trap | `src/pages/ProcessingJobPage.jsx:18-36` | On HTTP 404 or network failure, error is swallowed; page polls 404 infinitely and remains stuck loading. |
| **HIGH-01** | 🟠 High | Architecture / Concurrency | `App.jsx`, `MissionContext.jsx`, `Dashboard.jsx`, `UploadPage.jsx`, etc. | 3 to 4 independent WebSocket connections open simultaneously per browser tab to Render backend. |
| **HIGH-02** | 🟠 High | Misleading Data Fallback | `src/pages/Dashboard.jsx:93-97` | Empty missions silently fall back to showing targets from other missions instead of showing "0 Targets". |
| **HIGH-03** | 🟠 High | Prop Mutation & Lifecycle | `src/components/EvidenceViewerModal.jsx:199-200, 220-226` | Directly mutates `activeTarget.status` prop and calls setState after parent unmounts modal. |
| **HIGH-04** | 🟠 High | Ingestion Backend Crash | `backend/app/api/missions.py:36-39, 83-84` | `normalize_detection_item` calls `round(lat, 6)`. If `lat` is `None`, Python raises unhandled `TypeError`. |
| **MED-01** | 🟡 Medium | Double-Click Race Condition | `src/pages/Surveys.jsx:109-125` | `handleDelete` button lacks disabled state; rapid double-click sends duplicate DELETEs, triggering 404 alert. |
| **MED-02** | 🟡 Medium | Double-Click Race Condition | `src/pages/SurveyDetail.jsx:52-59, 107-112` | "RUN INFERENCE PIPELINE" button has no disabled state during async submission, risking duplicate pipeline jobs. |
| **MED-03** | 🟡 Medium | Flash of False Warning | `src/context/MissionContext.jsx:42-51` & `Surveys.jsx:151` | `dbStatus.connected` is initially `false` while `checking: true`, flashing red "PostgreSQL Offline" banner on every mount. |
| **MED-04** | 🟡 Medium | Ghost Default Assignment | `src/pages/UploadPage.jsx:24-26, 118` | If `missions` has not yet hydrated, batch import silently defaults destination mission to `'MISSION-002'`. |
| **MED-05** | 🟡 Medium | State Reset Illusion | `src/pages/SettingsPage.jsx:27-31, 136-143` | "Save Parameters" button triggers fake 3s banner; never persists slider thresholds to storage or backend. |
| **MED-06** | 🟡 Medium | Global KPI Metric Leakage | `src/pages/Dashboard.jsx:106-110` | Top 4 metric cards calculate sums from global `targets`, disregarding the active mission filter. |
| **LOW-01** | 🟢 Low | Modal Stacking UX | `src/pages/Dashboard.jsx:880-932` | Opening Evidence Modal from Inspection Panel keeps both open at `z-[9999]`, causing stacked backdrop dimming. |
| **LOW-02** | 🟢 Low | Accessibility / Key Navigation | `src/pages/Surveys.jsx:490-510` & `LandingPage.jsx:506-528` | Modals lack `Escape` key listeners and backdrop-click dismiss handlers; users must target tiny `✕` button. |
| **LOW-03** | 🟢 Low | Metric Normalization Inconsistency | `src/pages/SurveyDetail.jsx:185` | Filters `d.validation_status === 'verified'`, which always returns 0 because normalized status is `'confirmed'`. |
| **LOW-04** | 🟢 Low | Cold-Start Feedback Gap | Global Axios API layer | When Render backend sleeps (15m inactivity), requests take 30-50s without a "Waking server up..." alert. |

---

## Detailed Audit Findings & Technical Breakdown

---

### [CRIT-01] Leaflet Map Crash on Null/NaN Coordinates in GISMap
* **Location**: [`frontend/src/components/GISMap.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/components/GISMap.jsx#L398-L433)
* **Trigger Interaction**: 
  1. A live detection arrives via WebSocket or API with `latitude: null`, `latitude: undefined`, or `latitude: "NaN"`.
  2. Or user imports a batch file where one target has pending or malformed GPS coordinates.
* **Failure Mechanism**:
  ```jsx
  {physicalTargets.map((tgt) => {
    return (
      <Marker 
        key={targetId} 
        position={[tgt.latitude, tgt.longitude]} // <-- THROWS ERROR IF NULL/NAN
        icon={icon}
      >
  ```
  Leaflet's `L.latLng(lat, lng)` strictly requires finite numeric values. If `tgt.latitude` is `null` or `NaN`, Leaflet throws:
  `Uncaught Error: Invalid LatLng object: (NaN, NaN)`
  Because this error occurs directly inside React's rendering lifecycle, the entire component tree unmounts and triggers the full-screen ErrorBoundary crash screen.
* **Why it hasn't crashed yet**: Existing test datasets (`MISSION-001`, `MISSION-002`) have clean coordinates. Any corrupted or partial real-time feed will immediately crash the page.
* **Recommended Non-Breaking Solution**:
  Filter `physicalTargets` to only valid coordinates before rendering `<Marker>`:
  ```javascript
  const validMapTargets = useMemo(() => {
    return physicalTargets.filter(t => 
      t.latitude != null && t.longitude != null &&
      !isNaN(Number(t.latitude)) && !isNaN(Number(t.longitude))
    );
  }, [physicalTargets]);
  ```

---

### [CRIT-02] Obscured PDF/Excel Export Failures Due to Axios Blob Response
* **Location**: [`frontend/src/pages/Reports.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Reports.jsx#L74-L96), [`frontend/src/services/exportService.js`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/services/exportService.js#L23)
* **Trigger Interaction**:
  1. User navigates to `/reports` and clicks **Download PDF Report** or **Download Excel Report**.
  2. The Render backend times out, encounters a 500 ReportLab error, or returns 404.
* **Failure Mechanism**:
  ```javascript
  // exportService.js
  const response = await axios.get(url, { responseType: 'blob' });
  
  // Reports.jsx
  } catch (err) {
    alert('Failed to generate PDF Report: ' + (err.response?.data?.detail || err.message));
  }
  ```
  Because Axios was configured with `responseType: 'blob'`, Axios wraps the HTTP 500 error JSON payload inside an instance of `Blob`!
  Therefore, `err.response.data.detail` is `undefined`.
  If the code attempts to display `err.response.data`, the browser displays:
  `Failed to generate PDF Report: [object Blob]`
  The actual server error message (e.g. "ReportLab missing", "Mission not found", or "Out of memory") is completely hidden from both developer and operator.
* **Recommended Non-Breaking Solution**:
  In `exportService.js` or `Reports.jsx`, read the error blob before alerting:
  ```javascript
  if (err.response?.data instanceof Blob) {
    try {
      const errorText = await err.response.data.text();
      const parsed = JSON.parse(errorText);
      alert('Export Failed: ' + (parsed.detail || err.message));
    } catch {
      alert('Export Failed: ' + err.message);
    }
  }
  ```

---

### [CRIT-03] Incorrect `useWebSocket` Property Destructuring & Static Status in UploadPage
* **Location**: [`frontend/src/pages/UploadPage.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/UploadPage.jsx#L38), lines 321–326
* **Trigger Interaction**: User visits `/upload` (Ingestion Hub) to monitor live ML streaming.
* **Failure Mechanism**:
  ```javascript
  // useWebSocket.js returns:
  return { data, connected, error };

  // UploadPage.jsx:38 destructures:
  const { isConnected: wsConnected, data: wsData } = useWebSocket('/ws/live-feed');
  ```
  `isConnected` does not exist on the returned object; therefore `wsConnected` evaluates to `undefined`.
  Furthermore, lines 321–326 hardcode the visual indicator:
  ```jsx
  <div className="flex items-center gap-2 mt-1">
    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
    <span className="font-bold text-xs text-slate-900">
      Listening on /ws/live-feed
    </span>
  </div>
  ```
  The badge pulses emerald green forever—even when the WebSocket is disconnected, failed, or the backend server is offline! The user is falsely assured that live streaming is active.
* **Recommended Non-Breaking Solution**:
  Destructure `{ connected: wsConnected }` and conditionally render an amber/red disconnected state when `!wsConnected`.

---

### [CRIT-04] Infinite 1-Second 404 Polling Loop on ProcessingJobPage
* **Location**: [`frontend/src/pages/ProcessingJobPage.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/ProcessingJobPage.jsx#L18-L36)
* **Trigger Interaction**: User navigates to `/processing/:jobId` where `:jobId` does not exist or backend is unreachable.
* **Failure Mechanism**:
  ```javascript
  const pollJob = async () => {
    try {
      const jobData = await jobService.getJobStatus(jobId);
      setJob(jobData);
      setLoading(false);
      if (jobData.status === 'completed' || jobData.status === 'failed') {
        if (interval) clearInterval(interval);
      }
    } catch (err) {
      console.error("Poll job error:", err); // Error swallowed!
    }
  };
  interval = setInterval(pollJob, 1000);
  ```
  When `getJobStatus(jobId)` throws an error (such as a 404 Not Found), execution jumps straight to `catch`. `setLoading(false)` is never called, `clearInterval` is never called, and no error state is set.
  The browser tab continuously fires GET requests every 1000ms indefinitely, flooding network logs while the UI displays "Connecting to pipeline process manager..." permanently.
* **Recommended Non-Breaking Solution**:
  Clear interval on consecutive errors, set `loading: false`, and render an error card with a button returning to `/surveys`.

---

### [HIGH-01] Multiple Concurrent WebSocket Connections Per Tab
* **Location**: [`App.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/App.jsx#L45), [`MissionContext.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/context/MissionContext.jsx#L166), [`Dashboard.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Dashboard.jsx#L56), [`Detections.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Detections.jsx#L67), [`MapPage.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/MapPage.jsx#L37), [`UploadPage.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/UploadPage.jsx#L38)
* **Trigger Interaction**: Normal browsing of any page in the application.
* **Failure Mechanism**:
  Each of the listed components independently invokes `useWebSocket('/ws/live-feed')`.
  When an operator views `Dashboard`:
  - `App.jsx` opens WS Connection #1
  - `MissionContext.jsx` opens WS Connection #2
  - `Dashboard.jsx` opens WS Connection #3
  Every incoming `NEW_DETECTION` broadcast is received 3 times on the client. Both `MissionContext` and `Dashboard` trigger state updates, causing redundant re-renders and risk of socket disconnects on hosting services with strict per-IP connection limits (such as Render's free tier).
* **Recommended Non-Breaking Solution**:
  Consolidate WebSocket lifecycle strictly inside `MissionContext.jsx`. Expose `wsData` and `wsConnected` via the `useMission()` hook to all child components.

---

### [HIGH-02] Silent Fallback to Other Missions' Targets on Empty Missions
* **Location**: [`frontend/src/pages/Dashboard.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Dashboard.jsx#L93-L97)
* **Trigger Interaction**: User creates a new survey mission (e.g. `MISSION-003`) and selects it as the active mission.
* **Failure Mechanism**:
  ```javascript
  const filteredTargets = useMemo(() => {
    if (!selectedMissionId || selectedMissionId === 'ALL') return targets;
    const subset = targets.filter(t => t.mission_id === selectedMissionId);
    return subset.length > 0 ? subset : targets; // <-- SILENT OVERRIDE!
  }, [targets, selectedMissionId]);
  ```
  Because `MISSION-003` has 0 targets initially, `subset.length` is 0.
  Instead of displaying an empty state ("0 targets detected in this mission"), the component returns `targets` (all targets across all missions).
  The operator sees targets from `MISSION-001` rendered under `MISSION-003`'s dashboard, giving a completely false operational picture.
* **Recommended Non-Breaking Solution**:
  Return `subset` directly without falling back:
  ```javascript
  return selectedMissionId === 'ALL' ? targets : targets.filter(t => t.mission_id === selectedMissionId);
  ```

---

### [HIGH-03] Direct Prop Mutation and Unmounted setState in EvidenceViewerModal
* **Location**: [`frontend/src/components/EvidenceViewerModal.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/components/EvidenceViewerModal.jsx#L199-L200, L220-L226)
* **Trigger Interaction**: Reviewing or deleting a target from inside the full-screen evidence viewer.
* **Failure Mechanism**:
  1. **Direct Prop Mutation**:
     ```javascript
     activeTarget.status = updatedStatus;
     activeTarget.human_review_status = updatedStatus;
     ```
     In React, mutating prop objects directly breaks unidirectional data flow and can prevent parent components from detecting shallow state changes.
  2. **Unmounted Execution**:
     When `handleDeleteActiveTarget` executes:
     ```javascript
     onTargetDeleted?.(tid); // Parent sets isEvidenceModalOpen(false) -> Modal unmounts!
     const remaining = siblingTargets.filter(t => (t.target_id || t.id) !== tid);
     if (remaining.length > 0) {
       selectTarget(remaining[0]); // <-- Triggers setState on unmounted component!
     }
     ```
* **Recommended Non-Breaking Solution**:
  Check an `isMounted` ref before updating local state after calling parent callbacks, and clone objects instead of mutating props.

---

### [HIGH-04] Backend Ingestion Crash on Missing/Null Latitude
* **Location**: [`backend/app/api/missions.py`](file:///c:/Users/Tushu/Desktop/original_Sonar/backend/app/api/missions.py#L35-L39, L83-L84)
* **Trigger Interaction**: An ML inference payload is posted to `POST /api/detections` where coordinates are pending (`latitude: null` or omitted).
* **Failure Mechanism**:
  ```python
  raw_lat = item.get("latitude")
  lat = float(raw_lat) if raw_lat is not None else None
  ...
  "latitude": round(lat, 6), # <-- CRASH!
  ```
  In Python, `round(None, 6)` raises `TypeError: type NoneType doesn't define __round__ method`.
  The FastAPI backend crashes with a 500 Internal Server Error, and the UI displays "Batch import failed: Internal Server Error".
* **Recommended Non-Breaking Solution**:
  Protect the rounding helper: `round(lat, 6) if lat is not None else None`.

---

### [MED-01] Double-Click Race Condition on Mission Deletion
* **Location**: [`frontend/src/pages/Surveys.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Surveys.jsx#L109-L125)
* **Trigger Interaction**: User clicks the trash can icon to delete a mission and rapidly clicks "OK" or double-clicks.
* **Failure Mechanism**:
  `handleDelete` is an async function without a disabled state on the trash button. If clicked twice before the first network response finishes, two concurrent `DELETE /api/missions/{id}` requests fire.
  The first succeeds (200 OK); the second hits a deleted resource (404 Not Found) and triggers:
  `alert("Failed to delete mission: Mission not found")`
* **Recommended Non-Breaking Solution**:
  Track `deletingId` in local state and disable the button while deletion is pending.

---

### [MED-02] Duplicate Job Spawning on Inference Pipeline Button
* **Location**: [`frontend/src/pages/SurveyDetail.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/SurveyDetail.jsx#L52-L59, L107-L112)
* **Trigger Interaction**: User clicks "RUN INFERENCE PIPELINE".
* **Failure Mechanism**:
  The button does not have a `disabled={processing}` state. On slow networks or cold-start backends, an impatient user clicking the button two or three times will initiate two or three background processing jobs simultaneously for the same survey.
* **Recommended Non-Breaking Solution**:
  Add `const [startingJob, setStartingJob] = useState(false)` and disable the button during the async call.

---

### [MED-03] Flashing False-Alarm "PostgreSQL Offline" Warning Banner on Mount
* **Location**: [`frontend/src/context/MissionContext.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/context/MissionContext.jsx#L42-L51), [`frontend/src/pages/Surveys.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Surveys.jsx#L151)
* **Trigger Interaction**: User loads or reloads `/surveys`.
* **Failure Mechanism**:
  `dbStatus` in `MissionContext` is initialized as:
  ```javascript
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    checking: true,
    ...
  });
  ```
  `Surveys.jsx:151` checks:
  ```jsx
  {!dbStatus?.connected && (
    <div className="bg-red-50 ...">PostgreSQL Database Offline</div>
  )}
  ```
  For the first 500ms to 2000ms before `/api/health` returns, `dbStatus.connected` is `false`. Even though the database is 100% online and healthy, the red "Database Offline" banner flashes on screen every time the user visits `/surveys`.
* **Recommended Non-Breaking Solution**:
  Update condition to: `{!dbStatus?.connected && !dbStatus?.checking && (`.

---

### [MED-04] Batch Upload Silently Defaults Destination to Hardcoded `'MISSION-002'`
* **Location**: [`frontend/src/pages/UploadPage.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/UploadPage.jsx#L24-L26, L118)
* **Trigger Interaction**: User lands on `/upload` and drops a `detections.json` file before `missions` has finished loading.
* **Failure Mechanism**:
  ```javascript
  const [targetMissionId, setTargetMissionId] = useState(() => {
    return selectedMissionId !== 'ALL' ? selectedMissionId : (missions?.[0]?.mission_id || '');
  });
  ...
  // In handleBatchImport:
  const mId = targetMissionId.trim() || 'MISSION-002';
  ```
  If `missions` is empty on initial render, `targetMissionId` is `''`. If the user immediately uploads a batch without changing the dropdown, the upload is silently injected into `'MISSION-002'` even if the user wanted `'MISSION-001'` or a custom mission!
* **Recommended Non-Breaking Solution**:
  Require explicit destination selection or disable upload button if `!targetMissionId`.

---

### [MED-05] Settings Page Parameter Sliders Do Not Persist
* **Location**: [`frontend/src/pages/SettingsPage.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/SettingsPage.jsx#L27-L31, L136-L143)
* **Trigger Interaction**: User adjusts "High Confidence Auto-Verification Threshold" to 95% and clicks "Save Parameters".
* **Failure Mechanism**:
  `handleSaveSettings` simply runs:
  ```javascript
  const handleSaveSettings = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };
  ```
  No request is sent to the backend, and nothing is written to `localStorage`. Navigating to another page and returning resets the sliders back to their hardcoded initial states (90% and 60%).
* **Recommended Non-Breaking Solution**:
  Persist threshold values in `localStorage` or sync them with the backend ATR settings endpoint.

---

### [MED-06] Top KPI Metric Cards Show Global Totals on Filtered Dashboards
* **Location**: [`frontend/src/pages/Dashboard.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Dashboard.jsx#L106-L110)
* **Trigger Interaction**: User selects a specific active mission (e.g. `MISSION-001`) from the Topbar.
* **Failure Mechanism**:
  The bottom cards and classification donut chart correctly use `filteredTargets`.
  However, the top four KPI cards calculate counts using global `targets`:
  ```javascript
  const totalTargetsCount = targets.length;
  const confirmedCount = targets.filter(t => normalizeStatus(...) === 'confirmed').length;
  ```
  The dashboard displays the total targets across the entire database rather than targets belonging to the selected mission, creating metric discrepancies between cards on the same page.
* **Recommended Non-Breaking Solution**:
  Compute counts based on `filteredTargets` when `selectedMissionId !== 'ALL'`.

---

### [LOW-01] Stacked Modal Z-Index Conflict Between Detail Panel and Evidence Viewer
* **Location**: [`frontend/src/pages/Dashboard.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Dashboard.jsx#L880-L932)
* **Trigger Interaction**: On the Dashboard, user clicks a target to open `DetectionDetailPanel`, then clicks "Enlarge &rarr;" to open `EvidenceViewerModal`.
* **Failure Mechanism**:
  Both modals are rendered through React Portals into `document.body` with `z-[9999]`.
  `showDetailModal` is not set to `false` when `isEvidenceModalOpen` becomes `true`.
  This creates two dark backdrop overlays stacked on top of each other. When the user closes the Evidence Viewer, they find the Detail Panel still open behind it, requiring a second dismiss action.
* **Recommended Non-Breaking Solution**:
  Close or minimize `showDetailModal` when opening `EvidenceViewerModal`, or manage a unified modal state enum: `'NONE' | 'DETAIL' | 'EVIDENCE'`.

---

### [LOW-02] Modals Missing Escape Key and Backdrop-Click Dismissal
* **Location**: [`frontend/src/pages/Surveys.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/Surveys.jsx#L490-L510), [`frontend/src/pages/LandingPage.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/LandingPage.jsx#L506-L528)
* **Trigger Interaction**: User opens the "Create New Survey Mission" modal on `/surveys` or the "Sign In / Register" modal on the landing page, and presses the `Esc` key or clicks outside the modal dialog.
* **Failure Mechanism**:
  Neither modal binds a `keydown` listener for `Escape`, and the outer overlay `div` lacks an `onClick` handler. The user is forced to locate and click the small `✕` or `Cancel` button to exit.
* **Recommended Non-Breaking Solution**:
  Add an `onClick={() => setIsCreateModalOpen(false)}` on the backdrop and an `e.stopPropagation()` on the modal content container.

---

### [LOW-03] Incorrect Status Field Checked in SurveyDetail Target Summary
* **Location**: [`frontend/src/pages/SurveyDetail.jsx`](file:///c:/Users/Tushu/Desktop/original_Sonar/frontend/src/pages/SurveyDetail.jsx#L185)
* **Trigger Interaction**: User inspects `/surveys/:id` after confirming targets.
* **Failure Mechanism**:
  Line 185 renders:
  `{detections.filter(d => d.validation_status === 'verified').length}`
  Throughout the rest of the application and in the database, the status is stored as `status: 'confirmed'` and normalized via `normalizeStatus()`. The field `validation_status` does not exist on detections, causing the "Verified" count in this card to permanently read `0`.
* **Recommended Non-Breaking Solution**:
  Replace with `detections.filter(d => (d.status === 'confirmed' || d.human_review_status === 'confirmed')).length`.

---

### [LOW-04] Cold-Start Timeout Indicator Gap for Render Deployment
* **Location**: Global Frontend API Communication (`frontend/src/services/*`)
* **Trigger Interaction**: User opens the deployed live application at `https://marine-debrie.vercel.app` after the Render backend has been dormant for >15 minutes.
* **Failure Mechanism**:
  Render free tier web services spin down after 15 minutes of inactivity. Waking from cold sleep takes 30 to 50 seconds.
  If a user immediately attempts to export a PDF, log in, or save data, the request hangs until Render spins up or Axios times out.
  The user is shown a generic "Failed to fetch" or "Request failed with status 504" alert without explanation that the server is merely waking up.
* **Recommended Non-Breaking Solution**:
  Add an Axios interceptor or topbar health banner showing "Backend is waking up (cold start)..." when `/api/health` takes longer than 3 seconds on initial boot.

---

## Page-by-Page Button Behavior Checklist

| Page / Component | Interactive Element | Current Action | Observed Potential Failure |
| :--- | :--- | :--- | :--- |
| **Landing Page** | "⚡ Auto-Fill Tester" | Injects demo credentials into state | None (Safe client state) |
| **Landing Page** | "Log In & Enter Dashboard" | `POST /api/auth/login` | Cold-start timeout can trigger unhandled error string |
| **Dashboard** | "New Survey" button | Navigates to `/surveys` | None (Safe router navigation) |
| **Dashboard** | "Import Data" button | Navigates to `/upload` | None (Safe router navigation) |
| **Dashboard** | Metric Card Action Arrows | Navigates to subpages | None (Safe router navigation) |
| **Dashboard** | Recent Detections Item | Opens `DetectionDetailPanel` | Stacked backdrop issue if user then clicks "Enlarge" |
| **Dashboard** | "Confirm" / "Reject" | Optimistically updates status | None (Safe optimistic update with DB rollback) |
| **Surveys** | "Create New Mission" | Opens modal dialog | Missing `Esc` key and backdrop dismiss |
| **Surveys** | Modal "Register Mission" | `POST /api/missions` | Disabled when DB offline; correctly guarded |
| **Surveys** | Trash Can Icon (Delete) | `DELETE /api/missions/{id}` | Lacks button disable during network call (double-click race) |
| **Detections** | View Toggle (Table/Cards) | Toggles view state | None (Safe client state) |
| **Detections** | "Sync" button | Calls `refreshData()` | Safely spins; correctly guarded |
| **Detections** | Table Actions (Confirm/Reject)| Optimistic review & DB write | Dismisses inspector drawer on click (may surprise user) |
| **Detections** | Delete Target Trash Can | Opens confirmation modal | Safely implemented with modal confirmation |
| **GISMap** | Basemap Switcher | Switches tile provider URL | None (Pure client layer toggle) |
| **GISMap** | [+] / [-] Zoom Buttons | Adjusts Leaflet map zoom | None (Safe Leaflet API calls) |
| **GISMap** | "Fit Targets" button | Calculates `latLngBounds` | Safely checks bounds before calling `fitBounds` |
| **GISMap** | Target Markers | Opens popup & triggers selection | **Crashes page if target has null/NaN coordinates** |
| **Reports** | "Download PDF Report" | `GET /api/missions/{id}/export` | **Blob error masking; displays `[object Blob]` on failure** |
| **Reports** | "Download Excel Report"| `GET /api/missions/{id}/export` | **Blob error masking; displays `[object Blob]` on failure** |
| **UploadPage** | Mode B Dropzone | Accepts `.zip` / `.json` | None (File extension validated) |
| **UploadPage** | "Import Batch" button | `POST /api/missions/{id}/import`| **Silent fallback to `MISSION-002` if state not hydrated** |
| **Settings** | "Save Parameters" | Form submission | **Does not save to backend or localStorage (state lost on reload)** |
| **Topbar** | Ctrl + K Omnisearch | Searches targets/missions | None (Safe instant fuzzy search) |
| **Topbar** | DB Health Badge | Opens PostgreSQL health modal | **Flashes false "Database Offline" banner on cold boot** |

---

## Conclusion & Proposed Remediation Path

The application UI exhibits clean architecture, robust optimistic updates, and sophisticated component design. The issues identified above are standard edge-case hazards common in complex geospatial web applications.

When the user gives approval to apply fixes, the recommended execution order is:
1. **Phase 1 (Crash Guards)**: Add coordinate null-checks in `GISMap.jsx` and safe blob text parsing in `Reports.jsx`/`exportService.js`.
2. **Phase 2 (Connection & Concurrency)**: Centralize WebSocket subscription in `MissionContext.jsx` and add async button disabling in `Surveys.jsx`.
3. **Phase 3 (Data Consistency)**: Fix empty-mission fallback in `Dashboard.jsx` and initialize `dbStatus.checking: true` guard in `Surveys.jsx`.
4. **Phase 4 (UX Refinements)**: Add modal `Escape`/backdrop dismiss and persist parameters in `SettingsPage.jsx`.
