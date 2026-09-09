import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HeaderConsole, { Topbar } from './components/HeaderConsole';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Surveys from './pages/Surveys';
import SurveyDetail from './pages/SurveyDetail';
import UploadPage from './pages/UploadPage';
import ProcessingJobPage from './pages/ProcessingJobPage';
import Detections from './pages/Detections';
import MapPage from './pages/MapPage';
import Reports from './pages/Reports';
import SettingsPage from './pages/SettingsPage';
import { useWebSocket } from './hooks/useWebSocket';
import { MissionProvider } from './context/MissionContext';
import ErrorBoundary from './components/ErrorBoundary';

function MainAppLayout({ connected }) {
  return (
    <div className="min-h-screen bg-[#F4F7FB] text-[#0B192C] flex font-sans select-none">
      {/* Left Sidebar */}
      <HeaderConsole wsConnected={connected} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        <Routes>
          <Route path="/dashboard" element={<><Topbar title="Operational Mission Dashboard" subtitle="Real-time acoustic detection, mission KPI telemetry, and target status" /><Dashboard /></>} />
          <Route path="/surveys" element={<><Topbar title="Survey & Mission Management" subtitle="Manage independent hydrographic missions, ingestion modes, and survey boundaries" /><Surveys /></>} />
          <Route path="/surveys/:id" element={<><Topbar title="Mission Details & Inspection" subtitle="Target returns, acoustic metadata, and multi-pass sonar telemetry" /><SurveyDetail /></>} />
          <Route path="/map" element={<><Topbar title="GIS Georeferenced Spatial View" subtitle="Bathymetric target markers, survey coverage, and AUV telemetry track" /><MapPage /></>} />
          <Route path="/upload" element={<><Topbar title="ML Detection Ingestion Hub" subtitle="Live JSON stream (Mode A) and mission batch package import (Mode B)" /><UploadPage /></>} />
          <Route path="/detections" element={<><Topbar title="Target Management & Ground-Truthing" subtitle="Analyst verification, shadow validation, and false-positive handling" /><Detections /></>} />
          <Route path="/reports" element={<><Topbar title="Hydrographic Mission Reports" subtitle="Mission summary metrics, target breakdown, and canonical CSV/JSON exports" /><Reports /></>} />
          <Route path="/settings" element={<><Topbar title="System Settings & Preferences" subtitle="Display thresholds, GIS map parameters, and notification configuration" /><SettingsPage /></>} />
          <Route path="/processing/:jobId" element={<><Topbar title="Pipeline Job Monitor" subtitle="Automated Target Recognition inference status" /><ProcessingJobPage /></>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  const { connected } = useWebSocket('/ws/live-feed');

  return (
    <ErrorBoundary>
      <MissionProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Cinematic Landing Page */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/landing" element={<LandingPage />} />

            {/* Operational Application Platform */}
            <Route path="/*" element={<MainAppLayout connected={connected} />} />
          </Routes>
        </BrowserRouter>
      </MissionProvider>
    </ErrorBoundary>
  );
}

