import React, { useState } from 'react';
import { Crosshair, ZoomIn, Info, Eye, Layers } from 'lucide-react';
import { formatConfidence, formatClassLabel } from '../utils/formatters';

export const SonarWaterfall = ({ 
  imageRef = null, 
  detections = [], 
  selectedTarget = null,
  selectedDetectionId = null,
  onSelectDetection = null,
  surveyTitle = "ACOUSTIC SIDE-SCAN SONAR VIEWPORT"
}) => {
  const [zoom, setZoom] = useState(1);

  // If selectedTarget provides a sonar_image_ref, prioritize it
  const activeImage = selectedTarget?.sonar_image_ref || imageRef || null;
  const targetLabel = selectedTarget 
    ? `${selectedTarget.target_id || selectedTarget.id} — ${formatClassLabel(selectedTarget.class || selectedTarget.category)}`
    : surveyTitle;

  return (
    <div className="bg-white border border-[#E9EDF7] rounded-3xl flex flex-col h-full overflow-hidden select-none shadow-soft">
      {/* Waterfall Header Telemetry Bar */}
      <div className="px-4 py-3 bg-[#F4F7FE] border-b border-[#E9EDF7] flex items-center justify-between font-sans text-xs">
        <div className="flex items-center gap-2">
          <Crosshair className="w-4 h-4 text-[#5E56E7]" />
          <span className="font-extrabold text-[#1B2559] tracking-wide uppercase font-mono">{targetLabel}</span>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[#A3AED0]">
          <span className="bg-white px-2.5 py-1 rounded-xl border border-[#E9EDF7] font-mono font-bold text-[#1B2559]">
            SWATH: 100.0m
          </span>
          <span className="bg-white px-2.5 py-1 rounded-xl border border-[#E9EDF7] font-mono font-bold text-[#1B2559]">
            FREQ: 455 kHz
          </span>
          <span className="bg-[#FFF9D2] text-[#D97706] px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
            <Info className="w-3.5 h-3.5" /> SONAR EVIDENCE
          </span>
        </div>
      </div>

      {/* Acoustic Image Viewport */}
      <div className="relative flex-1 bg-black overflow-hidden flex items-center justify-center min-h-[340px]">
        {/* Waterfall / Target Evidence Image */}
        {activeImage ? (
          <img
            src={activeImage}
            alt="Acoustic Sonar Evidence Swath"
            className="w-full h-full object-cover grayscale contrast-125 transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-2 select-none">
            <Layers className="w-12 h-12 text-slate-700 animate-pulse" />
            <p className="text-xs font-mono font-bold text-slate-400">NO ACOUSTIC STREAM / EVIDENCE LOADED</p>
            <p className="text-[11px] text-slate-600 max-w-sm">Awaiting real-time detection stream or batch image package ingestion.</p>
          </div>
        )}

        {/* Slant-Range Track Overlay Lines */}
        <div className="absolute inset-0 pointer-events-none opacity-40 flex justify-between px-10">
          <div className="border-r border-dashed border-[#5E56E7] h-full text-[9px] text-[#7B73F6] font-mono pl-1 pt-2 font-bold">PORT 50.0m</div>
          <div className="border-r-2 border-solid border-cyan-400 h-full text-[9px] text-cyan-300 font-mono px-1 pt-2 bg-black/60 font-bold">NADIR TRACK</div>
          <div className="border-r border-dashed border-[#5E56E7] h-full text-[9px] text-[#7B73F6] font-mono pr-1 pt-2 text-right font-bold">STBD 50.0m</div>
        </div>

        {/* Bounding Box Overlays */}
        {selectedTarget && selectedTarget.bounding_box && (
          <div
            style={{
              left: `${Math.min(80, Math.max(5, (selectedTarget.bounding_box.x || 100) / 7.0))}%`,
              top: `${Math.min(80, Math.max(5, (selectedTarget.bounding_box.y || 100) / 5.0))}%`,
              width: `${Math.min(75, Math.max(15, (selectedTarget.bounding_box.width || 200) / 7.0))}%`,
              height: `${Math.min(75, Math.max(15, (selectedTarget.bounding_box.height || 180) / 5.0))}%`
            }}
            className="absolute border-2 border-[#5E56E7] bg-[#5E56E7]/25 shadow-[0_0_20px_rgba(94,86,231,0.6)] z-20 pointer-events-none"
          >
            {/* Corner Crosshairs */}
            <span className="absolute -top-1 -left-1 w-2 h-2 border-t-2 border-l-2 border-white" />
            <span className="absolute -top-1 -right-1 w-2 h-2 border-t-2 border-r-2 border-white" />
            <span className="absolute -bottom-1 -left-1 w-2 h-2 border-b-2 border-l-2 border-white" />
            <span className="absolute -bottom-1 -right-1 w-2 h-2 border-b-2 border-r-2 border-white" />

            <div className="absolute -top-6 left-0 px-2 py-0.5 text-[9px] font-extrabold font-mono rounded bg-[#5E56E7] text-white whitespace-nowrap uppercase shadow">
              <span>{formatClassLabel(selectedTarget.class || selectedTarget.category)}</span>
              <span className="ml-1 bg-black/40 px-1 rounded">{formatConfidence(selectedTarget.fused_confidence ?? selectedTarget.confidence)}</span>
            </div>
          </div>
        )}

        {/* Optional Segmentation Mask Overlay */}
        {selectedTarget?.mask_ref && (
          <div className="absolute inset-0 pointer-events-none bg-emerald-500/15 mix-blend-screen" />
        )}
      </div>

      {/* Waterfall Footer Controls */}
      <div className="px-4 py-2 bg-[#F4F7FE] border-t border-[#E9EDF7] font-sans text-xs text-[#A3AED0] flex items-center justify-between">
        <span className="font-mono text-[11px]">
          SOURCE: <strong className="text-[#1B2559]">{activeImage || 'Awaiting Sonar Stream'}</strong>
        </span>

        <div className="flex items-center gap-2 font-bold">
          <ZoomIn className="w-4 h-4 text-[#5E56E7]" />
          <button onClick={() => setZoom(1)} className={`hover:text-[#1B2559] ${zoom === 1 ? 'text-[#5E56E7]' : ''}`}>1.0x</button>
          <span>|</span>
          <button onClick={() => setZoom(1.4)} className={`hover:text-[#1B2559] ${zoom === 1.4 ? 'text-[#5E56E7]' : ''}`}>1.4x</button>
          <span>|</span>
          <button onClick={() => setZoom(2.0)} className={`hover:text-[#1B2559] ${zoom === 2.0 ? 'text-[#5E56E7]' : ''}`}>2.0x</button>
        </div>
      </div>
    </div>
  );
};

export default SonarWaterfall;
