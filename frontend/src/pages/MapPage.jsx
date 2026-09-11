import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map as MapIcon, Compass, RefreshCw, Disc } from 'lucide-react';
import GISMap from '../components/GISMap';
import EvidenceViewerModal from '../components/EvidenceViewerModal';
import targetService from '../services/targetService';
import mapService from '../services/mapService';
import { useWebSocket } from '../hooks/useWebSocket';
import { useMission } from '../context/MissionContext';

export default function MapPage() {
  const navigate = useNavigate();
  const { 
    missions, 
    selectedMissionId, 
    setSelectedMissionId, 
    selectedMission,
    selectedTargetId,
    setSelectedTargetId,
    targets,
    vesselTrack,
    isInitialLoading,
    isRefreshing,
    refreshData,
    reviewTarget,
    deleteTarget
  } = useMission();

  const [selectedTarget, setSelectedTarget] = useState(null);
  const [isEvidenceOpen, setIsEvidenceOpen] = useState(false);
  const [newlyDetectedId, setNewlyDetectedId] = useState(null);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [minConfidence, setMinConfidence] = useState(0.0);

  const { data: wsData } = useWebSocket('/ws/live-feed');

  // Silent background revalidation on page mount (0ms delay, instant render)
  useEffect(() => {
    refreshData({ silent: true });
  }, [refreshData]);

  // Sync selected target from context if changed from another page
  useEffect(() => {
    if (targets.length > 0) {
      const targetToSelect = selectedTargetId || selectedTarget?.target_id || selectedTarget?.id;
      if (targetToSelect) {
        const found = targets.find(t => (t.target_id || t.id) === targetToSelect);
        if (found) setSelectedTarget(found);
      }
    }
  }, [selectedTargetId, targets]);

  // Handle live WebSocket incoming detection results for visual highlight
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

  const handleReview = async (targetId, action) => {
    try {
      await reviewTarget(targetId, action);
    } catch (err) {
      alert(`Failed to update review status: ${err.message}`);
    }
  };

  const handleTargetSelect = (tgt) => {
    setSelectedTarget(tgt);
    if (tgt) {
      setSelectedTargetId(tgt.target_id || tgt.id);
    } else {
      setSelectedTargetId(null);
    }
  };

  const handleOpenEvidence = (tgt) => {
    setSelectedTarget(tgt);
    if (tgt) {
      setSelectedTargetId(tgt.target_id || tgt.id);
      setIsEvidenceOpen(true);
    }
  };

  // Filter targets by selected mission and filters
  const filteredTargets = useMemo(() => {
    return targets.filter(t => {
      // 1. Mission Scope
      if (selectedMissionId !== 'ALL' && t.mission_id && t.mission_id !== selectedMissionId) {
        return false;
      }

      // 2. Category
      const cat = (t.class || t.category || '').toLowerCase();
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'WRECK' && cat !== 'wreck_structure') return false;
        if (categoryFilter === 'PIPELINE' && cat !== 'pipe_cylinder') return false;
        if (categoryFilter === 'DEBRIS' && cat !== 'debris_net') return false;
        if (!['WRECK', 'PIPELINE', 'DEBRIS'].includes(categoryFilter) && cat.toUpperCase() !== categoryFilter) return false;
      }

      // 3. Min Confidence
      const conf = t.fused_confidence ?? t.confidence ?? 0.85;
      if (conf < minConfidence) return false;

      return true;
    });
  }, [targets, selectedMissionId, categoryFilter, minConfidence]);

  const totalObservationsCount = filteredTargets.reduce(
    (sum, t) => sum + (t.observation_count || t.observations?.length || 1),
    0
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden p-6 space-y-4 max-w-7xl mx-auto w-full font-sans bg-[#F8FAFC]">
      
      {/* Top Controls Console Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-4">
        
        {/* Left: Map title & Target count */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <MapIcon className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none">
                GIS Spatial Map
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3 border-l border-slate-200 pl-4 text-xs">
            <span className="text-slate-500 font-medium">
              Targets: <span className="text-indigo-600 font-extrabold font-mono text-sm">{filteredTargets.length}</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500 font-medium">
              Observations: <span className="text-emerald-600 font-extrabold font-mono text-sm">{totalObservationsCount}</span>
            </span>
          </div>

          {/* Mission Scope Selector */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1 rounded-xl text-xs">
            <Compass className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span className="text-[10px] font-bold text-slate-400 uppercase">MISSION:</span>
            <select
              value={selectedMissionId || 'ALL'}
              onChange={(e) => setSelectedMissionId(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Missions (Global View)</option>
              {(missions || []).map(m => (
                <option key={m.mission_id} value={m.mission_id}>
                  {m.mission_id}: {m.survey_name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: Filters & Controls */}
        <div className="flex items-center gap-3 text-xs flex-wrap">

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase">CATEGORY:</label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-800 font-bold px-2.5 py-1.5 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Categories</option>
              <option value="WRECK">Shipwreck / Mine</option>
              <option value="PIPELINE">Pipeline / Cylinder</option>
              <option value="DEBRIS">Debris / Net</option>
            </select>
          </div>

          {/* Confidence Slider */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase">
              CONF &ge; {Math.round(minConfidence * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={minConfidence}
              onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
              className="accent-indigo-600 bg-slate-200 h-1.5 w-20 rounded cursor-pointer"
            />
          </div>

          <button
            onClick={() => refreshData({ silent: true })}
            disabled={isRefreshing}
            className="p-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition cursor-pointer"
            title="Refresh GIS Layer"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main Container: Full Width Map */}
      <div className="flex-1 flex relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
        <div className="flex-1 h-full">
          <GISMap
            targets={filteredTargets}
            allTargets={targets}
            vesselTrack={vesselTrack}
            selectedTargetId={selectedTarget?.target_id || selectedTarget?.id}
            newlyDetectedTargetId={newlyDetectedId}
            onSelectTarget={handleTargetSelect}
            onOpenEvidence={handleOpenEvidence}
            autoZoomKey={selectedMissionId || 'ALL'}
          />
        </div>

        {/* Full Sonar Evidence Viewer Modal with Multi-Target Segmentation & Bounding Boxes */}
        {isEvidenceOpen && selectedTarget && (
          <EvidenceViewerModal
            target={selectedTarget}
            allTargets={targets}
            onClose={() => {
              setIsEvidenceOpen(false);
            }}
            onTargetSelect={(t) => {
              setSelectedTarget(t);
              setSelectedTargetId(t.target_id || t.id);
            }}
            onTargetReviewed={(tid, newStatus) => {
              handleReview(tid, newStatus);
            }}
            onTargetDeleted={(tid) => {
              deleteTarget?.(tid);
            }}
          />
        )}
      </div>
    </div>
  );
}
