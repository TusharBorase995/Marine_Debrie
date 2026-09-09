import axios from 'axios';

const API_BASE = '/api/missions';

export const missionService = {
  async getAll() {
    const res = await axios.get(API_BASE);
    return res.data;
  },

  async getById(missionId) {
    const res = await axios.get(`${API_BASE}/${missionId}`);
    return res.data;
  },

  async getDetections(missionId) {
    const res = await axios.get(`${API_BASE}/${missionId}/detections`);
    return res.data;
  },

  async createMission(payload) {
    const res = await axios.post(API_BASE, payload);
    return res.data;
  },

  async importBatch(missionId, data, isFormData = false) {
    const headers = isFormData ? { 'Content-Type': 'multipart/form-data' } : { 'Content-Type': 'application/json' };
    const res = await axios.post(`${API_BASE}/${missionId}/import`, data, { headers });
    return res.data;
  },

  async deleteMission(missionId) {
    const res = await axios.delete(`${API_BASE}/${missionId}`);
    return res.data;
  },

  // Aliases for compatibility
  create(payload) {
    return this.createMission(payload);
  },

  delete(missionId) {
    return this.deleteMission(missionId);
  },

  getExportUrl(missionId, format = 'json') {
    return `${API_BASE}/${missionId}/export?format=${format}`;
  }
};

export default missionService;
