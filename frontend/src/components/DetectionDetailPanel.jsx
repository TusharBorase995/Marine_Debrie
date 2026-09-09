import React, { useState, useEffect } from 'react';
import { Target, CheckCircle2, XCircle, Shield, X, Layers, Clock, MapPin, Eye, AlertCircle } from 'lucide-react';
import { 
  formatConfidence, 
  formatClassLabel, 
  formatSize, 
  formatCoordinates, 
  formatTimestamp, 
  getStatusBadgeInfo,
  normalizeStatus
} from '../utils/formatters';

export const DetectionDetailPanel = ({ detection, onClose, onReview }) => {
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
        <span className="max-w-xs text-[11px] text-[#64748B]">Select any target from the GIS map or detection catalog to inspect its sonar evidence and acoustic telemetry.</span>
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

  const shadowVerified = currentObs.shadow_verified ?? detection.shadow_verified ?? true;
  const displayTimestamp = formatTimestamp(currentObs.timestamp || detection.timestamp);

  // Prioritize local optimistic status, then parent target status, then observation status
  const currentStatus = localStatus || detection.status || detection.human_review_status || currentObs.status || currentObs.human_review_status;
  const badgeInfo = getStatusBadgeInfo(currentStatus);

  const imageSrc = currentObs.sonar_image_ref || detection.sonar_image_ref || null;

  const handleAction = (action) => {
    const newStatus = action === 'confirm' ? 'confirmed' : 'rejected';
    setLocalStatus(newStatus);
    if (onReview) {
      onReview(targetId, action);
    }
  };

  return (
    <div className="bg-white border border-[#E5EDF5] rounded-2xl p-5 flex flex-col text-xs text-[#0B192C] space-y-4 w-full shadow-2xs">
      
      {/* 1. Header Banner */}
      <div className="border-b border-[#E5EDF5] pb-3 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] text-[#026AA7] font-mono font-bold tracking-wider uppercase bg-[#EAF2FD] px-2.5 py-0.5 rounded-full border border-[#BAE6FD]">
              TARGET INSPECTION
            </span>
            {observations.length > 1 && (
              <span className="bg-[#F4F7FB] text-[#475569] font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border border-[#E2E8F0]">
                {observations.length} PASSES CONSOLIDATED
              </span>
            )}
          </div>
          <h2 className="text-xl font-black text-[#0B192C] font-mono tracking-tight">{targetId}</h2>
          <p className="text-xs font-bold text-[#0284C7] font-sans">{displayClass}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-all duration-300 ${badgeInfo.bgClass} ${badgeInfo.borderClass}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${badgeInfo.dotClass}`} />
            {badgeInfo.label}
          </span>
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-1 hover:bg-[#F4F7FB] text-[#94A3B8] hover:text-[#0B192C] rounded-lg transition"
              title="Close Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Multi-Pass Observation Switcher */}
      {observations.length > 1 && (
        <div className="bg-[#F4F7FB] p-2 rounded-xl border border-[#E5EDF5] space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-[#64748B] font-mono font-bold uppercase px-1">
            <span className="flex items-center gap-1 text-[#0B192C]">
              <Layers className="w-3 h-3 text-[#0284C7]" /> Acoustic Observations
            </span>
            <span>{selectedPassIndex + 1} of {observations.length}</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {observations.map((obs, idx) => {
              const isObsSelected = idx === selectedPassIndex;
              return (
                <button
                  key={obs.id || idx}
                  onClick={() => setSelectedPassIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg font-mono text-[11px] font-bold transition flex items-center gap-1.5 shrink-0 border ${
                    isObsSelected
                      ? 'bg-[#0B3B60] text-white border-[#0B3B60] shadow-xs'
                      : 'bg-white text-[#475569] border-[#E2E8F0] hover:bg-slate-50'
                  }`}
                >
                  <span>Pass {obs.pass_number || idx + 1}</span>
                  <span className={`text-[9px] px-1 py-0.2 rounded ${isObsSelected ? 'bg-[#072F4F]' : 'bg-[#F4F7FB]'}`}>
                    {formatConfidence(obs.confidence)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Evidence Image + Metadata Body */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Left: Dedicated Sonar Acoustic Scan Viewport */}
        <div className="bg-[#0B192C] rounded-xl p-3 border border-[#132B45] flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono text-cyan-400 pb-1 border-b border-white/10">
            <span className="flex items-center gap-1 font-bold">
              <Eye className="w-3.5 h-3.5" /> SONAR EVIDENCE
            </span>
            <span className="text-slate-400">{currentObs.id || targetId}</span>
          </div>

          {/* Actual Sonar Crop Viewport */}
          <div className="relative aspect-square w-full rounded-lg overflow-hidden bg-black border border-slate-700 flex items-center justify-center group">
            {imageSrc ? (
              <img 
                src={imageSrc} 
                alt={targetId}
                className="w-full h-full object-contain p-1 filter contrast-125"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center justify-center p-4 text-center space-y-1.5">
                <Layers className="w-8 h-8 text-slate-700" />
                <span className="text-[10px] font-mono font-bold text-slate-400">NO SONAR EVIDENCE IMAGE</span>
                <span className="text-[9px] text-slate-500">Awaiting ML evidence upload</span>
              </div>
            )}
            {/* Tactical Sonar Reticle Overlay */}
            <div className="absolute inset-0 pointer-events-none border border-cyan-500/20" />
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/80 border border-cyan-500/30 text-cyan-300 text-[8px] font-mono">
              ACOUSTIC EVIDENCE
            </div>
            <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-[#0284C7] text-white text-[9px] font-mono font-bold">
              {displayConf}
            </div>
          </div>

          <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between pt-0.5">
            <span className="truncate max-w-[150px]" title={imageSrc || 'None'}>Ref: {imageSrc || 'Awaiting Upload'}</span>
            <span>Pass {currentObs.pass_number || 1}</span>
          </div>
        </div>

        {/* Right: Technical Telemetry & Metadata */}
        <div className="bg-[#F4F7FB] p-4 rounded-xl border border-[#E5EDF5] flex flex-col justify-between space-y-2.5">
          <div className="space-y-2 font-mono text-xs">
            {/* Target ID */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="text-[#64748B] text-[10px] uppercase font-sans">Target ID</span>
              <span className="font-bold text-[#0B192C]">{targetId}</span>
            </div>

            {/* Classification */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="text-[#64748B] text-[10px] uppercase font-sans">Classification</span>
              <span className="font-bold text-[#0284C7]">{displayClass}</span>
            </div>

            {/* Confidence */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="text-[#64748B] text-[10px] uppercase font-sans">Confidence</span>
              <span className="font-bold text-[#10B981] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {displayConf}
              </span>
            </div>

            {/* Size */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="text-[#64748B] text-[10px] uppercase font-sans">Estimated Size</span>
              <span className="font-bold text-[#0B192C]">{displaySize}</span>
            </div>

            {/* Coordinates */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="text-[#64748B] text-[10px] uppercase font-sans">Coordinates</span>
              <span className="font-bold text-[#475569] text-[10px]">{displayCoords}</span>
            </div>

            {/* Shadow Verified */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="text-[#64748B] text-[10px] uppercase font-sans">Shadow Verified</span>
              <span className={`font-bold text-[10px] px-2 py-0.5 rounded-full ${
                shadowVerified 
                  ? 'bg-emerald-50 text-[#10B981] border border-emerald-200' 
                  : 'bg-amber-50 text-[#D97706] border border-amber-200'
              }`}>
                {shadowVerified ? 'YES (U-Net Fused)' : 'UNVERIFIED'}
              </span>
            </div>

            {/* Timestamp */}
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <span className="text-[#64748B] text-[10px] uppercase font-sans">Timestamp</span>
              <span className="text-[#475569] text-[10px]">{displayTimestamp}</span>
            </div>

            {/* Review Status */}
            <div className="flex items-center justify-between">
              <span className="text-[#64748B] text-[10px] uppercase font-sans">Review Status</span>
              <span className={`font-bold text-[10px] px-2.5 py-0.5 rounded-full border transition-all duration-300 ${badgeInfo.bgClass} ${badgeInfo.borderClass}`}>
                {badgeInfo.label}
              </span>
            </div>
          </div>

          {/* Low Confidence Advisory Flag */}
          {(Number(confVal || 0) < 0.75 || !shadowVerified) && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-800 flex items-start gap-1.5 font-sans">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Analyst Advisory:</strong> Low confidence or unverified acoustic shadow. Ground-truth inspection recommended.
              </span>
            </div>
          )}

          {/* 4. Analyst Review Actions (Confirm / Reject) */}
          <div className="pt-2 border-t border-[#E2E8F0]">
            <span className="text-[10px] font-sans text-[#64748B] uppercase block font-bold mb-1.5">
              ANALYST GROUND-TRUTHING
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleAction('confirm')}
                className={`py-2 px-2 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition text-xs active:scale-95 ${
                  currentStatus === 'confirmed' 
                    ? 'bg-[#10B981] ring-2 ring-emerald-300 cursor-default' 
                    : 'bg-[#10B981] hover:bg-[#059669]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> CONFIRM
              </button>

              <button
                onClick={() => handleAction('reject')}
                className={`py-2 px-2 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-2xs transition text-[11px] active:scale-95 ${
                  currentStatus === 'rejected' 
                    ? 'bg-[#EF4444] ring-2 ring-red-300 cursor-default' 
                    : 'bg-[#EF4444] hover:bg-[#DC2626]'
                }`}
                title="Mark as false-positive detection"
              >
                <XCircle className="w-3.5 h-3.5" /> REJECT (FALSE POSITIVE)
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};

export default DetectionDetailPanel;
