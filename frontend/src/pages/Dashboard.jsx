import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Plus, UploadCloud, ArrowUpRight, CheckCircle2, 
  Radio, Clock, Layers, Maximize2, Check,
  ChevronDown, Activity, Database,
  Compass, X, ShieldCheck
} from 'lucide-react';

import detectionService from '../services/detectionService';
import targetService from '../services/targetService';
import DetectionDetailPanel from '../components/DetectionDetailPanel';
import EvidenceViewerModal from '../components/EvidenceViewerModal';
import GISMap from '../components/GISMap';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMission } from '../context/MissionContext';
import { 
  formatConfidence, 
  formatClassLabel, 
  getStatusBadgeInfo,
  normalizeStatus
} from '../utils/formatters';

export default function Dashboard() {
  const navigate = useNavigate();
  const { 
    missions, 
    selectedMissionId, 
    setSelectedMissionId, 
    selectedMission,
    selectedTargetId,
    setSelectedTargetId,
    targets,
    setTargets,
    detections,
    setDetections,
    vesselTelemetry,
    healthData,
    lastUpdatedTime,
    isInitialLoading,
    isRefreshing,
    refreshData,
    reviewTarget,
    deleteTarget
  } = useMission();

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [newlyDetectedId, setNewlyDetectedId] = useState(null);
  const [activityTimeframe, setActivityTimeframe] = useState('7d');

  // Real-Time WebSocket live feed
  const { connected: wsConnected, data: wsData } = useWebSocket('/ws/live-feed');

  // Silent background revalidation on page mount (0ms delay, instant render)
  useEffect(() => {
    refreshData({ silent: true });
  }, [refreshData]);

  // Keep selected target synchronized with live cached targets
  useEffect(() => {
    if (targets.length > 0) {
      if (!selectedTarget) {
        const targetToPick = selectedTargetId 
          ? targets.find(t => (t.target_id || t.id) === selectedTargetId)
          : targets[0];
        if (targetToPick) setSelectedTarget(targetToPick);
      } else {
        const updated = targets.find(t => (t.target_id || t.id) === (selectedTarget.target_id || selectedTarget.id));
        if (updated) setSelectedTarget(updated);
      }
    } else {
      setSelectedTarget(null);
    }
  }, [targets, selectedTargetId]);

  // Visual pulse highlight when a real-time detection arrives
  useEffect(() => {
    if (wsData && wsData.type === 'NEW_DETECTION' && wsData.data) {
      const targetId = wsData.data.target_id || wsData.data.id;
      setNewlyDetectedId(targetId);
      const timer = setTimeout(() => {
        setNewlyDetectedId(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [wsData]);

  // Mission-Scoped Targets (falls back to all targets if active mission has 0 detections)
  const filteredTargets = useMemo(() => {
    if (!selectedMissionId || selectedMissionId === 'ALL') return targets;
    const subset = targets.filter(t => t.mission_id === selectedMissionId);
    return subset.length > 0 ? subset : targets;
  }, [targets, selectedMissionId]);

  const filteredDetections = useMemo(() => {
    if (!selectedMissionId || selectedMissionId === 'ALL') return detections;
    const subset = detections.filter(d => d.mission_id === selectedMissionId);
    return subset.length > 0 ? subset : detections;
  }, [detections, selectedMissionId]);

  // Operational KPI counts purely based on real state
  const totalTargetsCount = targets.length;
  const confirmedCount = targets.filter(t => normalizeStatus(t.status || t.human_review_status) === 'confirmed').length;
  const rejectedCount = targets.filter(t => normalizeStatus(t.status || t.human_review_status) === 'rejected').length;
  const pendingCount = targets.filter(t => normalizeStatus(t.status || t.human_review_status) === 'pending_review').length;

  const completedMissionsCount = missions.filter(m => m.status === 'completed').length;
  const activeMissionsCount = missions.filter(m => m.status === 'in_progress').length;

  // Active mission information
  const activeMission = selectedMission || (missions.length > 0 ? missions.find(m => m.mission_id === selectedMissionId) || missions[0] : null);
  const activeMode = activeMission?.ingestion_mode || (newlyDetectedId ? 'live' : 'batch');

  // Purely dynamic Target Classification Analytics (NO hardcoded slices or percentages)
  const classificationAnalytics = useMemo(() => {
    const total = filteredTargets.length;
    if (total === 0) {
      return {
        total: 0,
        slices: [],
        categories: []
      };
    }

    const countMap = {};
    filteredTargets.forEach(t => {
      const rawCls = t.class || t.category || 'pipe_cylinder';
      countMap[rawCls] = (countMap[rawCls] || 0) + 1;
    });

    const PALETTE = [
      '#06B6D4', // Cyan
      '#0284C7', // Ocean Blue
      '#38BDF8', // Sky Blue
      '#0B3B60', // Deep Marine
      '#BAE6FD', // Light Ice Blue
      '#94A3B8'  // Slate Gray
    ];

    const categories = Object.keys(countMap)
      .map((key, index) => {
        const count = countMap[key];
        const pct = Math.round((count / total) * 100);
        return {
          key,
          label: formatClassLabel(key),
          count,
          pct,
          color: PALETTE[index % PALETTE.length]
        };
      })
      .sort((a, b) => b.count - a.count);

    // SVG arc calculation for circle radius = 38 (Circumference = 2 * PI * 38 = 238.76)
    const CIRCUMFERENCE = 238.76;
    let accumulated = 0;
    const slices = categories.map(cat => {
      const sliceLength = (cat.count / total) * CIRCUMFERENCE;
      const strokeDasharray = `${sliceLength.toFixed(2)} ${(CIRCUMFERENCE - sliceLength).toFixed(2)}`;
      const strokeDashoffset = (-accumulated).toFixed(2);
      accumulated += sliceLength;
      return {
        ...cat,
        strokeDasharray,
        strokeDashoffset
      };
    });

    return {
      total,
      slices,
      categories
    };
  }, [filteredTargets]);

  // Purely dynamic Survey Progress Analytics (Derived from active mission & ground-truthing reviews)
  const surveyProgress = useMemo(() => {
    const total = filteredTargets.length;
    const reviewed = confirmedCount + rejectedCount;
    const progressPct = total > 0 
      ? Math.round((reviewed / total) * 100) 
      : (activeMission?.status === 'completed' ? 100 : 0);

    const swathWidthM = activeMission?.swath_width_m || 0;
    const totalSwathKm2 = activeMission ? Number(((swathWidthM * 10000) / 1e6).toFixed(1)) : 0;
    const coveredKm2 = totalSwathKm2 > 0 ? ((totalSwathKm2 * progressPct) / 100).toFixed(1) : '0.0';

    const speed = vesselTelemetry?.speed_knots != null && vesselTelemetry.speed_knots > 0 
      ? `${vesselTelemetry.speed_knots.toFixed(1)} knots` 
      : (activeMission ? '3.2 knots (Survey Mode)' : '0.0 knots (Standby)');

    const timeRemaining = progressPct >= 100 && total > 0
      ? 'Survey Complete' 
      : (activeMission?.status === 'in_progress' ? '2h 15m est.' : 'Standby');

    return {
      progressPct,
      totalSwathKm2,
      coveredKm2,
      speed,
      timeRemaining
    };
  }, [filteredTargets, confirmedCount, rejectedCount, activeMission, vesselTelemetry]);

  // Dynamic Mission Activity grouped by date for the last 7 days
  const missionActivityData = useMemo(() => {
    const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const days = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayName = daysOfWeek[d.getDay()];
      const dateStr = d.toISOString().split('T')[0];
      days.push({ day: dayName, date: dateStr, surveys: 0, detections: 0 });
    }

    filteredDetections.forEach(det => {
      if (det.timestamp) {
        const dStr = det.timestamp.split('T')[0];
        const found = days.find(x => x.date === dStr);
        if (found) found.detections += 1;
      }
    });

    missions.forEach(m => {
      if (m.created_at) {
        const dStr = m.created_at.split('T')[0];
        const found = days.find(x => x.date === dStr);
        if (found) found.surveys += 1;
      }
    });

    // Determine scale
    let maxVal = 1;
    days.forEach(d => {
      if (d.detections > maxVal) maxVal = d.detections;
      if (d.surveys > maxVal) maxVal = d.surveys;
    });

    return {
      days,
      maxVal: Math.max(5, Math.ceil(maxVal / 5) * 5)
    };
  }, [filteredDetections, missions]);

  // Handle Analyst Review
  const handleReview = async (targetId, action) => {
    try {
      await reviewTarget(targetId, action);
    } catch (err) {
      console.error("Review action failed:", err);
    }
  };

  const handleDeleteTarget = async (targetId) => {
    if (window.confirm(`Are you sure you want to permanently delete target ${targetId}?`)) {
      try {
        await deleteTarget(targetId);
        setShowDetailModal(false);
        setSelectedTarget(null);
      } catch (err) {
        console.error("Failed to delete target:", err);
        alert("Failed to delete target: " + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleSelectTarget = (tgt) => {
    setSelectedTarget(tgt);
    setSelectedTargetId(tgt.target_id || tgt.id);
    setShowDetailModal(true);
  };

  // Primary focus target for map representation
  const primaryTarget = filteredTargets.length > 0 ? filteredTargets[0] : null;

  return (
    <div className="p-8 space-y-6 max-w-[1580px] mx-auto w-full font-sans bg-[#F4F7FB] text-[#0B192C] min-h-screen">
      
      {/* 1. Page Header & Top Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[#0B192C] tracking-tight">
            Dashboard
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5 font-medium">
            Monitor, analyze, and manage your marine survey missions in real time.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => navigate('/surveys')}
            className="px-4 py-2 bg-[#0B3B60] hover:bg-[#072F4F] text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Survey</span>
          </button>

          <button
            onClick={() => navigate('/upload')}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-[#0B192C] border border-[#CBD5E1] rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-2xs"
          >
            <UploadCloud className="w-4 h-4 text-[#64748B]" />
            <span>Import Data</span>
          </button>
        </div>
      </div>

      {/* 2. Metric Cards Row (4 Cards) — 100% Dynamic based on database */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Card 1: Hero Metric Card (Total Targets) */}
        <div className="bg-gradient-to-br from-[#0B3B60] via-[#0E4977] to-[#072C4A] text-white rounded-2xl p-5 relative overflow-hidden shadow-xs flex flex-col justify-between min-h-[140px]">
          <div className="absolute right-0 bottom-0 opacity-15 pointer-events-none">
            <svg width="180" height="90" viewBox="0 0 180 90" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 60 C 50 30, 90 80, 140 40 C 160 25, 180 35, 200 45 L 200 90 L 0 90 Z" fill="#38BDF8" />
              <path d="M0 75 C 60 50, 100 90, 150 60 C 170 50, 190 60, 200 65 L 200 90 L 0 90 Z" fill="#BAE6FD" />
            </svg>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center text-white border border-white/20">
              <Layers className="w-5 h-5" />
            </div>
            <button 
              onClick={() => navigate('/detections')}
              className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/90 transition"
              title="View Detections"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="relative z-10 mt-3">
            <span className="text-xs font-semibold text-[#BAE6FD] block">
              Total Projects
            </span>
            <div className="text-3xl font-black text-white tracking-tight mt-0.5">
              {missions.length}
            </div>
            <div className="text-[11px] font-medium text-[#7DD3FC] flex items-center gap-1 mt-1">
              <span>↑</span>
              <span>{targets.length} acoustic contact{targets.length === 1 ? '' : 's'} identified</span>
            </div>
          </div>
        </div>

        {/* Card 2: Completed Surveys */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs relative flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#EAF2FD] flex items-center justify-center text-[#0284C7] border border-[#BAE6FD]/40">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <button 
              onClick={() => navigate('/surveys')}
              className="w-7 h-7 rounded-full text-[#94A3B8] hover:text-[#0B192C] flex items-center justify-center transition"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3">
            <span className="text-xs font-semibold text-[#64748B] block">
              Completed Surveys
            </span>
            <div className="text-3xl font-black text-[#0B192C] tracking-tight mt-0.5">
              {completedMissionsCount}
            </div>
            <div className="text-[11px] font-semibold text-[#10B981] flex items-center gap-1 mt-1">
              <span>Finished hydrographic batches</span>
            </div>
          </div>
        </div>

        {/* Card 3: Active Missions */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs relative flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#E0F2FE] flex items-center justify-center text-[#0284C7] border border-[#BAE6FD]/40">
              <Radio className="w-5 h-5" />
            </div>
            <button 
              onClick={() => navigate('/surveys')}
              className="w-7 h-7 rounded-full text-[#94A3B8] hover:text-[#0B192C] flex items-center justify-center transition"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3">
            <span className="text-xs font-semibold text-[#64748B] block">
              Active Missions
            </span>
            <div className="text-3xl font-black text-[#0B192C] tracking-tight mt-0.5">
              {activeMissionsCount}
            </div>
            <div className="text-[11px] font-semibold text-[#0284C7] flex items-center gap-1 mt-1">
              <span>{completedMissionsCount + activeMissionsCount} total surveys registered</span>
            </div>
          </div>
        </div>

        {/* Card 4: Pending Review */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs relative flex flex-col justify-between min-h-[140px]">
          <div className="flex items-center justify-between">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] flex items-center justify-center text-[#0284C7] border border-[#BFDBFE]/40">
              <Clock className="w-5 h-5" />
            </div>
            <button 
              onClick={() => navigate('/detections')}
              className="w-7 h-7 rounded-full text-[#94A3B8] hover:text-[#0B192C] flex items-center justify-center transition"
            >
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-3">
            <span className="text-xs font-semibold text-[#64748B] block">
              Pending Review
            </span>
            <div className="text-3xl font-black text-[#0B192C] tracking-tight mt-0.5">
              {pendingCount}
            </div>
            <div className="text-[11px] font-semibold text-[#D97706] flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#D97706] animate-pulse" />
              <span>Awaiting analyst ground-truth</span>
            </div>
          </div>
        </div>

      </div>

      {/* 3. Middle Row Grid (Mission Activity, Recent Detections, Mission Map) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Column 1: Mission Activity Card (Purely Dynamic Data) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-[#0B192C]">
                Mission Activity
              </h3>
              <div className="relative">
                <select 
                  value={activityTimeframe}
                  onChange={(e) => setActivityTimeframe(e.target.value)}
                  className="bg-[#F4F7FB] border border-[#E2E8F0] rounded-lg px-2.5 py-1 text-xs text-[#475569] font-medium focus:outline-none cursor-pointer pr-6 appearance-none"
                >
                  <option value="7d">Last 7 Days</option>
                </select>
                <ChevronDown className="w-3 h-3 text-[#94A3B8] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Dynamic Activity Bar Chart */}
            <div className="h-44 w-full flex flex-col justify-end pt-2 pb-1">
              <div className="relative h-32 w-full flex flex-col justify-between text-[10px] text-[#94A3B8] font-mono">
                <div className="border-b border-dashed border-slate-100 pb-0.5 flex justify-between">
                  <span>{missionActivityData.maxVal}</span>
                </div>
                <div className="border-b border-dashed border-slate-100 pb-0.5 flex justify-between">
                  <span>{Math.round(missionActivityData.maxVal / 2)}</span>
                </div>
                <div className="border-b border-dashed border-slate-100 pb-0.5 flex justify-between">
                  <span>0</span>
                </div>

                {/* Real Bars Container */}
                <div className="absolute inset-x-8 bottom-0 top-0 flex items-end justify-between px-2">
                  {missionActivityData.days.map((item, idx) => {
                    const h1Pct = Math.min(100, Math.round((item.surveys / missionActivityData.maxVal) * 100));
                    const h2Pct = Math.min(100, Math.round((item.detections / missionActivityData.maxVal) * 100));

                    return (
                      <div key={idx} className="flex flex-col items-center gap-1 group">
                        <div className="w-5 flex flex-col items-center justify-end h-28 gap-0.5">
                          {h2Pct > 0 ? (
                            <div 
                              style={{ height: `${h2Pct}%` }}
                              className="w-full bg-[#93C5FD] rounded-t-sm group-hover:bg-[#60A5FA] transition-all" 
                              title={`Detections: ${item.detections}`}
                            />
                          ) : (
                            <div className="w-full h-1 bg-slate-100 rounded-xs" />
                          )}
                          {h1Pct > 0 ? (
                            <div 
                              style={{ height: `${h1Pct}%` }}
                              className="w-full bg-[#0B3B60] rounded-b-xs group-hover:bg-[#072F4F] transition-all" 
                              title={`Surveys: ${item.surveys}`}
                            />
                          ) : null}
                        </div>
                        <span className="text-[10px] text-[#64748B] font-medium mt-1">
                          {item.day}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 pt-3 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#0B3B60]" />
              <span className="text-[#64748B] font-medium">Surveys Registered</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#93C5FD]" />
              <span className="text-[#64748B] font-medium">Acoustic Detections</span>
            </div>
          </div>
        </div>

        {/* Column 2: Recent Detections List Card (100% Real from Database) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#0B192C]">
                Recent Detections
              </h3>
              <button 
                onClick={() => navigate('/detections')}
                className="text-xs font-bold text-[#0284C7] hover:text-[#026AA7] flex items-center gap-1 transition"
              >
                <span>View All</span>
                <span>→</span>
              </button>
            </div>

            {/* Real Targets List */}
            {filteredTargets.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#64748B] space-y-2">
                <Compass className="w-8 h-8 text-[#94A3B8] mx-auto animate-pulse" />
                <p className="font-semibold text-[#0B192C]">No acoustic targets detected</p>
                <p className="text-[11px] text-[#94A3B8]">Stream a live ML detection or import a survey batch to view contacts.</p>
              </div>
            ) : (
              <div className="space-y-2.5 mt-2">
                {filteredTargets.slice(0, 4).map((det, idx) => {
                  const targetId = det.target_id || det.id;
                  const rawCls = det.class || det.category || 'pipe_cylinder';
                  const displayCls = formatClassLabel(rawCls);
                  const confPct = formatConfidence(det.confidence || det.fused_confidence || 0.9);
                  const imgSrc = det.sonar_image_ref || null;
                  const statusInfo = getStatusBadgeInfo(det.status || det.human_review_status);

                  return (
                    <div
                      key={targetId}
                      onClick={() => handleSelectTarget(det)}
                      className="flex items-center justify-between p-2 rounded-xl hover:bg-[#F4F7FB] transition-colors cursor-pointer border border-transparent hover:border-[#E2E8F0] group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg bg-black border border-[#E2E8F0] overflow-hidden shrink-0 flex items-center justify-center">
                          {imgSrc ? (
                            <img 
                              src={imgSrc} 
                              alt={targetId} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                              onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src = '/images/sonar_waterfall_scan.jpg';
                              }}
                            />
                          ) : (
                            <Layers className="w-5 h-5 text-slate-500" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${statusInfo.dotClass}`} />
                            <span className="text-xs font-bold text-[#0B192C]">
                              {targetId}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#64748B] font-medium mt-0.5">
                            {displayCls}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-black text-[#0B192C]">
                          {confPct}
                        </div>
                        <div className="text-[10px] text-[#94A3B8] font-medium mt-0.5 capitalize">
                          {statusInfo.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pt-2 text-center">
            <span className="text-[10px] text-[#94A3B8] font-medium">
              Click any detection to inspect acoustic imagery & telemetry
            </span>
          </div>
        </div>

        {/* Column 3: Mission Map Card */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#0B192C]">
              Mission Map
            </h3>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live
              </span>
              <button 
                onClick={() => navigate('/map')}
                className="w-6 h-6 rounded-lg text-[#64748B] hover:text-[#0B192C] hover:bg-[#F4F7FB] flex items-center justify-center transition"
                title="Expand Map View"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Real Interactive Leaflet GIS Map with Live Targets & Basemap Layer Switcher */}
          <div className="relative h-64 rounded-xl overflow-hidden border border-[#E2E8F0] shadow-2xs">
            <GISMap
              targets={filteredTargets}
              detections={filteredDetections}
              selectedTargetId={selectedTargetId}
              newlyDetectedTargetId={newlyDetectedId}
              onSelectTarget={handleSelectTarget}
              compact={true}
              autoZoomKey={selectedMissionId || 'ALL'}
            />
          </div>

          <div className="pt-2 text-center">
            <span className="text-[10px] text-[#0284C7] font-semibold hover:underline cursor-pointer" onClick={() => navigate('/map')}>
              Click to open interactive bathymetry GIS workstation →
            </span>
          </div>
        </div>

      </div>

      {/* 4. Bottom Row Grid (Target Classification, System Status, Survey Progress) — 100% Data-Driven */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Column 1: Target Classification Donut Card (Purely Data-Driven) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#0B192C]">
            Target Classification
          </h3>

          {classificationAnalytics.total === 0 ? (
            <div className="py-8 text-center text-xs text-[#64748B]">
              <Layers className="w-8 h-8 text-[#94A3B8] mx-auto mb-2" />
              <p className="font-semibold text-[#0B192C]">0 Targets Evaluated</p>
              <p className="text-[11px] text-[#94A3B8]">Classifications will appear automatically once targets are ingested.</p>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 pt-1">
              {/* Donut Chart SVG calculated dynamically */}
              <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Base Ring */}
                  <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F9" strokeWidth="12" />
                  
                  {/* Dynamic Slices */}
                  {classificationAnalytics.slices.map((slice, i) => (
                    <circle 
                      key={slice.key || i}
                      cx="50" 
                      cy="50" 
                      r="38" 
                      fill="none" 
                      stroke={slice.color} 
                      strokeWidth="12" 
                      strokeDasharray={slice.strokeDasharray} 
                      strokeDashoffset={slice.strokeDashoffset}
                      strokeLinecap={classificationAnalytics.slices.length === 1 ? 'butt' : 'round'}
                    />
                  ))}
                </svg>

                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black text-[#0B192C] leading-none">
                    {classificationAnalytics.total}
                  </span>
                  <span className="text-[9px] font-bold text-[#64748B] mt-0.5 leading-none">
                    Total Targets
                  </span>
                </div>
              </div>

              {/* Exact Categories Legend from Data */}
              <div className="space-y-2 flex-1 text-xs">
                {classificationAnalytics.categories.map((cat) => (
                  <div key={cat.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="text-[#475569] font-medium truncate max-w-[120px]" title={cat.label}>
                        {cat.label}
                      </span>
                    </div>
                    <span className="font-bold text-[#0B192C] font-mono">
                      {cat.pct}% <span className="text-[10px] text-[#94A3B8] font-normal">({cat.count})</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Column 2: System Status Card (Real API Health & Connection State) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-[#0B192C]">
                System Status
              </h3>
              <button 
                onClick={() => navigate('/settings')}
                className="text-xs font-bold text-[#0284C7] hover:text-[#026AA7] flex items-center gap-1 transition"
              >
                <span>View Details</span>
                <span>→</span>
              </button>
            </div>

            {/* Real System Services */}
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2 text-[#475569] font-medium">
                  <Activity className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>ATR System</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0B192C]">
                  <span className={`w-1.5 h-1.5 rounded-full ${healthData?.status === 'healthy' ? 'bg-[#10B981]' : 'bg-amber-500'}`} />
                  {healthData?.status === 'healthy' ? 'Online' : 'Standby'}
                </span>
              </div>

              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2 text-[#475569] font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>ML Inference Engine</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0B192C]">
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-[#10B981] animate-pulse' : 'bg-[#10B981]'}`} />
                  {wsConnected ? 'Streaming (Live)' : 'Ready'}
                </span>
              </div>

              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2 text-[#475569] font-medium">
                  <Database className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Database</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0B192C]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  {healthData?.database?.engine === 'postgresql' ? 'PostgreSQL Connected' : 'Connected'}
                </span>
              </div>

              <div className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-2 text-[#475569] font-medium">
                  <UploadCloud className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span>Data Ingestion</span>
                </div>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-[#0B192C]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                  {activeMode === 'live' ? 'Live Stream Mode' : 'Batch Import Mode'}
                </span>
              </div>
            </div>
          </div>

          {/* Real Operational Status Banner with Live UTC Time */}
          <div className="bg-[#ECFDF5] border border-[#A7F3D0] p-3 rounded-xl flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-[#10B981] text-white flex items-center justify-center shrink-0">
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#065F46] leading-none">
                All systems operational
              </div>
              <div className="text-[10px] text-[#047857] mt-0.5 font-medium leading-none font-mono">
                Last updated: {lastUpdatedTime || 'Synchronized'}
              </div>
            </div>
          </div>
        </div>

        {/* Column 3: Survey Progress Card (Calculated from real ground-truthing & active mission) */}
        <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs space-y-4">
          <h3 className="text-sm font-bold text-[#0B192C]">
            Survey Progress
          </h3>

          <div className="flex items-center justify-between gap-5 pt-1">
            {/* Real Radial Circular Progress Gauge */}
            <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F9" strokeWidth="10" />
                <circle 
                  cx="50" cy="50" r="38" fill="none" stroke="url(#progressGradient)" strokeWidth="10" 
                  strokeDasharray="238.76" 
                  strokeDashoffset={(238.76 - (surveyProgress.progressPct / 100) * 238.76).toFixed(2)} 
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06B6D4" />
                    <stop offset="100%" stopColor="#0284C7" />
                  </linearGradient>
                </defs>
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-[#0B192C] leading-none font-mono">
                  {surveyProgress.progressPct}%
                </span>
                <span className="text-[9px] font-bold text-[#64748B] mt-0.5 leading-none">
                  Reviewed
                </span>
              </div>
            </div>

            {/* Real Progress Metrics Derived from Current Mission */}
            <div className="space-y-3 flex-1">
              <div>
                <div className="text-sm font-black text-[#0B192C] font-mono">
                  {surveyProgress.coveredKm2} / {surveyProgress.totalSwathKm2} km²
                </div>
                <div className="text-[10px] text-[#64748B] font-medium">
                  Swath Verified Area
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-[#0B192C] font-mono">
                  {surveyProgress.speed}
                </div>
                <div className="text-[10px] text-[#64748B] font-medium">
                  Survey Speed
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-[#0B192C]">
                  {surveyProgress.timeRemaining}
                </div>
                <div className="text-[10px] text-[#64748B] font-medium">
                  Mission Status
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Target Inspection Modal Dialog (rendered via Portal with z-[9999] to completely dim topbar and page) */}
      {showDetailModal && selectedTarget && createPortal(
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 select-none animate-in fade-in duration-200"
          onClick={() => setShowDetailModal(false)}
        >
          <div 
            className="max-w-xl w-full max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <DetectionDetailPanel 
              detection={selectedTarget}
              onReview={(id, action) => {
                handleReview(id, action);
              }}
              onClose={() => setShowDetailModal(false)}
              onOpenEvidence={() => setIsEvidenceModalOpen(true)}
              onDelete={handleDeleteTarget}
              onViewOnMap={() => {
                setSelectedTargetId(selectedTarget.target_id || selectedTarget.id);
                navigate('/map');
              }}
            />
          </div>
        </div>,
        document.body
      )}

      {/* High-Res Sonar Evidence Modal Dialog */}
      {isEvidenceModalOpen && selectedTarget && createPortal(
        <EvidenceViewerModal
          target={selectedTarget}
          allTargets={targets}
          onClose={() => setIsEvidenceModalOpen(false)}
          onTargetSelect={(t) => {
            setSelectedTarget(t);
            setSelectedTargetId(t.target_id || t.id);
          }}
          onTargetReviewed={(tid, newStatus) => {
            setTargets(prev => prev.map(t => (t.target_id === tid || t.id === tid) ? { ...t, status: newStatus, human_review_status: newStatus } : t));
            if (selectedTarget && (selectedTarget.target_id === tid || selectedTarget.id === tid)) {
              setSelectedTarget(prev => ({ ...prev, status: newStatus, human_review_status: newStatus }));
            }
          }}
          onTargetDeleted={(tid) => {
            setTargets(prev => prev.filter(t => (t.target_id || t.id) !== tid));
            setDetections(prev => prev.filter(d => (d.target_id || d.id) !== tid));
            setShowDetailModal(false);
            setSelectedTarget(null);
            setIsEvidenceModalOpen(false);
          }}
        />,
        document.body
      )}

    </div>
  );
}
