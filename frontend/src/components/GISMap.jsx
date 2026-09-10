import React, { useMemo, useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2, ExternalLink, Layers, Check, Sparkles, Plus, Minus } from 'lucide-react';
import { consolidateDetectionsToTargets } from '../services/targetService';
import { MAP_CONFIG } from '../config/mapConfig';
import { formatConfidence, formatClassLabel, formatSize } from '../utils/formatters';

// Technical CSS animation for real-time new detection ripple
const sonarRadarStyles = `
  @keyframes newTargetRipple {
    0% { transform: scale(1.0); opacity: 0.9; }
    60% { transform: scale(2.4); opacity: 0.35; }
    100% { transform: scale(3.5); opacity: 0.0; }
  }
`;

/**
 * Technical Marine Target Marker Icon (ONE PHYSICAL TARGET = ONE GIS MARKER)
 * Supports real-time new detection ripple animation & selected focus state.
 */
const createPhysicalTargetIcon = (status, isSelected, isNewlyDetected = false, obsCount = 1) => {
  const normalized = status ? status.toLowerCase() : 'pending';
  const colorMap = {
    verified: '#10B981',
    confirmed: '#10B981',
    pending_review: '#F59E0B',
    pending: '#F59E0B',
    rejected: '#EF4444'
  };
  const color = isSelected ? '#06B6D4' : (colorMap[normalized] || '#06B6D4');
  const size = isSelected ? 36 : 28;

  const svgHtml = `
    <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
      
      <!-- Restrained Technical Pulse Ripple for Newly Arrived Detections -->
      ${isNewlyDetected ? `
        <div style="
          position: absolute;
          width: ${size + 14}px;
          height: ${size + 14}px;
          border-radius: 50%;
          border: 2px solid ${color};
          background: ${color}20;
          animation: newTargetRipple 1.8s cubic-bezier(0.1, 0.7, 0.3, 1) infinite;
          pointer-events: none;
        "></div>
      ` : ''}

      <!-- Selected Focus Reticle Halo -->
      ${isSelected ? `
        <div style="
          position: absolute;
          width: ${size + 10}px;
          height: ${size + 10}px;
          border-radius: 50%;
          border: 1.8px dashed #06B6D4;
          animation: spin 8s linear infinite;
          pointer-events: none;
        "></div>
      ` : ''}

      <svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="10" fill="${color}" fill-opacity="${isSelected ? '0.35' : '0.20'}" stroke="${color}" stroke-width="${isSelected ? '2.8' : '2'}"/>
        <circle cx="12" cy="12" r="4.5" fill="${color}" stroke="#FFFFFF" stroke-width="1.8"/>
        ${isSelected ? `<circle cx="12" cy="12" r="7.5" stroke="#FFFFFF" stroke-width="1.2" stroke-dasharray="2 2"/>` : ''}
      </svg>

      <!-- Multi-Pass Observation Badge -->
      ${obsCount > 1 ? `
        <span style="position: absolute; top: -5px; right: -7px; background: ${color}; color: #FFFFFF; font-family: ui-monospace, monospace; font-size: 9px; font-weight: 800; padding: 1px 4px; border-radius: 9999px; border: 1.5px solid #FFFFFF; line-height: 1; box-shadow: 0 1px 4px rgba(0,0,0,0.25);">
          ${obsCount}x
        </span>
      ` : ''}
    </div>
  `;

  return L.divIcon({
    html: svgHtml,
    className: 'custom-maritime-target-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

/**
 * Controller subcomponent inside MapContainer:
 * 1. Synchronizes map instance reference and zoom state events.
 * 2. Initial auto-zoom: Automatically fits/zooms to detected objects ONCE when placed on the map.
 * 3. Preserves complete user freedom to zoom in/out freely at any time without snap-back.
 * 4. Smoothly pans to selected target when user clicks a marker without changing user's zoom level.
 */
function SurveyViewportController({
  targets = [],
  selectedTarget,
  onZoomChange,
  onMapReady,
  autoZoomKey = null,
  autoZoomInitially = true
}) {
  const map = useMap();
  const lastCenteredIdRef = useRef(null);
  const hasAutoZoomedRef = useRef(false);
  const prevKeyRef = useRef(autoZoomKey);

  useEffect(() => {
    if (onMapReady) onMapReady(map);
  }, [map, onMapReady]);

  useMapEvents({
    zoomend: () => onZoomChange?.(map.getZoom()),
  });

  // Reset initial auto-zoom flag if the mission/layer scope changes
  useEffect(() => {
    if (prevKeyRef.current !== autoZoomKey) {
      prevKeyRef.current = autoZoomKey;
      hasAutoZoomedRef.current = false;
    }
  }, [autoZoomKey]);

  // Initial auto-zoom: ONLY triggers once when detected objects are initially placed on the map
  useEffect(() => {
    if (!map || !autoZoomInitially || hasAutoZoomedRef.current) return;

    const validPoints = [];
    if (targets && targets.length > 0) {
      targets.forEach(t => {
        if (t.latitude != null && t.longitude != null && !isNaN(t.latitude) && !isNaN(t.longitude)) {
          validPoints.push([Number(t.latitude), Number(t.longitude)]);
        }
      });
    }

    if (validPoints.length > 0) {
      hasAutoZoomedRef.current = true;
      if (validPoints.length === 1) {
        // Single target: center and set comfortable zoom level (15)
        map.setView(validPoints[0], 15, { animate: true });
      } else {
        // Multiple targets: fit bounds with padding
        const bounds = L.latLngBounds(validPoints);
        map.fitBounds(bounds, {
          padding: [50, 50],
          maxZoom: 16,
          animate: true
        });
      }
    }
  }, [map, targets, autoZoomInitially]);

  // Smoothly center onto selected target WITHOUT altering or restricting user's chosen zoom level
  useEffect(() => {
    if (!map || !selectedTarget) return;
    const targetId = selectedTarget.target_id || selectedTarget.id;
    if (lastCenteredIdRef.current === targetId) return;
    lastCenteredIdRef.current = targetId;

    if (selectedTarget.latitude != null && selectedTarget.longitude != null) {
      map.panTo([selectedTarget.latitude, selectedTarget.longitude], {
        animate: true,
        duration: 0.5
      });
    }
  }, [map, selectedTarget]);

  return null;
}

export const GISMap = ({ 
  targets = null,
  detections = [], 
  vesselTrack = [], 
  center = null, 
  zoom = null,
  selectedTargetId = null,
  selectedDetectionId = null,
  newlyDetectedTargetId = null,
  onSelectTarget = null,
  onSelectDetection = null,
  onOpenEvidence = null,
  autoZoomKey = null,
  autoZoomInitially = true,
  className = "",
  compact = false
}) => {
  const [mapInstance, setMapInstance] = useState(null);
  const [currentZoom, setCurrentZoom] = useState(() => zoom || MAP_CONFIG.defaultZoom || 13);
  const [selectedBasemapId, setSelectedBasemapId] = useState(() => MAP_CONFIG.basemaps?.[0]?.id || 'osm');
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const layerMenuRef = useRef(null);

  // Close basemap selector menu on click outside
  useEffect(() => {
    const handleLayerClickOutside = (e) => {
      if (layerMenuRef.current && !layerMenuRef.current.contains(e.target)) {
        setShowLayerMenu(false);
      }
    };
    document.addEventListener('mousedown', handleLayerClickOutside);
    return () => document.removeEventListener('mousedown', handleLayerClickOutside);
  }, []);

  // Resolve current active basemap configuration
  const activeBasemap = useMemo(() => {
    const found = (MAP_CONFIG.basemaps || []).find(b => b.id === selectedBasemapId);
    return found || MAP_CONFIG.tileLayer;
  }, [selectedBasemapId]);

  // Consolidate detections into unique physical targets (strictly ONE marker per physical object)
  const physicalTargets = useMemo(() => {
    if (targets && targets.length > 0) {
      return consolidateDetectionsToTargets(
        targets.flatMap(t => t.observations && t.observations.length > 0 ? t.observations : [t])
      );
    }
    return consolidateDetectionsToTargets(detections);
  }, [targets, detections]);

  const activeSelectedId = selectedTargetId || selectedDetectionId;
  const selectedTargetObj = useMemo(() => {
    if (!activeSelectedId) return null;
    return physicalTargets.find(t => 
      (t.target_id || t.id) === activeSelectedId || 
      t.observations?.some(o => o.id === activeSelectedId)
    );
  }, [physicalTargets, activeSelectedId]);

  // Operational Target Area Bounds for Fit-to-Bounds (Manual on-demand action only)
  const targetAreaBounds = useMemo(() => {
    const points = [];
    if (physicalTargets && physicalTargets.length > 0) {
      physicalTargets.forEach(t => {
        if (t.latitude != null && t.longitude != null) {
          points.push([t.latitude, t.longitude]);
        }
      });
    }
    if (points.length === 0) return null;
    return L.latLngBounds(points);
  }, [physicalTargets]);

  // Calculate default center without forcing strict zoom
  const initialCenter = useMemo(() => {
    if (center) return center;
    if (physicalTargets && physicalTargets.length > 0) {
      const validLats = physicalTargets.filter(t => t.latitude != null).map(t => t.latitude);
      const validLons = physicalTargets.filter(t => t.longitude != null).map(t => t.longitude);
      if (validLats.length > 0 && validLons.length > 0) {
        return [
          validLats.reduce((a, b) => a + b, 0) / validLats.length,
          validLons.reduce((a, b) => a + b, 0) / validLons.length
        ];
      }
    }
    return MAP_CONFIG.defaultCenter;
  }, [center, physicalTargets]);

  const initialZoom = zoom || MAP_CONFIG.defaultZoom || 13;

  const handleMarkerClick = (tgt) => {
    if (onSelectTarget) onSelectTarget(tgt);
    if (onSelectDetection) onSelectDetection(tgt);
  };

  const handleFitSurveyArea = () => {
    if (mapInstance && targetAreaBounds) {
      mapInstance.fitBounds(targetAreaBounds, {
        padding: [50, 50],
        maxZoom: 16
      });
    }
  };

  return (
    <div className={`w-full h-full ${compact ? 'min-h-[220px]' : 'min-h-[320px]'} rounded-xl border border-[#1E3154] overflow-hidden relative bg-[#070C18] ${className}`}>
      <style>{sonarRadarStyles}</style>
      
      <MapContainer 
        center={initialCenter} 
        zoom={initialZoom}
        minZoom={MAP_CONFIG.minZoom || 2}
        maxZoom={MAP_CONFIG.maxZoom || 19}
        scrollWheelZoom={true} 
        doubleClickZoom={true}
        zoomControl={false}
        style={{ width: '100%', height: '100%', background: '#050914' }}
      >
        <SurveyViewportController 
          targets={physicalTargets}
          selectedTarget={selectedTargetObj}
          onZoomChange={setCurrentZoom} 
          onMapReady={setMapInstance} 
          autoZoomKey={autoZoomKey}
          autoZoomInitially={autoZoomInitially}
        />

        {/* 1. Dynamic High-Resolution Basemap Layer */}
        <TileLayer
          key={activeBasemap.id || activeBasemap.name}
          attribution={activeBasemap.attribution}
          url={activeBasemap.url}
          maxZoom={activeBasemap.maxZoom || 19}
          maxNativeZoom={activeBasemap.maxNativeZoom || 18}
        />

        {/* 2. STRICTLY ONE PHYSICAL TARGET = ONE GIS MARKER (No clustering hiding targets) */}
        {physicalTargets.map((tgt) => {
          const targetId = tgt.target_id || tgt.id;
          const isSelected = activeSelectedId === targetId || 
            tgt.observations?.some(o => o.id === activeSelectedId);
          const isNew = newlyDetectedTargetId === targetId;
          const targetClass = tgt.class || tgt.category || 'debris_net';
          const classLabel = formatClassLabel(targetClass);
          const status = tgt.status || tgt.human_review_status || 'pending_review';
          const obsCount = tgt.observation_count || tgt.observations?.length || 1;
          const icon = createPhysicalTargetIcon(status, isSelected, isNew, obsCount);

          const conf = tgt.fused_confidence ?? tgt.confidence ?? 0.85;
          const formattedConf = formatConfidence(conf);
          const formattedSize = formatSize(tgt.estimated_size_m || 3.0);
          const imageSrc = tgt.sonar_image_ref || null;

          return (
            <Marker 
              key={targetId} 
              position={[tgt.latitude, tgt.longitude]} 
              icon={icon}
              zIndexOffset={isSelected ? 600 : (isNew ? 550 : 200)}
              eventHandlers={{
                click: () => handleMarkerClick(tgt)
              }}
            >
              <Popup className="maritime-popup" autoPan={false}>
                <div className="p-3 min-w-[250px] select-none text-xs font-sans space-y-2 bg-[#0D1527] text-[#F8FAFC] border border-[#1E3154] rounded-lg">
                  
                  {/* Popup Header */}
                  <div className="flex items-center justify-between border-b border-[#1E3154] pb-1.5 font-mono">
                    <div>
                      <span className="text-[8px] text-[#06B6D4] font-bold uppercase tracking-wider block">PHYSICAL TARGET</span>
                      <span className="font-black text-white text-sm">{targetId}</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${
                      status === 'confirmed' || status === 'verified' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60' :
                      status === 'rejected' ? 'bg-red-950/80 text-red-400 border-red-700/60' : 'bg-amber-950/80 text-amber-400 border-amber-700/60'
                    }`}>
                      {status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Sonar Evidence Thumbnail & Identification */}
                  <div className="flex gap-2.5 items-center">
                    <div className="w-16 h-14 bg-black rounded overflow-hidden shrink-0 border border-[#1E3154] flex items-center justify-center">
                      {imageSrc ? (
                        <img
                          src={imageSrc}
                          alt={classLabel}
                          className="w-full h-full object-cover contrast-125"
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="text-[8px] font-mono text-slate-500 font-bold">N/A</span>
                      )}
                    </div>
                    <div className="font-mono">
                      <h4 className="font-bold text-white text-xs">{classLabel}</h4>
                      <p className="text-[10px] text-emerald-400 font-bold mt-0.5">Conf: {formattedConf}</p>
                      <p className="text-[10px] text-[#94A3B8]">Est. Size: {formattedSize}</p>
                    </div>
                  </div>

                  {/* Exact Coordinates */}
                  <div className="bg-[#070C18] p-1.5 rounded border border-[#1E3154] text-[10px] font-mono space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">LAT:</span>
                      <span className="font-bold text-white">{tgt.latitude?.toFixed(5)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#94A3B8]">LON:</span>
                      <span className="font-bold text-white">{tgt.longitude?.toFixed(5)}°</span>
                    </div>
                  </div>

                  {/* Inspect Button opening full sonar evidence viewer */}
                  <button 
                    onClick={() => {
                      if (onOpenEvidence) {
                        onOpenEvidence(tgt);
                      } else {
                        handleMarkerClick(tgt);
                      }
                    }}
                    className="w-full py-1.5 px-3 bg-[#0284C7] hover:bg-[#0369A1] text-white rounded text-xs font-mono font-bold text-center transition flex items-center justify-center gap-1.5 shadow-[0_0_10px_rgba(2,132,199,0.3)] cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Open Full Sonar Evidence &rarr;
                  </button>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Controls: Zoom Controls, Basemap Layer Switcher & Fit Targets */}
      <div className={`absolute ${compact ? 'top-2 right-2 gap-1.5' : 'top-4 right-4 gap-2'} z-[1000] flex items-center`} ref={layerMenuRef}>
        {/* Manual Zoom Controls: [+] [Zoom Level] [-] */}
        <div className="flex items-center bg-white/95 backdrop-blur rounded-2xl shadow-lg border border-[#E9EDF7] p-0.5">
          <button
            onClick={() => mapInstance?.zoomIn()}
            className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} flex items-center justify-center text-[#1B2559] hover:bg-[#F4F7FB] hover:text-[#0284C7] rounded-xl transition cursor-pointer font-bold`}
            title="Zoom In (+)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <span className={`${compact ? 'text-[9px] px-1 min-w-[24px]' : 'text-[10px] px-1.5 min-w-[28px]'} font-mono font-bold text-[#64748B] text-center select-none`}>
            {Math.round(currentZoom)}x
          </span>
          <button
            onClick={() => mapInstance?.zoomOut()}
            className={`${compact ? 'w-6 h-6' : 'w-7 h-7'} flex items-center justify-center text-[#1B2559] hover:bg-[#F4F7FB] hover:text-[#0284C7] rounded-xl transition cursor-pointer font-bold`}
            title="Zoom Out (-)"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Basemap Switcher Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(prev => !prev)}
            className={`bg-white/95 hover:bg-white text-[#1B2559] ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} rounded-2xl shadow-lg border border-[#E9EDF7] transition flex items-center gap-1.5 font-extrabold cursor-pointer`}
            title="Switch Map Tile Source (OpenStreetMap, Maritime Topo, Satellite Recon, Esri Bathymetry)"
          >
            <Layers className="w-3.5 h-3.5 text-[#0284C7]" />
            <span>{activeBasemap.name}</span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-2xl shadow-xl border border-[#E5EDF5] py-1.5 z-50 animate-arrival text-xs">
              <div className="px-3 py-1 text-[10px] font-mono font-bold text-[#64748B] border-b border-[#F1F5F9] uppercase tracking-wider">
                Select Basemap Layer
              </div>
              {(MAP_CONFIG.basemaps || []).map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => {
                    setSelectedBasemapId(layer.id);
                    setShowLayerMenu(false);
                  }}
                  className={`w-full px-3 py-1.5 text-left flex items-center justify-between hover:bg-[#F4F7FB] transition cursor-pointer ${
                    selectedBasemapId === layer.id ? 'font-bold text-[#026AA7] bg-[#EAF2FD]/60' : 'text-[#334155]'
                  }`}
                >
                  <span>{layer.name}</span>
                  {selectedBasemapId === layer.id && (
                    <Check className="w-3.5 h-3.5 text-[#0284C7]" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Fit Active Targets */}
        <button
          onClick={handleFitSurveyArea}
          className={`bg-white/95 hover:bg-white text-[#1B2559] ${compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'} rounded-2xl shadow-lg border border-[#E9EDF7] transition flex items-center gap-1.5 font-extrabold cursor-pointer`}
          title="Fit Map to Active Targets"
        >
          <Maximize2 className="w-3.5 h-3.5 text-[#5E56E7]" />
          <span>Fit Targets</span>
        </button>
      </div>

      {/* Target Status Legend */}
      {!compact && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white/95 backdrop-blur px-3.5 py-1.5 rounded-2xl border border-[#E9EDF7] text-[10px] font-sans text-[#1B2559] flex items-center gap-3 shadow-soft font-bold">
          <span className="flex items-center gap-1 text-[#059669]">
            <span className="w-2 h-2 rounded-full bg-[#059669]"></span> Verified
          </span>
          <span className="flex items-center gap-1 text-[#D97706]">
            <span className="w-2 h-2 rounded-full bg-[#D97706]"></span> Pending
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <span className="w-2 h-2 rounded-full bg-[#FF4769]"></span> Rejected
          </span>
        </div>
      )}
    </div>
  );
};

export default GISMap;
