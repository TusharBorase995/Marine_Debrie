/**
 * Isolated Basemap & Survey Map Configuration
 * 
 * Provides isolated tile sources for development, hydrographic operations,
 * and offline/local tile substitution without altering map components.
 */

export const MAP_CONFIG = {
  // Operational Center: Default to Indian Maritime Waters / Arabian Sea & Mumbai Offshore
  defaultCenter: [18.9500, 72.8500],
  defaultZoom: 13,
  minZoom: 2,
  maxZoom: 19,

  // Primary Default Basemap: OpenStreetMap Standard (100% full coverage worldwide and across all oceans, zero missing data or error watermarks)
  tileLayer: {
    id: 'osm',
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    maxNativeZoom: 19,
  },

  // High-Resolution Satellite Basemap (Aerial Reconnaissance)
  satelliteTileLayer: {
    id: 'satellite',
    name: 'Satellite Recon',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Sources: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
    maxNativeZoom: 12,
  },

  // Topographic & Coastal Nav Basemap
  topoTileLayer: {
    id: 'topo',
    name: 'Maritime Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Sources: USGS, FAO, NPS, NRCAN, GeoBase, IGN, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
    maxZoom: 19,
    maxNativeZoom: 12,
  },

  // Deep Ocean Bathymetric (Esri Ocean - Native sounding up to zoom 10, auto-scaled above)
  oceanTileLayer: {
    id: 'ocean',
    name: 'Bathymetry (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, IHO, Garmin',
    maxZoom: 16,
    maxNativeZoom: 10,
  },

  // Available Basemaps for Interactive Layer Switcher
  basemaps: [
    {
      id: 'osm',
      name: 'OpenStreetMap',
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      maxNativeZoom: 19,
    },
    {
      id: 'topo',
      name: 'Maritime Topo',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; USGS, NOAA, Esri Topo',
      maxZoom: 19,
      maxNativeZoom: 12,
    },
    {
      id: 'satellite',
      name: 'Satellite Recon',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri &mdash; World Imagery Satellite',
      maxZoom: 18,
      maxNativeZoom: 12,
    },
    {
      id: 'ocean',
      name: 'Esri Bathymetry',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri World Ocean',
      maxZoom: 16,
      maxNativeZoom: 10,
    }
  ],

  // Offline / Disconnected Vessel Operations Tile Template
  offlineTileLayer: {
    name: 'Local Offline Tile Server',
    url: '/tiles/{z}/{x}/{y}.png',
    attribution: 'Local Marine Bathymetric Cache',
    maxZoom: 16,
  },

  // Survey Vessel Specifications
  surveyVessel: {
    name: 'R/V HYDRO-EXPLORER',
    surveyId: 'OFFSHORE-001',
    status: 'Surveying',
    defaultSpeedKnots: 4.2,
    swathWidthMeters: 100.0,
  },

  // Acoustic Survey Swath Ribbon Styling (100m wide side-scan swath strips along survey lines)
  swathRibbonStyle: {
    color: '#38BDF8',
    weight: 1.2,
    dashArray: '4, 4',
    fillColor: '#0284C7',
    fillOpacity: 0.18,
  },

  // Overall Survey Area Boundary Styling
  swathStyle: {
    color: '#0EA5E9',
    weight: 1.5,
    dashArray: '6, 6',
    fillColor: '#0EA5E9',
    fillOpacity: 0.05,
  },

  // Vessel Track Polyline Styling with high contrast
  trackStyle: {
    color: '#4F46E5',
    weight: 3.5,
    dashArray: '7, 7',
    opacity: 0.95,
  }
};

export default MAP_CONFIG;
