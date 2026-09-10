import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import missionService from '../services/missionService';
import { useWebSocket } from '../hooks/useWebSocket';

const MissionContext = createContext(null);

export const MissionProvider = ({ children }) => {
  const [missions, setMissions] = useState([]);
  const [selectedMissionId, setSelectedMissionId] = useState(() => {
    return localStorage.getItem('sonar_active_mission_id') || 'ALL';
  });
  const [selectedTargetId, setSelectedTargetId] = useState(null);
  const [loadingMissions, setLoadingMissions] = useState(true);
  const [error, setError] = useState(null);

  // Live PostgreSQL connection health status
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

  const checkDbHealth = async () => {
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
  };

  useEffect(() => {
    checkDbHealth();
    const interval = setInterval(checkDbHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  // Listen to WebSocket events to sync mission and target updates in real time
  const { data: wsData } = useWebSocket('/ws/live-feed');

  const fetchMissions = async () => {
    try {
      setLoadingMissions(true);
      setError(null);
      const data = await missionService.getAll();
      const validMissions = Array.isArray(data) ? data : [];
      setMissions(validMissions);
      
      // If missions exist, verify selected exists, else default to 'ALL' or first
      if (validMissions.length > 0) {
        const exists = validMissions.some(m => m.mission_id === selectedMissionId);
        if (!exists && selectedMissionId !== 'ALL') {
          setSelectedMissionId(validMissions[0].mission_id);
          localStorage.setItem('sonar_active_mission_id', validMissions[0].mission_id);
        }
      } else {
        setSelectedMissionId('ALL');
      }
    } catch (err) {
      console.error('Failed to fetch missions:', err);
      setError('Unable to load survey missions');
      checkDbHealth();
    } finally {
      setLoadingMissions(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  // Save selected mission preference
  const changeSelectedMission = (id) => {
    setSelectedMissionId(id);
    if (id) {
      localStorage.setItem('sonar_active_mission_id', id);
    }
  };

  // Real-time updates from WebSocket
  useEffect(() => {
    if (!wsData) return;

    if (
      wsData.type === 'MISSION_IMPORTED' || 
      wsData.type === 'MISSION_DELETED' || 
      wsData.type === 'DETECTIONS_RESET'
    ) {
      fetchMissions();
    }
  }, [wsData]);

  // Create new mission (mandatory PostgreSQL write)
  const createMission = async (payload) => {
    try {
      const isConnected = await checkDbHealth();
      if (!isConnected) {
        throw new Error("Database Offline: PostgreSQL service ('sonar_db') is not active or unreachable. Please verify your PostgreSQL service is running.");
      }
      const createFn = missionService.createMission || missionService.create;
      const newMission = await createFn.call(missionService, payload);
      await fetchMissions();
      if (newMission && newMission.mission_id) {
        changeSelectedMission(newMission.mission_id);
      }
      return newMission;
    } catch (err) {
      checkDbHealth();
      throw err;
    }
  };

  // Delete mission (mandatory PostgreSQL delete)
  const deleteMission = async (missionId) => {
    try {
      const isConnected = await checkDbHealth();
      if (!isConnected) {
        throw new Error("Database Offline: PostgreSQL service ('sonar_db') is not active or unreachable. Please verify your PostgreSQL service is running.");
      }
      const deleteFn = missionService.deleteMission || missionService.delete;
      await deleteFn.call(missionService, missionId);
      await fetchMissions();
      if (selectedMissionId === missionId) {
        changeSelectedMission('ALL');
      }
    } catch (err) {
      checkDbHealth();
      throw err;
    }
  };

  // The active mission object (or null if 'ALL')
  const selectedMission = selectedMissionId === 'ALL'
    ? null
    : missions.find(m => m.mission_id === selectedMissionId) || null;

  return (
    <MissionContext.Provider
      value={{
        missions,
        selectedMissionId,
        selectedMission,
        setSelectedMissionId: changeSelectedMission,
        selectedTargetId,
        setSelectedTargetId,
        loadingMissions,
        refreshMissions: fetchMissions,
        createMission,
        deleteMission,
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
