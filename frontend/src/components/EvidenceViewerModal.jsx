import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, ZoomIn, ZoomOut, RotateCcw, 
  AlertCircle, CheckCircle2, XCircle, 
  Target, Sparkles, MapPin, Clock, Trash2
} from 'lucide-react';
import { 
  formatConfidence, 
  formatClassLabel, 
  formatSize, 
  formatCoordinates, 
  formatTimestamp, 
  getStatusBadgeInfo,
  normalizeStatus
} from '../utils/formatters';
import targetService, { extractImageKeys } from '../services/targetService';
import detectionService from '../services/detectionService';

/**
 * Full Sonar Evidence Viewer Modal
 * 
 * Features:
 * 1. Displays the complete uncropped sonar image from sonar_image_ref.
 * 2. Groups all targets sharing the same sonar_image_ref on the same image frame.
 * 3. Renders segmentation polygons (preferred) or bounding boxes (fallback) for every target in the frame.
 * 4. Lock-step Zoom, Pan, Fit, and Reset controls that keep SVG overlays 100% pixel-aligned.
 * 5. Instant Target Information Card with live analyst review actions (Confirm / Reject / Reset).
 * 6. Interactive hover & click on overlays with real-time target switching.
 */
export default function EvidenceViewerModal({
  target,
  allTargets = [],
  onClose,
  onTargetSelect,
  onTargetReviewed,
  onTargetDeleted
}) {
  const [activeTargetId, setActiveTargetId] = useState(target?.target_id || target?.id);
  const [hoveredTargetId, setHoveredTargetId] = useState(null);
  const [siblingStatusMap, setSiblingStatusMap] = useState({});

  // Zoom & Pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Natural image dimensions for SVG viewBox matching
  const [naturalDim, setNaturalDim] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Synchronize when the passed target prop changes
  useEffect(() => {
    if (target) {
      setActiveTargetId(target.target_id || target.id);
    }
  }, [target]);

  // Find all sibling targets sharing the acoustic frame across passes
  const targetKeys = useMemo(() => extractImageKeys(target), [target]);
  const activeImageRef = target?.sonar_image_ref || target?.observations?.[0]?.sonar_image_ref || null;

  const siblingTargets = useMemo(() => {
    if (!target) return [];
    if (!allTargets || allTargets.length === 0) return [target];

    const currentTid = target.target_id || target.id;
    const matching = allTargets.filter(t => {
      const tid = t.target_id || t.id;
      if (tid === currentTid) return true;
      const tKeys = extractImageKeys(t);
      return tKeys.some(k => targetKeys.includes(k));
    });

    if (!matching.some(m => (m.target_id || m.id) === currentTid)) {
      matching.unshift(target);
    }
    return matching;
  }, [target, allTargets, targetKeys]);

  // Helper to resolve geometry for any sibling target on the active image frame
  const resolveTargetGeometry = (tgt) => {
    if (!tgt) return { segmentation: null, bounding_box: null, obs: null };
    const currentFrameKeys = extractImageKeys({ sonar_image_ref: activeImageRef });

    if (Array.isArray(tgt.observations) && tgt.observations.length > 0) {
      const match = tgt.observations.find(o => {
        const oKeys = extractImageKeys(o);
        return oKeys.some(k => currentFrameKeys.includes(k));
      });
      if (match && (match.segmentation || match.bounding_box)) {
        return {
          segmentation: match.segmentation,
          bounding_box: match.bounding_box,
          obs: match
        };
      }
    }

    return {
      segmentation: tgt.segmentation || tgt.observations?.[0]?.segmentation,
      bounding_box: tgt.bounding_box || tgt.observations?.[0]?.bounding_box,
      obs: tgt.observations?.[0] || null
    };
  };

  // The currently active target object
  const activeTarget = useMemo(() => {
    const found = siblingTargets.find(t => (t.target_id || t.id) === activeTargetId);
    return found || target || siblingTargets[0] || null;
  }, [siblingTargets, activeTargetId, target]);

  // Reset zoom & pan when image changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setImageLoaded(false);
    setImageError(false);
  }, [activeImageRef]);

  // Handle native image dimensions on load
  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setNaturalDim({ width: naturalWidth, height: naturalHeight });
    setImageLoaded(true);
    setImageError(false);
  };

  // Keyboard navigation & controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-' || e.key === '_') handleZoomOut();
      if (e.key === '0') handleResetZoom();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Pan handlers
  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setZoom(prev => Math.min(5.0, Math.max(0.4, Number((prev * zoomFactor).toFixed(2)))));
  };

  const handleZoomIn = () => setZoom(prev => Math.min(5.0, Number((prev + 0.25).toFixed(2))));
  const handleZoomOut = () => setZoom(prev => Math.max(0.4, Number((prev - 0.25).toFixed(2))));
  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const handleFitToScreen = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Switch active target
  const selectTarget = (tgt) => {
    const tid = tgt.target_id || tgt.id;
    setActiveTargetId(tid);
    onTargetSelect?.(tgt);
  };

  // Analyst Review Action (Confirm / Reject / Reset)
  const handleReviewAction = async (action) => {
    if (!activeTarget) return;
    const tid = activeTarget.target_id || activeTarget.id;
    try {
      setReviewing(true);
      const reviewFn = targetService.review || targetService.reviewTarget || detectionService.review;
      const res = await reviewFn(tid, action);
      const updatedStatus = res?.status || (action === 'confirm' ? 'confirmed' : action === 'reject' ? 'rejected' : 'pending_review');
      activeTarget.status = updatedStatus;
      activeTarget.human_review_status = updatedStatus;
      setSiblingStatusMap(prev => ({ ...prev, [tid]: updatedStatus }));
      onTargetReviewed?.(tid, updatedStatus);
      if (action === 'confirm' || action === 'reject') {
        onClose?.();
      }
    } catch (err) {
      console.error('Failed to update review status:', err);
      alert('Error updating review: ' + (err.response?.data?.detail || err.message));
    } finally {
      setReviewing(false);
    }
  };

  const handleDeleteActiveTarget = async () => {
    if (!activeTarget) return;
    const tid = activeTarget.target_id || activeTarget.id;
    if (window.confirm(`Are you sure you want to permanently delete target ${tid}? This will remove it from the database.`)) {
      try {
        await detectionService.delete(tid);
        onTargetDeleted?.(tid);
        const remaining = siblingTargets.filter(t => (t.target_id || t.id) !== tid);
        if (remaining.length > 0) {
          selectTarget(remaining[0]);
        } else {
          onClose?.();
        }
      } catch (err) {
        console.error('Delete target failed:', err);
        alert('Failed to delete target: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  // Metadata display values
  const activeClassLabel = formatClassLabel(activeTarget?.class || activeTarget?.category);
  const activeConfidence = formatConfidence(activeTarget?.fused_confidence ?? activeTarget?.confidence);
  const activeSize = formatSize(activeTarget?.estimated_size_m);
  const activeCoords = formatCoordinates(activeTarget?.latitude, activeTarget?.longitude);
  const activeStatusInfo = getStatusBadgeInfo(activeTarget?.status || activeTarget?.human_review_status);
  const activeTimestamp = formatTimestamp(activeTarget?.timestamp || activeTarget?.observations?.[0]?.timestamp);
  const activeShadowVerified = Boolean(activeTarget?.shadow_verified ?? activeTarget?.observations?.[0]?.shadow_verified ?? false);

  // Extract filename for header
  const imageFileName = useMemo(() => {
    if (!activeImageRef) return 'Evidence Frame';
    const parts = activeImageRef.split('/');
    return parts[parts.length - 1] || 'Sonar Frame';
  }, [activeImageRef]);

  return createPortal(
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-3 sm:p-6 select-none animate-arrival">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden text-slate-800">
        
        {/* Top Header Console Bar */}
        <div className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-extrabold text-slate-900 tracking-tight truncate font-sans">
                  Acoustic Sonar Evidence Inspection
                </h3>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                  {imageFileName}
                </span>
                {siblingTargets.length > 1 && (
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {siblingTargets.length} Targets in Frame
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                Full uncropped swath frame. Click any highlighted target return to view telemetry & review status.
              </p>
            </div>
          </div>

          {/* Quick Close Button */}
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer border border-slate-200"
            title="Close Evidence Viewer (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Workspace Body: Canvas (Left/Center) + Target Information Card (Right) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* Sonar Image Canvas & Interactive Overlays */}
          <div 
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className={`flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Subtle grid pattern background */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-10"
              style={{
                backgroundImage: 'radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)',
                backgroundSize: '24px 24px'
              }}
            />

            {!activeImageRef || imageError ? (
              <div className="text-center p-8 space-y-3 z-10 max-w-sm">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-bold text-white font-sans">Evidence Image Unavailable</h4>
                <p className="text-xs text-slate-400 font-sans">
                  No binary sonar evidence frame is registered for target <code>{activeTarget?.target_id}</code>. 
                  Target attributes and GIS coordinates remain available in the side console.
                </p>
              </div>
            ) : (
              /* Scaled & Panned Image Wrapper */
              <div
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.12s ease-out'
                }}
                className="relative inline-block select-none"
              >
                <img
                  ref={imgRef}
                  src={activeImageRef}
                  alt={imageFileName}
                  onLoad={handleImageLoad}
                  onError={() => setImageError(true)}
                  className="block max-w-none pointer-events-none rounded-lg shadow-2xl contrast-125 border border-slate-800"
                  style={{
                    maxHeight: '74vh',
                    maxWidth: '65vw',
                    objectFit: 'contain'
                  }}
                />

                {/* SVG Overlay: Perfectly locked to image coordinates */}
                {imageLoaded && naturalDim.width > 0 && (
                  <svg
                    viewBox={`0 0 ${naturalDim.width} ${naturalDim.height}`}
                    className="absolute inset-0 w-full h-full pointer-events-auto overflow-visible"
                    style={{ width: '100%', height: '100%' }}
                  >
                    {/* Render overlays for all targets in this sonar frame */}
                    {siblingTargets.map((tgt) => {
                      const tid = tgt.target_id || tgt.id;
                      const isActive = tid === activeTargetId;
                      const isHovered = tid === hoveredTargetId;
                      const currentStatus = siblingStatusMap[tid] || tgt.status || tgt.human_review_status || 'pending_review';
                      const normStatus = normalizeStatus(currentStatus);

                      // Dynamic color coding according to status:
                      // Confirmed -> Green (#10B981)
                      // Rejected -> Red (#EF4444)
                      // Pending -> Purple (#A855F7)
                      let statusColor = '#A855F7';
                      if (normStatus === 'confirmed') statusColor = '#10B981';
                      else if (normStatus === 'rejected') statusColor = '#EF4444';

                      const strokeColor = isActive ? '#06B6D4' : (isHovered ? '#A855F7' : statusColor);
                      const strokeWidth = isActive ? 3.5 : (isHovered ? 2.5 : 1.8);
                      const fillColor = isActive 
                        ? 'rgba(6, 182, 212, 0.25)' 
                        : (isHovered ? 'rgba(168, 85, 247, 0.20)' : `${statusColor}18`);

                      const geom = resolveTargetGeometry(tgt);
                      let segmentation = geom.segmentation;
                      if (typeof segmentation === 'string') {
                        try { segmentation = JSON.parse(segmentation); } catch (_) {}
                      }
                      let rawBBox = geom.bounding_box;
                      if (typeof rawBBox === 'string') {
                        try { rawBBox = JSON.parse(rawBBox); } catch (_) {}
                      }

                      // Resolve box dimensions whether provided as {x, y, width, height}, {xmin, ymin, xmax, ymax}, or array [x,y,w,h]
                      let parsedBox = null;
                      if (rawBBox) {
                        let bx = rawBBox.x ?? rawBBox.xmin ?? rawBBox.left;
                        let by = rawBBox.y ?? rawBBox.ymin ?? rawBBox.top;
                        let bw = rawBBox.width ?? rawBBox.w;
                        let bh = rawBBox.height ?? rawBBox.h;

                        if (bx === undefined && rawBBox.xmax !== undefined && rawBBox.xmin !== undefined) {
                          bx = rawBBox.xmin;
                          bw = rawBBox.xmax - rawBBox.xmin;
                        }
                        if (by === undefined && rawBBox.ymax !== undefined && rawBBox.ymin !== undefined) {
                          by = rawBBox.ymin;
                          bh = rawBBox.ymax - rawBBox.ymin;
                        }

                        if (Array.isArray(rawBBox) && rawBBox.length >= 4) {
                          bx = rawBBox[0];
                          by = rawBBox[1];
                          bw = rawBBox[2];
                          bh = rawBBox[3];
                        }

                        if (typeof bx === 'number' && typeof by === 'number' && typeof bw === 'number' && typeof bh === 'number') {
                          // Scale normalized coordinates [0..1] to native image resolution
                          if (bx <= 1 && by <= 1 && bw <= 1 && bh <= 1 && naturalDim.width > 1 && naturalDim.height > 1) {
                            bx = Math.round(bx * naturalDim.width);
                            by = Math.round(by * naturalDim.height);
                            bw = Math.round(bw * naturalDim.width);
                            bh = Math.round(bh * naturalDim.height);
                          }
                          parsedBox = { x: bx, y: by, width: bw, height: bh };
                        }
                      }

                      // Prefer segmentation polygon if valid points (>= 3 points)
                      const hasPolygon = Array.isArray(segmentation) && segmentation.length >= 3;
                      const hasBox = parsedBox !== null;

                      // If neither exists, do NOT invent fake overlay
                      if (!hasPolygon && !hasBox) {
                        return null;
                      }

                      // Top-left label positioning
                      let labelX = 0;
                      let labelY = 0;

                      if (hasPolygon) {
                        const xs = segmentation.map(p => p[0]);
                        const ys = segmentation.map(p => p[1]);
                        labelX = Math.min(...xs);
                        labelY = Math.min(...ys);
                      } else if (hasBox) {
                        labelX = parsedBox.x;
                        labelY = parsedBox.y;
                      }

                      return (
                        <g 
                          key={tid} 
                          className="cursor-pointer transition-all duration-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectTarget(tgt);
                          }}
                          onMouseEnter={() => setHoveredTargetId(tid)}
                          onMouseLeave={() => setHoveredTargetId(null)}
                        >
                          {hasPolygon && (
                            /* 1. Segmentation Polygon (Preferred) */
                            <g>
                              <polygon
                                points={segmentation.map(p => `${p[0]},${p[1]}`).join(' ')}
                                stroke={strokeColor}
                                strokeWidth={strokeWidth}
                                fill={fillColor}
                                strokeLinejoin="round"
                                strokeLinecap="round"
                                strokeDasharray={isActive ? undefined : (isHovered ? undefined : '5,3')}
                              />
                              {/* White vertex handles matching Screenshot 1 */}
                              {segmentation.map((pt, pIdx) => (
                                <circle
                                  key={pIdx}
                                  cx={pt[0]}
                                  cy={pt[1]}
                                  r={isActive ? 3.5 : 2.5}
                                  fill="#FFFFFF"
                                  stroke={strokeColor}
                                  strokeWidth={1.5}
                                  pointerEvents="none"
                                />
                              ))}
                            </g>
                          )}

                          {hasBox && !hasPolygon && (
                            /* 2. Bounding Box Fallback */
                            <rect
                              x={parsedBox.x}
                              y={parsedBox.y}
                              width={parsedBox.width}
                              height={parsedBox.height}
                              rx="4"
                              stroke={strokeColor}
                              strokeWidth={strokeWidth}
                              fill={fillColor}
                              strokeDasharray={isActive ? undefined : (isHovered ? undefined : '5,3')}
                            />
                          )}

                          {/* Technical Overlay Tag Badge above the target */}
                          <g transform={`translate(${labelX}, ${Math.max(16, labelY - 8)})`}>
                            <rect
                              x="0"
                              y="-16"
                              width={Math.max(90, (tid.length + (tgt.class || '').length) * 6.5 + 24)}
                              height="18"
                              rx="4"
                              fill={isActive ? '#06B6D4' : '#0F172A'}
                              stroke={strokeColor}
                              strokeWidth="1.2"
                              opacity={0.92}
                            />
                            <text
                              x="6"
                              y="-4"
                              fill="#FFFFFF"
                              fontSize="10"
                              fontWeight="bold"
                              fontFamily="monospace"
                              pointerEvents="none"
                            >
                              {tid} • {formatClassLabel(tgt.class || tgt.category)}
                            </text>
                          </g>
                        </g>
                      );
                    })}
                  </svg>
                )}
              </div>
            )}

            {/* Floating Zoom & Pan Controls Toolbar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl px-3.5 py-1.5 flex items-center gap-2 shadow-lg z-20 text-slate-700">
              <button
                onClick={handleZoomIn}
                className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={handleZoomOut}
                className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <div className="h-4 w-px bg-slate-200" />
              <span className="text-[11px] font-mono font-black text-indigo-600 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <div className="h-4 w-px bg-slate-200" />
              <button
                onClick={handleFitToScreen}
                className="px-2 py-1 hover:bg-slate-100 text-slate-700 rounded-lg transition text-[10px] font-bold font-mono cursor-pointer"
                title="Fit to Screen"
              >
                Fit
              </button>
              <button
                onClick={handleResetZoom}
                className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded-lg transition cursor-pointer"
                title="Reset View (0)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Instruction Help Hint */}
            <div className="absolute top-3 left-4 text-[10px] font-mono text-slate-300 pointer-events-none hidden sm:block bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-md border border-slate-700">
              Drag to pan • Wheel to zoom • Click overlay to inspect
            </div>
          </div>

          {/* Right Rail: Target Information Card & Sibling Target Rail */}
          <div className="w-full lg:w-96 bg-white border-t lg:border-t-0 lg:border-l border-slate-200 flex flex-col h-auto lg:h-full overflow-y-auto shrink-0 divide-y divide-slate-100">
            
            {/* 1. Sibling Targets Switcher (When frame has >= 1 target) */}
            {siblingTargets.length > 0 && (
              <div className="p-4 space-y-2.5 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Target className="w-3.5 h-3.5 text-indigo-600" /> TARGETS IN THIS FRAME
                  </span>
                  <span className="font-extrabold text-slate-700">{siblingTargets.length} RECORDED</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {siblingTargets.map((t) => {
                    const tid = t.target_id || t.id;
                    const isActive = tid === activeTargetId;
                    const cls = formatClassLabel(t.class || t.category);
                    const currentStatus = siblingStatusMap[tid] || t.status || t.human_review_status || 'pending_review';
                    const normStatus = normalizeStatus(currentStatus);

                    let dotColorClass = 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]';
                    if (normStatus === 'confirmed') dotColorClass = 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]';
                    else if (normStatus === 'rejected') dotColorClass = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';

                    return (
                      <button
                        key={tid}
                        onClick={() => selectTarget(t)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer border ${
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-2 ring-indigo-500/30'
                            : 'bg-white text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${dotColorClass} shrink-0`} />
                        <span>{tid}</span>
                        <span className={`text-[10px] font-sans font-normal ${isActive ? 'text-slate-300' : 'text-slate-500'}`}>
                          ({cls})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Target Information Card */}
            {activeTarget ? (
              <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                
                {/* Header */}
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-[10px] font-mono text-indigo-700 font-bold uppercase tracking-wider bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                      ACTIVE TARGET INSPECTION
                    </span>
                    <h2 className="text-xl font-black text-slate-900 font-mono mt-1.5">
                      {activeTarget.target_id || activeTarget.id}
                    </h2>
                    <p className="text-xs font-bold text-indigo-600 font-sans mt-0.5">
                      {activeClassLabel}
                    </p>
                  </div>

                  <span className={`text-[10px] font-bold font-sans px-2.5 py-1 rounded-full uppercase tracking-wider border flex items-center gap-1.5 ${
                    activeStatusInfo.bgClass
                  } ${activeStatusInfo.borderClass}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${activeStatusInfo.dotClass}`} />
                    {activeStatusInfo.label}
                  </span>
                </div>

                {/* Core Attributes Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  
                  {/* Classification */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-sans text-slate-400 block uppercase font-bold">Class</span>
                    <span className="font-bold text-slate-900 mt-0.5 block truncate" title={activeClassLabel}>
                      {activeClassLabel}
                    </span>
                  </div>

                  {/* Confidence */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-sans text-slate-400 block uppercase font-bold">Confidence</span>
                    <span className="font-bold text-emerald-600 mt-0.5 block">
                      {activeConfidence}
                    </span>
                  </div>

                  {/* Estimated Size */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-sans text-slate-400 block uppercase font-bold">Estimated Size</span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {activeSize}
                    </span>
                  </div>

                  {/* Shadow Verification */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-sans text-slate-400 block uppercase font-bold">Shadow Verified</span>
                    <span className={`font-bold text-[11px] mt-0.5 block ${
                      activeShadowVerified ? 'text-emerald-700' : 'text-amber-700'
                    }`}>
                      {activeShadowVerified ? 'YES (U-Net Fused)' : 'UNVERIFIED'}
                    </span>
                  </div>

                  {/* Geographic Coordinates */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 col-span-2">
                    <span className="text-[10px] font-sans text-slate-400 block uppercase font-bold">WGS84 Coordinates</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-bold text-slate-900">
                        {activeCoords}
                      </span>
                    </div>
                  </div>

                  {/* Timestamp */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 col-span-2">
                    <span className="text-[10px] font-sans text-slate-400 block uppercase font-bold">Timestamp</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-slate-700">
                        {activeTimestamp}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Overlay Geometry Info */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1.5 text-xs">
                  <div className="text-[10px] font-sans text-slate-500 uppercase font-bold flex items-center justify-between">
                    <span>Acoustic Geometry Overlay</span>
                    <span className="text-indigo-600 font-mono font-bold">
                      {activeTarget.segmentation?.length >= 3 
                        ? `Polygon (${activeTarget.segmentation.length} pts)`
                        : (activeTarget.bounding_box ? 'Bounding Box' : 'None Available')}
                    </span>
                  </div>
                  {activeTarget.bounding_box && (
                    <div className="font-mono text-[10px] text-slate-700 flex items-center justify-between bg-white p-2 rounded-lg border border-slate-200">
                      <span>BBox: x:{activeTarget.bounding_box.x}, y:{activeTarget.bounding_box.y}</span>
                      <span>w:{activeTarget.bounding_box.width} × h:{activeTarget.bounding_box.height}</span>
                    </div>
                  )}
                </div>

                {/* 3. Analyst Review Actions */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <span className="text-[10px] font-sans text-slate-400 block uppercase font-bold tracking-wider">
                    Human-In-The-Loop Ground Truth Review
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleReviewAction('confirm')}
                      disabled={reviewing || normalizeStatus(activeTarget.status) === 'confirmed'}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold font-sans transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                        normalizeStatus(activeTarget.status) === 'confirmed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{normalizeStatus(activeTarget.status) === 'confirmed' ? 'Verified Contact' : 'Confirm Hazard'}</span>
                    </button>

                    <button
                      onClick={() => handleReviewAction('reject')}
                      disabled={reviewing || normalizeStatus(activeTarget.status) === 'rejected'}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold font-sans transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs ${
                        normalizeStatus(activeTarget.status) === 'rejected'
                          ? 'bg-red-600 text-white cursor-default'
                          : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 active:scale-95'
                      }`}
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>{normalizeStatus(activeTarget.status) === 'rejected' ? 'Rejected Return' : 'Reject Anomaly'}</span>
                    </button>
                  </div>

                  {normalizeStatus(activeTarget.status) !== 'pending_review' && (
                    <button
                      onClick={() => handleReviewAction('reset')}
                      disabled={reviewing}
                      className="w-full py-1.5 text-[11px] text-slate-400 hover:text-slate-700 transition text-center underline cursor-pointer"
                    >
                      Reset to Pending Review
                    </button>
                  )}

                  {/* Delete Target from Database */}
                  <button
                    onClick={handleDeleteActiveTarget}
                    className="w-full py-2 px-3 bg-red-50/60 hover:bg-red-50 text-red-600 hover:text-red-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-red-200 cursor-pointer active:scale-95 group shadow-2xs mt-2"
                    title="Permanently remove target and observations"
                  >
                    <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                    Delete Target from Database
                  </button>
                </div>

              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs font-sans">
                Select a target to inspect its telemetry and ground truth review.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
