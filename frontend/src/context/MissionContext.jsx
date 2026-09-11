import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import missionService from '../services/missionService';
import targetService from '../services/targetService';
import detectionService from '../services/detectionService';
import mapService from '../services/mapService';
import exportService from '../services/exportService';
import surveyService from '../services/surveyService';
import { useWebSocket } from '../hooks/useWebSocket';
import { formatClassLabel } from '../utils/formatters';

const MissionContext = createContext(null);

export const MissionProvider = ({ children }) => {
  // 1. Mission Selection State
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState(() => {
    return localStorage.getItem('sonar_active_mission_id') || 'ALL';
  });
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [error, setError] = useState(null);

  // 2. Global In-Memory Caches (Zero-Lag Navigation)
  const [targets, setTargets] = useState([]);
  const [detections, setDetections] = useState([]);
  const [vesselTrack, setVesselTrack] = useState([]);
  const [vesselTelemetry, setVesselTelemetry] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [reportsCache, setReportsCache] = useState({});
  const [surveyDetailCache, setSurveyDetailCache] = useState({});

  // 3. Cache Hydration & Freshness Status
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdatedTime, setLastUpdatedTime] = useState(() => {
    return new Date().toUTCString().replace('GMT', 'UTC');
  });
  const dataLoadedRef = useRef(false);

  // 4. Live PostgreSQL Health Status
  const [dbStatus, setDbStatus] = useState({
    connected: false,
    checking: true,
    engine: 'postgresql',
    databaseName: 'sonar_db',
    version: null,
    port: 5432,
    error: null,
    lastChecked: null,
  });

  const checkDbHealth = useCallback(async () => {
    try {
      setDbStatus(prev => ({ ...prev, checking: true }));
      const res = await axios.get('/api/health');
      const dbInfo = res.data?.database || {};
      const isConnected = dbInfo.status === 'connected';
      setDbStatus({
        connected: isConnected,
        checking: false,
        engine: dbInfo.engine || 'postgresql',
        databaseName: dbInfo.database_name || 'sonar_db',
        version: dbInfo.version || null,
        port: dbInfo.server_port || 5432,
        error: isConnected ? null : (dbInfo.error || 'PostgreSQL service is offline'),
        lastChecked: new Date().toISOString()
      });
      return isConnected;
    } catch (err) {
      setDbStatus({
        connected: false,
        checking: false,
        engine: 'postgresql',
        databaseName: 'sonar_db',
        version: null,
        port: 5432,
        error: err.response?.data?.database?.error || err.message || 'API or PostgreSQL service unreachable',
        lastChecked: new Date().toISOString()
      });
      return false;
    }
  }, []);

  useEffect(() => {
    checkDbHealth();
    const interval = setInterval(checkDbHealth, 15000);
    return () => clearInterval(interval);
  }, [checkDbHealth]);

  // 5. Centralized Data Hydration & Silent Background Revalidation (SWR)
  const refreshData = useCallback(async ({ silent = true, force = false } = {}) => {
    if (!silent && !dataLoadedRef.current) {
      setIsInitialLoading(true);
    }
    setIsRefreshing(true);

    try {
      const [targetsRes, detectionsRes, missionsRes, trackRes, telemetryRes, healthRes] = await Promise.allSettled([
        targetService.getAll(),
        detectionService.getAll(),
        missionService.getAll(),
        mapService.getVesselTrack(),
        mapService.getVesselTelemetry(),
        axios.get('/api/health')
      ]);

      if (targetsRes.status === 'fulfilled' && Array.isArray(targetsRes.value)) {
        setTargets(targetsRes.value);
      }
      if (detectionsRes.status === 'fulfilled' && Array.isArray(detectionsRes.value)) {
        setDetections(detectionsRes.value);
      }
      if (missionsRes.status === 'fulfilled' && Array.isArray(missionsRes.value)) {
        const validMissions = missionsRes.value;
        setMissions(validMissions);
        if (validMissions.length > 0) {
          const exists = validMissions.some(m => m.mission_id === selectedMissionId);
          if (!exists && selectedMissionId !== 'ALL') {
            setSelectedMissionId(validMissions[0].mission_id);
            localStorage.setItem('sonar_active_mission_id', validMissions[0].mission_id);
          }
        }
      }
      if (trackRes.status === 'fulfilled') {
        const points = Array.isArray(trackRes.value) ? trackRes.value : (trackRes.value?.track_points || []);
        setVesselTrack(points);
      }
      if (telemetryRes.status === 'fulfilled' && telemetryRes.value) {
        setVesselTelemetry(telemetryRes.value);
      }
      if (healthRes.status === 'fulfilled' && healthRes.value?.data) {
        setHealthData(healthRes.value.data);
        const dbInfo = healthRes.value.data.database || {};
        const isConnected = dbInfo.status === 'connected';
        setDbStatus({
          connected: isConnected,
          checking: false,
          engine: dbInfo.engine || 'postgresql',
          databaseName: dbInfo.database_name || 'sonar_db',
          version: dbInfo.version || null,
          port: dbInfo.server_port || 5432,
          error: isConnected ? null : (dbInfo.error || 'PostgreSQL service is offline'),
          lastChecked: new Date().toISOString()
        });
      }

      dataLoadedRef.current = true;
      setLastUpdatedTime(new Date().toUTCString().replace('GMT', 'UTC'));
    } catch (err) {
      console.error('Failed to sync in-memory cache:', err);
      setError('Acoustic data sync encounter.');
    } finally {
      setIsInitialLoading(false);
      setLoadingMissions(false);
      setIsRefreshing(false);
    }
  }, [selectedMissionId]);

  // Initial fetch on application boot
  useEffect(() => {
    refreshData({ silent: false });
  }, []);

  // 6. Real-Time WebSocket Live Feed Integration (Keep Memory 100% In Sync)
  const { data: wsData } = useWebSocket('/ws/live-feed');

  useEffect(() => {
    if (!wsData) return;

    const now = new Date();
    setLastUpdatedTime(now.toUTCString().replace('GMT', 'UTC'));

    // A. Real-time detection ingestion (via Postman, ML inference stream, or batch import)
    if (wsData.type === 'NEW_DETECTION' && wsData.data) {
      const newDet = wsData.data;
      const targetId = newDet.target_id || newDet.id;

      // Update detections array
      setDetections(prev => [newDet, ...prev.filter(d => d.id !== newDet.id)]);

      // Update or insert into targets array
      setTargets(prev => {
        const existingIdx = prev.findIndex(t => (t.target_id || t.id) === targetId);
        if (existingIdx >= 0) {
          const updated = { ...prev[existingIdx] };
          const obs = updated.observations || [];
          updated.observations = [newDet, ...obs.filter(o => o.id !== newDet.id)];
          updated.observation_count = updated.observations.length;
          updated.confidence = newDet.confidence;
          updated.fused_confidence = newDet.confidence;
          updated.sonar_image_ref = newDet.sonar_image_ref || updated.sonar_image_ref;
          updated.shadow_verified = Boolean(newDet.shadow_verified);
          const copy = [...prev];
          copy[existingIdx] = updated;
          return copy;
        } else {
          const newTarget = {
            target_id: targetId,
            id: targetId,
            class: newDet.class,
            category: newDet.class,
            label: newDet.target_label || formatClassLabel(newDet.class),
            latitude: newDet.latitude,
            longitude: newDet.longitude,
            estimated_size_m: newDet.estimated_size_m,
            shadow_verified: Boolean(newDet.shadow_verified),
            status: newDet.status || 'pending_review',
            human_review_status: newDet.status || 'pending_review',
            confidence: newDet.confidence,
            fused_confidence: newDet.confidence,
            observation_count: 1,
            sonar_image_ref: newDet.sonar_image_ref,
            mission_id: newDet.mission_id || 'MISSION-LIVE',
            observations: [newDet]
          };
          return [newTarget, ...prev];
        }
      });
      return;
    }

    // B. Target review status update
    if (wsData.type === 'TARGET_REVIEWED' && wsData.data) {
      const { target_id, status } = wsData.data;
      setTargets(prev => prev.map(t => 
        (t.target_id === target_id || t.id === target_id) 
          ? { ...t, status, human_review_status: status } 
          : t
      ));
      setDetections(prev => prev.map(d => 
        (d.target_id === target_id || d.id === target_id) 
          ? { ...d, status, human_review_status: status } 
          : d
      ));
      return;
    }

    // C. Single target deletion
    if (wsData.type === 'TARGET_DELETED' && wsData.data) {
      const { target_id } = wsData.data;
      setTargets(prev => prev.filter(t => (t.target_id || t.id) !== target_id));
      setDetections(prev => prev.filter(d => (d.target_id || d.id) !== target_id));
      setSelectedTargetId(prev => (prev === target_id ? null : prev));
      return;
    }

    // D. Detections cleared or reset
    if (wsData.type === 'ALL_DETECTIONS_CLEARED') {
      setTargets([]);
      setDetections([]);
      setSelectedTargetId(null);
      return;
    }

    // E. Batch ingestion or reset
    if (
      wsData.type === 'DETECTIONS_RESET' || 
      wsData.type === 'MISSION_IMPORTED' || 
      wsData.type === 'BATCH_LOADED'
    ) {
      refreshData({ silent: true });
      return;
    }

    // F. Mission activation/deactivation
    if (wsData.type === 'MISSION_ACTIVATED' && wsData.data?.mission_id) {
      setSelectedMissionId(wsData.data.mission_id);
      localStorage.setItem('sonar_active_mission_id', wsData.data.mission_id);
      refreshData({ silent: true });
    } else if (wsData.type === 'MISSION_DEACTIVATED') {
      setSelectedMissionId('ALL');
      localStorage.setItem('sonar_active_mission_id', 'ALL');
      refreshData({ silent: true });
    } else if (wsData.type === 'MISSION_DELETED') {
      refreshData({ silent: true });
    }
  }, [wsData, refreshData]);

  // 7. Optimistic Action Handlers (Zero-Lag UI Updates)
  const reviewTarget = useCallback(async (targetId, action) => {
    const newStatus = action === 'confirm' ? 'confirmed' : (action === 'reject' ? 'rejected' : 'pending_review');

    // Instant local memory update
    setTargets(prev => prev.map(t => 
      (t.target_id === targetId || t.id === targetId) 
        ? { ...t, status: newStatus, human_review_status: newStatus } 
        : t
    ));
    setDetections(prev => prev.map(d => 
      (d.target_id === targetId || d.id === targetId) 
        ? { ...d, status: newStatus, human_review_status: newStatus } 
        : d
    ));

    // Async database update
    try {
      await detectionService.review(targetId, action);
    } catch (err) {
      console.error('Failed to commit target review to PostgreSQL:', err);
      // Rollback via background revalidation
      refreshData({ silent: true });
      throw err;
    }
  }, [refreshData]);

  const deleteTarget = useCallback(async (targetId) => {
    // Instant local memory update
    setTargets(prev => prev.filter(t => (t.target_id || t.id) !== targetId));
    setDetections(prev => prev.filter(d => (d.target_id || d.id) !== targetId));
    setSelectedTargetId(prev => (prev === targetId ? null : prev));

    // Async database delete
    try {
      await detectionService.delete(targetId);
    } catch (err) {
      console.error('Failed to delete target from PostgreSQL:', err);
      refreshData({ silent: true });
      throw err;
    }
  }, [refreshData]);

  // 8. Mission Analysis Cached Loader
  const getMissionReport = useCallback(async (missionId, force = false) => {
    if (!force && reportsCache[missionId]) {
      // Trigger silent background revalidation
      exportService.getMissionAnalysis(missionId)
        .then(fresh => setReportsCache(prev => ({ ...prev, [missionId]: fresh })))
        .catch(() => {});
      return reportsCache[missionId];
    }

    const data = await exportService.getMissionAnalysis(missionId);
    setReportsCache(prev => ({ ...prev, [missionId]: data }));
    return data;
  }, [reportsCache]);

  // 9. Survey Detail Cached Loader
  const getSurveyDetail = useCallback(async (surveyId, force = false) => {
    if (!force && surveyDetailCache[surveyId]) {
      // Trigger silent background revalidation
      Promise.all([
        surveyService.getById(surveyId),
        detectionService.getAll({ survey_id: surveyId })
      ]).then(([surveyData, detectionData]) => {
        setSurveyDetailCache(prev => ({ ...prev, [surveyId]: { survey: surveyData, detections: detectionData } }));
      }).catch(() => {});
      return surveyDetailCache[surveyId];
    }

    const [surveyData, detectionData] = await Promise.all([
      surveyService.getById(surveyId),
      detectionService.getAll({ survey_id: surveyId })
    ]);
    const bundle = { survey: surveyData, detections: detectionData };
    setSurveyDetailCache(prev => ({ ...prev, [surveyId]: bundle }));
    return bundle;
  }, [surveyDetailCache]);

  // 10. Mission Management Actions
  const changeSelectedMission = async (id) => {
    setSelectedMissionId(id);
    if (id && id !== 'ALL') {
      localStorage.setItem('sonar_active_mission_id', id);
      try {
        await missionService.setActive(id);
      } catch (err) {
        console.warn('Failed to sync active mission with server:', err);
      }
    } else {
      localStorage.setItem('sonar_active_mission_id', 'ALL');
      try {
        await missionService.deactivate();
      } catch (err) {
        console.warn('Failed to deactivate active mission on server:', err);
      }
    }
  };

  const createMission = async (payload) => {
    try {
      const isConnected = await checkDbHealth();
      if (!isConnected) {
        throw new Error("Database Offline: PostgreSQL service ('sonar_db') is not active or unreachable. Please verify your PostgreSQL service is running.");
      }
      const createFn = missionService.createMission || missionService.create;
      const newMission = await createFn.call(missionService, payload);
      await refreshData({ silent: true });
      if (newMission && newMission.mission_id) {
        changeSelectedMission(newMission.mission_id);
      }
      return newMission;
    } catch (err) {
      checkDbHealth();
      throw err;
    }
  };

  const deleteMission = async (missionId) => {
    try {
      const isConnected = await checkDbHealth();
      if (!isConnected) {
        throw new Error("Database Offline: PostgreSQL service ('sonar_db') is not active or unreachable. Please verify your PostgreSQL service is running.");
      }
      const deleteFn = missionService.deleteMission || missionService.delete;
      await deleteFn.call(missionService, missionId);
      await refreshData({ silent: true });
      if (selectedMissionId === missionId) {
        changeSelectedMission('ALL');
      }
    } catch (err) {
      checkDbHealth();
      throw err;
    }
  };

  const selectedMission = selectedMissionId === 'ALL'
    ? null
    : missions.find(m => m.mission_id === selectedMissionId) || null;

  return (
    <MissionContext.Provider
      value={{
        // Mission state
        missions,
        selectedMissionId,
        selectedMission,
        setSelectedMissionId: changeSelectedMission,
        selectedTargetId,
        setSelectedTargetId,
        loadingMissions,
        refreshMissions: () => refreshData({ silent: true }),
        createMission,
        deleteMission,

        // Cached entities (Zero-lag rendering across all pages)
        targets,
        setTargets,
        detections,
        setDetections,
        vesselTrack,
        vesselTelemetry,
        healthData,
        reportsCache,
        getMissionReport,
        surveyDetailCache,
        getSurveyDetail,

        // SWR Status
        isInitialLoading,
        isRefreshing,
        lastUpdatedTime,
        refreshData,

        // Optimistic action helpers
        reviewTarget,
        deleteTarget,

        // DB & Network Health
        error,
        dbStatus,
        checkDbHealth
      }}
    >
      {children}
    </MissionContext.Provider>
  );
};

export const useMission = () => {
  const context = useContext(MissionContext);
  if (!context) {
    throw new Error('useMission must be used within a MissionProvider');
  }
  return context;
};

export default MissionContext;
