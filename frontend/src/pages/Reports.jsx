import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Compass, Download, FileText, CheckCircle2, Clock, XCircle, 
  Layers, BarChart3, Radio, ArrowUpRight, Search, RefreshCw, Trash2,
  Archive, AlertCircle, MapPin
} from 'lucide-react';
import { useMission } from '../context/MissionContext';
import exportService from '../services/exportService';
import detectionService from '../services/detectionService';
import { formatClassLabel, formatConfidence, formatSize } from '../utils/formatters';

export const Reports = () => {
  const navigate = useNavigate();
  const { 
    missions, 
    selectedMissionId, 
    setSelectedMissionId, 
    selectedMission, 
    refreshMissions,
    setSelectedTargetId
  } = useMission();

  const [activeMission, setActiveMission] = useState(null);
  const [missionTargets, setMissionTargets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const targets = await detectionService.getConsolidatedTargets();
      setMissionTargets(targets || []);
    } catch (err) {
      console.error('Failed to load mission targets:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Sync activeMission with selectedMissionId from context
  useEffect(() => {
    if (selectedMission) {
      setActiveMission(selectedMission);
    } else if (missions.length > 0) {
      setActiveMission(missions[0]);
    }
  }, [selectedMission, missions]);

  const handleExportCSV = async (missionId, e) => {
    if (e) e.stopPropagation();
    try {
      setExporting(true);
      await exportService.exportCSV(missionId);
    } catch (err) {
      alert('Failed to export CSV: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = async (missionId, e) => {
    if (e) e.stopPropagation();
    try {
      setExporting(true);
      await exportService.exportJSON(missionId);
    } catch (err) {
      alert('Failed to export JSON: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Filtered targets strictly for the selected mission
  const activeTargets = useMemo(() => {
    if (!activeMission) return missionTargets;
    const mId = activeMission.mission_id;
    return missionTargets.filter(t => t.mission_id === mId);
  }, [missionTargets, activeMission]);

  // Classification breakdown
  const classBreakdown = useMemo(() => {
    const counts = {};
    activeTargets.forEach(t => {
      const cls = t.class || t.category || 'debris_net';
      counts[cls] = (counts[cls] || 0) + 1;
    });
    return counts;
  }, [activeTargets]);

  const confirmedCount = activeMission?.confirmed_count ?? activeTargets.filter(t => t.status === 'confirmed').length;
  const pendingCount = activeMission?.pending_count ?? activeTargets.filter(t => t.status === 'pending_review').length;
  const rejectedCount = activeMission?.rejected_count ?? activeTargets.filter(t => t.status === 'rejected').length;
  const totalCount = activeMission?.target_count ?? (confirmedCount + pendingCount + rejectedCount);
  const reviewedTotal = confirmedCount + rejectedCount;
  const progressPct = totalCount > 0 ? Math.round((reviewedTotal / totalCount) * 100) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-8 font-sans bg-[#F8FAFC] min-h-screen text-slate-800">
      
      {/* 1. Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
              MISSION REPORTING & EXPORT
            </span>
            <span className="text-xs text-slate-400 font-mono">Canonical Survey Telemetry</span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
            Hydrographic Survey Mission Reports
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational summary, ground-truth verification progress, and exportable canonical datasets per survey mission.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => handleExportCSV(activeMission?.mission_id || 'MISSION-001')}
            disabled={exporting}
            className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            Download CSV
          </button>

          <button
            onClick={() => handleExportJSON(activeMission?.mission_id || 'MISSION-001')}
            disabled={exporting}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Download JSON
          </button>
        </div>
      </div>

      {/* 2. Mission Selection Cards Carousel / Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            SELECT SURVEY MISSION FOR REPORT
          </h3>
          <span className="text-xs text-slate-400 font-mono">{missions.length} Registered Missions</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(missions || []).length === 0 ? (
            <div className="col-span-3 py-6 text-center text-xs text-slate-400 font-mono">
              No missions registered yet. Create a mission or ingest detections to generate reports.
            </div>
          ) : (
            (missions || []).map((m) => {
            const isSelected = activeMission?.mission_id === m.mission_id;
            const isLive = (m.ingestion_mode || '').toLowerCase() === 'live';
            const mDate = m.created_at 
              ? new Date(m.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
              : 'Active';

            return (
              <div
                key={m.mission_id}
                onClick={() => {
                  setActiveMission(m);
                  setSelectedMissionId(m.mission_id);
                }}
                className={`bg-white rounded-2xl p-5 border transition-all cursor-pointer shadow-xs relative ${
                  isSelected 
                    ? 'border-2 border-indigo-600 ring-2 ring-indigo-100 shadow-md' 
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Compass className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{m.mission_id}</span>
                      <h4 className="text-xs font-black text-slate-900 line-clamp-1 leading-tight">{m.survey_name}</h4>
                    </div>
                  </div>

                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    isLive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  }`}>
                    {isLive ? 'LIVE' : 'BATCH'}
                  </span>
                </div>

                {/* 4-Pill Metric Row */}
                <div className="grid grid-cols-4 gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100 text-center font-mono">
                  <div>
                    <span className="text-[8px] text-slate-400 font-bold uppercase block">TOTAL</span>
                    <span className="text-xs font-black text-slate-800">{m.target_count || m.detection_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-emerald-600 font-bold uppercase block">CONF</span>
                    <span className="text-xs font-black text-emerald-600">{m.confirmed_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-amber-600 font-bold uppercase block">PEND</span>
                    <span className="text-xs font-black text-amber-600">{m.pending_count || 0}</span>
                  </div>
                  <div>
                    <span className="text-[8px] text-red-600 font-bold uppercase block">REJ</span>
                    <span className="text-xs font-black text-red-600">{m.rejected_count || 0}</span>
                  </div>
                </div>

                <div className="text-[10px] text-slate-400 mt-3 flex items-center justify-between">
                  <span>{mDate}</span>
                  {isSelected && (
                    <span className="text-indigo-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Selected Report
                    </span>
                  )}
                </div>
              </div>
            );
          }))}
        </div>
      </div>

      {/* 3. Selected Mission Report Deep-Dive */}
      {activeMission && (
        <div className="space-y-6">
          
          {/* Mission Details & Summary KPIs */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-mono font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  {activeMission.mission_id}
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                  {activeMission.survey_name}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                  {activeMission.description || 'Acoustic side-scan sonar hydrographic survey.'}
                </p>
              </div>

              {/* Quick Export Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExportCSV(activeMission.mission_id)}
                  className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-indigo-600" /> Export CSV
                </button>
                <button
                  onClick={() => handleExportJSON(activeMission.mission_id)}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Export JSON
                </button>
              </div>
            </div>

            {/* 4 Large KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">TOTAL TARGETS</span>
                <div className="text-2xl font-black font-mono text-slate-900">{totalCount}</div>
                <span className="text-[11px] text-slate-500">Acoustic Contacts</span>
              </div>

              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-200/70">
                <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block mb-1">CONFIRMED</span>
                <div className="text-2xl font-black font-mono text-emerald-600">{confirmedCount}</div>
                <span className="text-[11px] text-emerald-700 font-medium">Ground-Truthed Targets</span>
              </div>

              <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200/70">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">PENDING REVIEW</span>
                <div className="text-2xl font-black font-mono text-amber-600">{pendingCount}</div>
                <span className="text-[11px] text-amber-700 font-medium">Awaiting Action</span>
              </div>

              <div className="bg-red-50/50 p-4 rounded-xl border border-red-200/70">
                <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider block mb-1">REJECTED / FALSE POSITIVES</span>
                <div className="text-2xl font-black font-mono text-red-600">{rejectedCount}</div>
                <span className="text-[11px] text-red-700 font-medium">Filtered False Alarms</span>
              </div>
            </div>

            {/* Verification Progress Bar */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/70 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                  Analyst Ground-Truth Verification Progress
                </span>
                <span className="font-mono font-bold text-indigo-600">
                  {reviewedTotal} of {totalCount} reviewed ({progressPct}%)
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden flex">
                <div 
                  style={{ width: `${totalCount > 0 ? (confirmedCount / totalCount) * 100 : 0}%` }} 
                  className="bg-emerald-500 h-full transition-all" 
                  title={`Confirmed: ${confirmedCount}`}
                />
                <div 
                  style={{ width: `${totalCount > 0 ? (rejectedCount / totalCount) * 100 : 0}%` }} 
                  className="bg-red-500 h-full transition-all" 
                  title={`Rejected: ${rejectedCount}`}
                />
              </div>
              <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Confirmed ({confirmedCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500" /> Rejected ({rejectedCount})
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-300" /> Pending ({pendingCount})
                </span>
              </div>
            </div>

            {/* Target Classification Distribution Grid */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-600" />
                Target Classification Distribution
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { cls: 'debris_net', label: 'Debris Net' },
                  { cls: 'pipe_cylinder', label: 'Pipeline / Cylinder' },
                  { cls: 'wreck_structure', label: 'Shipwreck Structure' },
                  { cls: 'naval_mine', label: 'Acoustic Mine Hazard' }
                ].map(item => {
                  const count = classBreakdown[item.cls] || 0;
                  return (
                    <div key={item.cls} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">{item.label}</span>
                      <div className="text-xl font-black font-mono text-slate-900 mt-0.5">{count}</div>
                      <span className="text-[10px] text-slate-500">
                        {totalCount > 0 ? Math.round((count / totalCount) * 100) : 0}% of targets
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>



        </div>
      )}

    </div>
  );
};

export default Reports;
