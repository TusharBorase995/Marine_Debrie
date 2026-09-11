import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, XCircle, X, Layers, Eye, MapPin, Sparkles, AlertCircle, Trash2 } from 'lucide-react';
import { 
  formatConfidence, 
  formatClassLabel, 
  formatSize, 
  formatCoordinates, 
  formatTimestamp, 
  getStatusBadgeInfo
} from '../utils/formatters';

export const DetectionDetailPanel = ({ 
  detection, 
  onClose, 
  onReview, 
  onOpenEvidence,
  onViewOnMap,
  onDelete
}) => {
  const [selectedPassIndex, setSelectedPassIndex] = useState(0);
  const [localStatus, setLocalStatus] = useState(null);

  // Reset selected pass index and local optimistic status when target changes
  useEffect(() => {
    setSelectedPassIndex(0);
    setLocalStatus(null);
  }, [detection?.target_id, detection?.id]);

  if (!detection) {
    return (
      <div className="bg-white border border-[#E5EDF5] rounded-2xl p-6 text-center text-xs font-sans text-[#64748B] flex flex-col items-center justify-center min-h-[360px] shadow-2xs">
        <Target className="w-10 h-10 text-[#94A3B8] mb-3" />
        <span className="font-bold text-[#0B192C] tracking-wider uppercase mb-1">NO TARGET SELECTED</span>
        <span className="max-w-xs text-[11px] text-[#64748B]">Select any target from the catalog or GIS map to inspect its acoustic evidence and telemetry.</span>
      </div>
    );
  }

  const targetId = detection.target_id || detection.id || 'TGT-UNKNOWN';
  const observations = detection.observations && detection.observations.length > 0
    ? detection.observations
    : [detection];

  const currentObs = observations[selectedPassIndex] || observations[0] || detection;
  const rawClass = currentObs.class || detection.class || currentObs.category || detection.category;
  const displayClass = formatClassLabel(rawClass);

  const confVal = currentObs.confidence ?? detection.fused_confidence ?? detection.confidence;
  const displayConf = formatConfidence(confVal);

  const sizeVal = currentObs.estimated_size_m ?? detection.estimated_size_m;
  const displaySize = formatSize(sizeVal);

  const latVal = currentObs.latitude ?? detection.latitude;
  const lonVal = currentObs.longitude ?? detection.longitude;
  const displayCoords = formatCoordinates(latVal, lonVal);

  const shadowVerified = Boolean(currentObs?.shadow_verified ?? detection?.shadow_verified ?? false);
  const displayTimestamp = formatTimestamp(currentObs.timestamp || detection.timestamp);

  // Prioritize local optimistic status, then parent target status, then observation status
  const currentStatus = localStatus || detection.status || detection.human_review_status || currentObs.status || currentObs.human_review_status;
  const badgeInfo = getStatusBadgeInfo(currentStatus);

  const imageSrc = currentObs.sonar_image_ref || detection.sonar_image_ref || null;
  const missionId = currentObs.mission_id || detection.mission_id || 'MISSION-001';

  const handleAction = (action) => {
    const newStatus = action === 'confirm' ? 'confirmed' : 'rejected';
    setLocalStatus(newStatus);
    if (onReview) {
      onReview(targetId, action);
    }
    if (onClose) {
      onClose();
    }
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex flex-col text-xs text-[#0B192C] space-y-4 w-full shadow-sm animate-arrival">
      
      {/* 1. Header: Target ID, Status, and Controls */}
      <div className="border-b border-[#F1F5F9] pb-3.5">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-mono font-black text-base text-slate-900 tracking-tight">
              {targetId}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1 ${badgeInfo.bgClass} ${badgeInfo.borderClass}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dotClass}`} />
              {badgeInfo.label}
            </span>
          </div>

          {/* Quick Actions (Map view & Close) */}
          <div className="flex items-center gap-1">
            {onViewOnMap && (
              <button
                onClick={onViewOnMap}
                className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[11px] rounded-lg transition flex items-center gap-1 border border-indigo-200 cursor-pointer"
                title="Inspect on GIS Map"
              >
                <MapPin className="w-3 h-3" /> Map
              </button>
            )}
            {onClose && (
              <button 
                onClick={onClose} 
                className="p-1 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
                title="Close Inspector"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Classification Title & Observation Count */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-indigo-600 font-sans">
            {displayClass}
          </span>
          {observations.length > 1 && (
            <span className="bg-slate-100 text-slate-600 font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-200">
              {observations.length} Passes Fused
            </span>
          )}
        </div>
      </div>

      {/* 2. Multi-Pass Observation Switcher (only shown if multiple passes exist) */}
      {observations.length > 1 && (
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono font-bold uppercase px-0.5">
            <span className="flex items-center gap-1 text-slate-700">
              <Layers className="w-3 h-3 text-indigo-600" /> Acoustic Observations
            </span>
            <span>Pass {selectedPassIndex + 1} of {observations.length}</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {observations.map((obs, idx) => {
              const isObsSelected = idx === selectedPassIndex;
              return (
                <button
                  key={obs.id || idx}
                  onClick={() => setSelectedPassIndex(idx)}
                  className={`px-3 py-1 rounded-lg font-mono text-[11px] font-bold transition flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                    isObsSelected
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>Pass {obs.pass_number || idx + 1}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded font-mono ${isObsSelected ? 'bg-slate-800 text-emerald-400' : 'bg-slate-100 text-slate-700'}`}>
                    {formatConfidence(obs.confidence)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Sonar Evidence Preview (No dark blue background wrapper!) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
          <span className="flex items-center gap-1 font-sans">
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            Sonar Crop Evidence
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {currentObs.id || targetId}
          </span>
        </div>

        <div 
          onClick={() => onOpenEvidence?.(detection)}
          className="relative w-full aspect-[16/10] rounded-xl overflow-hidden bg-slate-950 border border-slate-200 shadow-sm group cursor-pointer hover:border-indigo-400 transition"
          title="Click to open Full Sonar Frame Evidence Viewer with Multi-Target Segmentation"
        >
          {imageSrc ? (
            <img 
              src={imageSrc} 
              alt={targetId}
              className="w-full h-full object-contain filter contrast-125 transition-transform duration-300 group-hover:scale-105"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full p-4 text-center space-y-1 bg-slate-100">
              <Layers className="w-7 h-7 text-slate-400" />
              <span className="text-[11px] font-mono font-bold text-slate-500">NO EVIDENCE IMAGE</span>
              <span className="text-[10px] text-slate-400">Awaiting sonar crop upload</span>
            </div>
          )}

          {/* Click to Enlarge Badge */}
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur text-white text-[10px] font-mono font-bold border border-white/20 flex items-center gap-1 shadow-sm opacity-90 group-hover:opacity-100 group-hover:bg-indigo-600 transition">
            <Sparkles className="w-3 h-3 text-cyan-300" />
            <span>Enlarge &rarr;</span>
          </div>

          {/* Confidence Chip */}
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-mono font-black shadow-sm">
            {displayConf}
          </div>
        </div>
      </div>

      {/* 4. Technical Telemetry & Metadata Grid */}
      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Confidence</span>
            <span className="font-mono font-black text-sm text-emerald-600 mt-0.5 block">{displayConf}</span>
          </div>
          <div className="bg-white p-2.5 rounded-lg border border-slate-200/60 shadow-2xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 block font-sans">Estimated Size</span>
            <span className="font-mono font-black text-sm text-slate-800 mt-0.5 block">{displaySize}</span>
          </div>
        </div>

        <div className="space-y-2 pt-1 font-sans text-xs">
          <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Coordinates (WGS-84)</span>
            <span className="font-mono font-bold text-slate-800 text-[11px]">{displayCoords}</span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Acoustic Shadow</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              shadowVerified 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {shadowVerified ? 'Verified (U-Net Fused)' : 'Unverified'}
            </span>
          </div>

          <div className="flex items-center justify-between py-1 border-b border-slate-200/60">
            <span className="text-slate-500 font-medium">Detection Timestamp</span>
            <span className="font-mono text-slate-700 text-[11px]">{displayTimestamp}</span>
          </div>

          <div className="flex items-center justify-between py-1">
            <span className="text-slate-500 font-medium">Mission Container</span>
            <span className="font-mono font-bold text-indigo-600 text-[11px] bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
              {missionId}
            </span>
          </div>
        </div>
      </div>

      {/* Low Confidence Advisory Notice */}
      {(Number(confVal || 0) < 0.75 || !shadowVerified) && (
        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2 font-sans">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Analyst Advisory:</strong> Review recommended due to acoustic shadow ambiguity or confidence &lt; 75%.
          </span>
        </div>
      )}

      {/* 5. Analyst Ground-Truthing Actions */}
      <div className="pt-2 border-t border-slate-100 space-y-2">
        <span className="text-[10px] font-sans text-slate-400 uppercase block font-bold tracking-wider">
          ANALYST GROUND-TRUTHING
        </span>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => handleAction('confirm')}
            className={`py-2.5 px-3 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition text-xs cursor-pointer active:scale-95 ${
              currentStatus === 'confirmed' 
                ? 'bg-emerald-600 text-white ring-2 ring-emerald-300 cursor-default' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" /> CONFIRM
          </button>

          <button
            onClick={() => handleAction('reject')}
            className={`py-2.5 px-3 font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition text-xs cursor-pointer active:scale-95 ${
              currentStatus === 'rejected' 
                ? 'bg-red-600 text-white ring-2 ring-red-300 cursor-default' 
                : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
            }`}
            title="Mark as false positive anomaly"
          >
            <XCircle className="w-4 h-4" /> REJECT
          </button>
        </div>

        {/* Inspect Full Evidence Modal Button */}
        <button
          onClick={() => onOpenEvidence?.(detection)}
          className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-slate-500" />
          Open High-Res Frame &amp; Segmentation &rarr;
        </button>

        {/* Delete Detection Button */}
        {onDelete && (
          <button
            onClick={() => onDelete(targetId)}
            className="w-full py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-red-200 cursor-pointer active:scale-95 group shadow-2xs mt-1"
            title="Permanently remove target and observations"
          >
            <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            Delete Target from Database
          </button>
        )}
      </div>

    </div>
  );
};

export default DetectionDetailPanel;
