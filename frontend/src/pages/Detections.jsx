import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Target, CheckCircle2, XCircle, RefreshCw, 
  Search, LayoutGrid, Table as TableIcon, Filter, 
  Layers, Trash2, RotateCcw, AlertTriangle, MapPin, X
} from 'lucide-react';
import detectionService from '../services/detectionService';
import targetService from '../services/targetService';
import DetectionDetailPanel from '../components/DetectionDetailPanel';
import EvidenceViewerModal from '../components/EvidenceViewerModal';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMission } from '../context/MissionContext';
import { 
  formatConfidence, 
  formatClassLabel, 
  formatSize, 
  formatTimestamp, 
  getStatusBadgeInfo,
  normalizeStatus
} from '../utils/formatters';

export default function Detections() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { 
    missions, 
    selectedMissionId, 
    setSelectedMissionId, 
    selectedTargetId, 
    setSelectedTargetId,
    targets,
    detections,
    setTargets,
    setDetections,
    isInitialLoading,
    isRefreshing,
    refreshData,
    reviewTarget,
    deleteTarget
  } = useMission();

  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [error, setError] = useState(null);

  // Search & Filter States (Default missionFilter to ALL so all targets are visible by default!)
  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [missionFilter, setMissionFilter] = useState('ALL');
  const [shadowFilter, setShadowFilter] = useState('ALL'); // 'ALL' | 'VERIFIED' | 'UNVERIFIED'
  const [minConfidence, setMinConfidence] = useState(0.0);
  const [sortBy, setSortBy] = useState('confidence_desc');

  // Selected Target for Detailed Inspection View
  const [selectedItem, setSelectedItem] = useState(null);
  const [isEvidenceModalOpen, setIsEvidenceModalOpen] = useState(false);
  const [recentNewId, setRecentNewId] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteToast, setDeleteToast] = useState(null);
  const initialSelectionDoneRef = useRef(false);

  // Real-Time WebSocket Live Feed Integration
  const { data: wsData } = useWebSocket('/ws/live-feed');

  // Silent background revalidation on page mount (0ms delay, instant render)
  useEffect(() => {
    refreshData({ silent: true });
  }, [refreshData]);

  // Keep selected item synchronized with live cached targets
  useEffect(() => {
    if (targets.length > 0) {
      if (!initialSelectionDoneRef.current) {
        setSelectedItem(targets[0]);
        setSelectedTargetId(targets[0].target_id || targets[0].id);
        initialSelectionDoneRef.current = true;
      } else {
        setSelectedItem(prev => {
          if (!prev) return null;
          const match = targets.find(t => (t.target_id || t.id) === (prev.target_id || prev.id));
          return match || null;
        });
      }
    } else {
      setSelectedItem(null);
    }
  }, [targets, setSelectedTargetId]);

  // Synchronize URL query parameters (e.g. from global Topbar search)
  useEffect(() => {
    const qParam = searchParams.get('q');
    if (qParam !== null && qParam !== undefined) {
      setSearchQuery(qParam);
      setMissionFilter('ALL');
    }
  }, [searchParams]);

  useEffect(() => {
    const selectedParam = searchParams.get('selected');
    if (selectedParam && targets.length > 0) {
      const match = targets.find(t => (t.target_id || t.id) === selectedParam);
      if (match) {
        setSelectedItem(match);
      }
    }
  }, [searchParams, targets]);

  // Handle incoming WebSocket events for local UI effects
  useEffect(() => {
    if (!wsData) return;

    if (wsData.type === 'NEW_DETECTION' && wsData.data) {
      const targetId = wsData.data.target_id || wsData.data.id;
      setRecentNewId(targetId);
      const timer = setTimeout(() => {
        setRecentNewId(null);
      }, 7000);
      return () => clearTimeout(timer);
    }

    if (wsData.type === 'TARGET_DELETED' && wsData.data) {
      const deletedId = wsData.data.target_id || wsData.data.id;
      setSelectedItem(prev => (prev && (prev.target_id === deletedId || prev.id === deletedId)) ? null : prev);
    }
  }, [wsData]);

  // Execute analyst review action with INSTANT optimistic update across the entire app
  const handleReviewAction = async (targetId, action, e) => {
    if (e) e.stopPropagation();
    try {
      await reviewTarget(targetId, action);
      // Dismiss the detail panel when review action takes place
      setSelectedItem(prev => (prev && (prev.target_id === targetId || prev.id === targetId)) ? null : prev);
    } catch (err) {
      console.error('Review action failed:', err);
    }
  };

  // Handle delete target with confirmation modal
  const handleDeleteClick = (target, e) => {
    if (e) e.stopPropagation();
    setDeleteConfirmTarget(target);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmTarget) return;
    const targetId = deleteConfirmTarget.target_id || deleteConfirmTarget.id;
    setDeleteLoading(true);

    try {
      await deleteTarget(targetId);
      setDeleteToast(`Target '${targetId}' was successfully deleted from database.`);
      setTimeout(() => setDeleteToast(null), 4000);
    } catch (err) {
      console.error('Delete target failed:', err);
      setError(`Failed to delete target: ${err.response?.data?.detail || err.message || 'Server error'}`);
    } finally {
      setDeleteLoading(false);
      setDeleteConfirmTarget(null);
    }
  };

  // Reset active filters
  const resetFilters = () => {
    setSearchQuery('');
    setClassFilter('ALL');
    setStatusFilter('ALL');
    setMissionFilter('ALL');
    setShadowFilter('ALL');
    setMinConfidence(0.0);
    setSortBy('confidence_desc');
  };

  // Filtered and Sorted Targets
  const processedTargets = useMemo(() => {
    return targets
      .filter(t => {
        const tid = (t.target_id || t.id || '').toLowerCase();
        const rawCls = (t.class || t.category || '').toLowerCase();
        const formattedLabel = formatClassLabel(rawCls).toLowerCase();
        const label = (t.label || '').toLowerCase();
        const missionId = (t.mission_id || '').toLowerCase();
        const status = (t.status || t.human_review_status || '').toLowerCase();
        const q = searchQuery.toLowerCase().trim();

        // 1. Search Query Filter - matches target ID, class, label, mission, or status
        if (q) {
          const matches = (
            tid.includes(q) || 
            rawCls.includes(q) || 
            formattedLabel.includes(q) || 
            label.includes(q) || 
            missionId.includes(q) || 
            status.includes(q)
          );
          if (!matches) {
            return false;
          }
        }

        // 2. Class Filter
        if (classFilter !== 'ALL') {
          if (rawCls !== classFilter.toLowerCase() && !rawCls.includes(classFilter.toLowerCase())) {
            return false;
          }
        }

        // 3. Status Filter
        if (statusFilter !== 'ALL') {
          const normStatus = normalizeStatus(t.status || t.human_review_status);
          if (normStatus !== statusFilter) {
            return false;
          }
        }

        // 4. Mission Filter (ALL shows all targets across all missions)
        if (missionFilter !== 'ALL' && t.mission_id !== missionFilter) {
          // If the search query explicitly matches this target, don't let missionFilter hide it
          if (!q || (!tid.includes(q) && !label.includes(q))) {
            return false;
          }
        }

        // 5. Shadow Verification Filter
        if (shadowFilter !== 'ALL') {
          const shadowVerified = Boolean(t.shadow_verified ?? t.observations?.[0]?.shadow_verified ?? false);
          if (shadowFilter === 'VERIFIED' && !shadowVerified) return false;
          if (shadowFilter === 'UNVERIFIED' && shadowVerified) return false;
        }

        // 6. Minimum Confidence Filter
        const conf = Number(t.fused_confidence ?? t.confidence ?? 0);
        if (conf < minConfidence) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const confA = Number(a.fused_confidence ?? a.confidence ?? 0);
        const confB = Number(b.fused_confidence ?? b.confidence ?? 0);
        const sizeA = Number(a.estimated_size_m ?? 0);
        const sizeB = Number(b.estimated_size_m ?? 0);

        if (sortBy === 'confidence_desc') return confB - confA;
        if (sortBy === 'confidence_asc') return confA - confB;
        if (sortBy === 'size_desc') return sizeB - sizeA;
        if (sortBy === 'size_asc') return sizeA - sizeB;
        return 0;
      });
  }, [targets, searchQuery, classFilter, statusFilter, missionFilter, shadowFilter, minConfidence, sortBy]);

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto w-full font-sans bg-[#F4F7FB] text-[#0B192C] min-h-screen">
      
      {/* 1. Header & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-2xs border border-[#E5EDF5]">
        <div>
          <h2 className="text-xl font-black text-[#0B192C] tracking-tight">
            Acoustic Detections
          </h2>
          <p className="text-xs text-[#64748B] mt-0.5">
            Review and ground-truth detected targets and acoustic anomalies. Showing {processedTargets.length} target{processedTargets.length === 1 ? '' : 's'}{processedTargets.length !== targets.length ? ` (filtered from ${targets.length} total)` : ''}.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#F4F7FB] p-1 rounded-xl border border-[#E2E8F0]">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'table' ? 'bg-white text-[#0B192C] shadow-2xs font-bold' : 'text-[#64748B] hover:text-[#0B192C]'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" /> Table View
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                viewMode === 'cards' ? 'bg-white text-[#0B192C] shadow-2xs font-bold' : 'text-[#64748B] hover:text-[#0B192C]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Cards View
            </button>
          </div>

          {/* Quick Refresh Button */}
          <button
            onClick={() => refreshData({ silent: true })}
            disabled={isRefreshing}
            className="p-2 rounded-xl border border-[#E2E8F0] bg-[#F4F7FB] hover:bg-white text-[#64748B] hover:text-[#0284C7] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Sync latest targets from PostgreSQL"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#0284C7] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Bar */}
      <div className="bg-white rounded-2xl p-5 border border-[#E5EDF5] shadow-2xs grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 text-xs font-sans">
        {/* Search */}
        <div>
          <label className="block text-[10px] text-[#64748B] font-bold uppercase mb-1">SEARCH TARGETS</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ID, class, status..."
              className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-[#0B192C] placeholder-[#94A3B8] text-xs pl-8 pr-7 py-1.5 rounded-xl focus:outline-none focus:border-[#0284C7] focus:bg-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Mission Filter (Defaults to ALL so nothing is hidden!) */}
        <div>
          <label className="block text-[10px] text-[#64748B] font-bold uppercase mb-1">SURVEY MISSION</label>
          <select
            value={missionFilter}
            onChange={(e) => {
              setMissionFilter(e.target.value);
            }}
            className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-[#0B192C] font-semibold px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-[#0284C7]"
          >
            <option value="ALL">ALL MISSIONS ({targets.length} targets)</option>
            {(missions || []).map(m => (
              <option key={m.mission_id} value={m.mission_id}>
                {m.mission_id}: {m.survey_name}
              </option>
            ))}
          </select>
        </div>

        {/* Class Filter */}
        <div>
          <label className="block text-[10px] text-[#64748B] font-bold uppercase mb-1">CLASS CATEGORY</label>
          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-[#0B192C] font-semibold px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-[#0284C7]"
          >
            <option value="ALL">ALL CLASSES</option>
            <option value="debris_net">DEBRIS NET</option>
            <option value="pipe_cylinder">PIPELINE / CYLINDER</option>
            <option value="wreck_structure">WRECK STRUCTURE</option>
            <option value="cargo_container">CARGO CONTAINER</option>
            <option value="naval_mine">ACOUSTIC MINE</option>
            <option value="pipe_joint">PIPE JOINT</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-[10px] text-[#64748B] font-bold uppercase mb-1">REVIEW STATUS</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-[#0B192C] font-semibold px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-[#0284C7]"
          >
            <option value="ALL">ALL STATUSES</option>
            <option value="pending_review">PENDING</option>
            <option value="confirmed">CONFIRMED</option>
            <option value="rejected">REJECTED</option>
          </select>
        </div>

        {/* Shadow Verified Filter */}
        <div>
          <label className="block text-[10px] text-[#64748B] font-bold uppercase mb-1">SHADOW VERIFIED</label>
          <select
            value={shadowFilter}
            onChange={(e) => setShadowFilter(e.target.value)}
            className="w-full bg-[#F4F7FB] border border-[#E2E8F0] text-[#0B192C] font-semibold px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-[#0284C7]"
          >
            <option value="ALL">ALL SHADOWS</option>
            <option value="VERIFIED">SHADOW VERIFIED</option>
            <option value="UNVERIFIED">UNVERIFIED</option>
          </select>
        </div>

        {/* Min Confidence Slider */}
        <div>
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-[#64748B] mb-1">
            <span>MIN CONFIDENCE</span>
            <span className="font-mono text-[#0284C7]">{Math.round(minConfidence * 100)}%</span>
          </div>
          <input
            type="range"
            min="0.0"
            max="1.0"
            step="0.05"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0284C7]"
          />
        </div>
      </div>

      {/* 3. Main Workspace: Detections Table / Cards (Left) + Detail Panel (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Targets Content Area (8 Cols) */}
        <div className={selectedItem ? "lg:col-span-8 space-y-4" : "lg:col-span-12 space-y-4"}>
          
          {(isInitialLoading && targets.length === 0) ? (
            <div className="bg-white rounded-2xl p-12 border border-[#E5EDF5] shadow-2xs text-center space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin text-[#0284C7] mx-auto" />
              <span className="text-xs font-mono text-[#64748B] block">Querying hydrographic target repository...</span>
            </div>
          ) : processedTargets.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 border border-[#E5EDF5] shadow-2xs text-center space-y-3">
              <Target className="w-10 h-10 mx-auto text-[#94A3B8]" />
              {targets.length > 0 ? (
                <div className="space-y-2">
                  <span className="font-bold text-[#0B192C] block text-sm">No targets match the active filters</span>
                  <span className="text-xs text-[#64748B] block">
                    {missionFilter !== 'ALL' ? `Filtered by survey mission "${missionFilter}". ` : ''}
                    There are {targets.length} target{targets.length > 1 ? 's' : ''} recorded in the repository.
                  </span>
                  <button
                    onClick={resetFilters}
                    className="mt-2 px-4 py-2 bg-[#0B3B60] hover:bg-[#072F4F] text-white font-bold rounded-xl text-xs transition inline-flex items-center gap-1.5 shadow-xs"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    Reset Filters & Show All Targets ({targets.length})
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <span className="font-bold text-[#0B192C] block text-sm">No targets in database</span>
                  <span className="text-xs text-[#64748B] block">Awaiting original sonar detection ingestion via API (POST /api/detections).</span>
                </div>
              )}
            </div>
          ) : viewMode === 'table' ? (
            /* COMPLETE DETECTION TABLE */
            <div className="bg-white rounded-2xl border border-[#E5EDF5] overflow-hidden shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#F4F7FB] border-b border-[#E5EDF5] text-[#64748B] text-[10px] uppercase font-bold">
                      <th className="p-3.5">TARGET ID</th>
                      <th className="p-3.5">SONAR IMAGE</th>
                      <th className="p-3.5">CLASSIFICATION</th>
                      <th className="p-3.5">CONFIDENCE</th>
                      <th className="p-3.5">SIZE</th>
                      <th className="p-3.5">LATITUDE</th>
                      <th className="p-3.5">LONGITUDE</th>
                      <th className="p-3.5">SHADOW</th>
                      <th className="p-3.5">STATUS</th>
                      <th className="p-3.5">TIMESTAMP</th>
                      <th className="p-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EDF5] text-[11px] font-mono">
                    {processedTargets.map((tgt) => {
                      const targetId = tgt.target_id || tgt.id;
                      const isSelected = (selectedItem?.target_id || selectedItem?.id) === targetId;
                      const classLabel = formatClassLabel(tgt.class || tgt.category);
                      const confFormatted = formatConfidence(tgt.fused_confidence ?? tgt.confidence);
                      const sizeFormatted = formatSize(tgt.estimated_size_m || 3.0);
                      const statusInfo = getStatusBadgeInfo(tgt.status || tgt.human_review_status);
                      const imageSrc = tgt.sonar_image_ref || null;
                      const timestampStr = formatTimestamp(tgt.timestamp || tgt.observations?.[0]?.timestamp);
                      const shadowVerified = Boolean(tgt.shadow_verified ?? tgt.observations?.[0]?.shadow_verified ?? false);

                      return (
                        <tr
                          key={targetId}
                          onClick={() => {
                            setSelectedItem(tgt);
                            setSelectedTargetId(targetId);
                          }}
                          className={`cursor-pointer transition select-none ${
                            isSelected 
                              ? 'bg-[#EAF2FD] text-[#0B192C] border-l-4 border-l-[#0284C7]' 
                              : 'hover:bg-[#F4F7FB] text-[#475569]'
                          }`}
                        >
                          <td className="p-3.5 font-black text-[#0B192C] whitespace-nowrap">
                            {targetId}
                            {recentNewId === targetId && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1 inline-block" />
                            )}
                          </td>
                          <td className="p-3.5">
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(tgt);
                                setSelectedTargetId(targetId);
                                setIsEvidenceModalOpen(true);
                              }}
                              className="w-10 h-10 rounded-lg bg-black border border-[#E2E8F0] overflow-hidden flex items-center justify-center hover:scale-110 transition-transform cursor-pointer shadow-2xs"
                              title="Click to open Full Sonar Evidence Viewer"
                            >
                              {imageSrc ? (
                                <img
                                  src={imageSrc}
                                  alt={targetId}
                                  className="w-full h-full object-cover"
                                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                              ) : (
                                <Layers className="w-4 h-4 text-slate-500" />
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 font-sans font-bold text-[#0B192C] whitespace-nowrap">
                            {classLabel}
                          </td>
                          <td className="p-3.5 font-bold text-[#10B981]">
                            {confFormatted}
                          </td>
                          <td className="p-3.5 text-[#64748B]">
                            {sizeFormatted}
                          </td>
                          <td className="p-3.5 text-[#64748B]">
                            {Number(tgt.latitude || 0).toFixed(4)}°
                          </td>
                          <td className="p-3.5 text-[#64748B]">
                            {Number(tgt.longitude || 0).toFixed(4)}°
                          </td>
                          <td className="p-3.5">
                            {shadowVerified ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-[#10B981] border border-emerald-200">
                                YES
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-[#D97706] border border-amber-200">
                                NO
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border flex items-center gap-1.5 w-fit ${statusInfo.bgClass} ${statusInfo.borderClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="p-3.5 text-[#94A3B8] text-[10px] whitespace-nowrap">
                            {timestampStr}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => handleReviewAction(targetId, 'confirm', e)}
                                title="Ground-Truth Confirm Target"
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  tgt.status === 'confirmed' 
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-[#10B981] border-emerald-200'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleReviewAction(targetId, 'reject', e)}
                                title="Reject False Positive"
                                className={`p-1.5 rounded-lg border transition cursor-pointer ${
                                  tgt.status === 'rejected' 
                                    ? 'bg-red-100 text-red-800 border-red-300' 
                                    : 'bg-red-50 hover:bg-red-100 text-[#EF4444] border-red-200'
                                }`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteClick(tgt, e)}
                                title="Delete Detection from Database"
                                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-300 text-slate-400 hover:text-red-600 transition shadow-2xs group cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* CARDS GRID VIEW */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {processedTargets.map((tgt) => {
                const targetId = tgt.target_id || tgt.id;
                const isSelected = (selectedItem?.target_id || selectedItem?.id) === targetId;
                const classLabel = formatClassLabel(tgt.class || tgt.category);
                const confFormatted = formatConfidence(tgt.fused_confidence ?? tgt.confidence);
                const statusInfo = getStatusBadgeInfo(tgt.status || tgt.human_review_status);
                const imageSrc = tgt.sonar_image_ref || null;

                return (
                  <div
                    key={targetId}
                    onClick={() => {
                      // Clicking the card or object name opens the side inspection panel
                      setSelectedItem(tgt);
                      setSelectedTargetId(targetId);
                    }}
                    className={`bg-white rounded-2xl p-4 border transition cursor-pointer shadow-2xs relative space-y-3 hover:shadow-md ${
                      isSelected ? 'border-2 border-[#0284C7] ring-2 ring-[#BAE6FD]' : 'border-[#E5EDF5] hover:border-[#CBD5E1]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-[#0B192C] text-sm">{targetId}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase border ${statusInfo.bgClass} ${statusInfo.borderClass}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* MINI IMAGE: Clicking mini image opens the extended modal */}
                    <div 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(tgt);
                        setSelectedTargetId(targetId);
                        setIsEvidenceModalOpen(true);
                      }}
                      className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-[#E2E8F0] flex items-center justify-center relative group hover:border-indigo-400 transition"
                      title="Click mini image to enlarge"
                    >
                      {imageSrc ? (
                        <img src={imageSrc} alt={targetId} className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      ) : (
                        <div className="text-center p-3 text-[#94A3B8] space-y-1">
                          <Layers className="w-6 h-6 mx-auto text-slate-500" />
                          <span className="text-[10px] font-mono block font-bold">NO EVIDENCE IMAGE</span>
                        </div>
                      )}
                      {imageSrc && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[9px] font-mono font-bold opacity-0 group-hover:opacity-100 transition">
                          Enlarge &rarr;
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="font-sans font-bold text-xs text-[#0B192C]">{classLabel}</div>
                      <div className="flex items-center justify-between text-xs font-mono mt-1 text-[#64748B]">
                        <span className="text-[#10B981] font-bold">{confFormatted}</span>
                        <span>{formatSize(tgt.estimated_size_m || 3.0)}</span>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[10px] font-mono text-slate-400">
                        {Number(tgt.latitude || 0).toFixed(3)}°, {Number(tgt.longitude || 0).toFixed(3)}°
                      </div>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleReviewAction(targetId, 'confirm', e)}
                          title="Confirm Ground Truth"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            tgt.status === 'confirmed' 
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                              : 'bg-emerald-50 hover:bg-emerald-100 text-[#10B981] border-emerald-200'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleReviewAction(targetId, 'reject', e)}
                          title="Reject False Positive"
                          className={`p-1.5 rounded-lg border transition cursor-pointer ${
                            tgt.status === 'rejected' 
                              ? 'bg-red-100 text-red-800 border-red-300' 
                              : 'bg-red-50 hover:bg-red-100 text-[#EF4444] border-red-200'
                          }`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteClick(tgt, e)}
                          title="Delete Target"
                          className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-red-50 hover:border-red-300 text-slate-400 hover:text-red-600 transition shadow-2xs group cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Target Inspection Drawer / Right Column */}
        {selectedItem && (
          <div className="lg:col-span-4">
            <div className="sticky top-24">
              <DetectionDetailPanel
                detection={selectedItem}
                onClose={() => setSelectedItem(null)}
                onReview={(tid, act) => handleReviewAction(tid, act)}
                onOpenEvidence={() => setIsEvidenceModalOpen(true)}
                onDelete={() => handleDeleteClick(selectedItem)}
                onViewOnMap={() => {
                  setSelectedTargetId(selectedItem.target_id || selectedItem.id);
                  navigate('/map');
                }}
              />
            </div>
          </div>
        )}

      </div>

      {/* Full Sonar Evidence Viewer Modal */}
      {isEvidenceModalOpen && selectedItem && (
        <EvidenceViewerModal
          target={selectedItem}
          allTargets={targets}
          onClose={() => setIsEvidenceModalOpen(false)}
          onTargetSelect={(t) => {
            setSelectedItem(t);
            setSelectedTargetId(t.target_id || t.id);
          }}
          onTargetReviewed={(tid, newStatus) => {
            setTargets?.(prev => prev.map(t => (t.target_id === tid || t.id === tid) ? { ...t, status: newStatus, human_review_status: newStatus } : t));
            if (selectedItem && (selectedItem.target_id === tid || selectedItem.id === tid)) {
              setSelectedItem(prev => ({ ...prev, status: newStatus, human_review_status: newStatus }));
            }
          }}
          onTargetDeleted={(tid) => {
            setTargets?.(prev => prev.filter(t => (t.target_id || t.id) !== tid));
            setDetections?.(prev => prev.filter(d => (d.target_id || d.id) !== tid));
            if (selectedItem && (selectedItem.target_id === tid || selectedItem.id === tid)) {
              setSelectedItem(null);
            }
            setDeleteToast(`Target '${tid}' was deleted.`);
            setTimeout(() => setDeleteToast(null), 4000);
          }}
        />
      )}

      {/* Premium Delete Confirmation Modal */}
      {deleteConfirmTarget && createPortal(
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 select-none"
          onClick={() => !deleteLoading && setDeleteConfirmTarget(null)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-5 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0 shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200 inline-block">
                  PERMANENT DELETION
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight font-sans">
                  Delete Target Detection?
                </h3>
                <p className="text-xs text-slate-500 font-sans leading-relaxed">
                  Are you sure you want to permanently remove target <strong className="font-mono text-slate-900">{deleteConfirmTarget.target_id || deleteConfirmTarget.id}</strong>? All multi-pass acoustic observations will be erased from PostgreSQL.
                </p>
              </div>
            </div>

            {/* Target Summary Snapshot */}
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 grid grid-cols-2 gap-2 text-xs font-mono">
              <div>
                <span className="text-[10px] font-sans text-slate-400 block font-bold uppercase">Classification</span>
                <span className="font-bold text-slate-800 truncate block">{formatClassLabel(deleteConfirmTarget.class || deleteConfirmTarget.category)}</span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-400 block font-bold uppercase">Confidence</span>
                <span className="font-bold text-emerald-600">{formatConfidence(deleteConfirmTarget.fused_confidence ?? deleteConfirmTarget.confidence)}</span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-400 block font-bold uppercase">Coordinates</span>
                <span className="text-slate-700">{Number(deleteConfirmTarget.latitude || 0).toFixed(4)}°, {Number(deleteConfirmTarget.longitude || 0).toFixed(4)}°</span>
              </div>
              <div>
                <span className="text-[10px] font-sans text-slate-400 block font-bold uppercase">Status</span>
                <span className="font-bold uppercase text-slate-700">{deleteConfirmTarget.status || 'pending_review'}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={deleteLoading}
                onClick={() => setDeleteConfirmTarget(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteLoading}
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-red-500/20 disabled:opacity-50"
              >
                {deleteLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Floating Success Toast */}
      {deleteToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white text-xs font-sans font-bold px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex items-center gap-3 animate-in slide-in-from-bottom-3 duration-200">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{deleteToast}</span>
          <button onClick={() => setDeleteToast(null)} className="text-slate-400 hover:text-white ml-2 cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
