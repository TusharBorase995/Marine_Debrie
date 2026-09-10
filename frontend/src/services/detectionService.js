import axios from 'axios';

const API_BASE = '/api/detections';

export const detectionService = {
  async getAll(params = {}) {
    const res = await axios.get(API_BASE, { params });
    return res.data;
  },

  async getConsolidatedTargets(params = {}) {
    const res = await axios.get(`${API_BASE}/targets`, { params });
    return res.data;
  },

  async getById(detectionId) {
    const res = await axios.get(`${API_BASE}/${detectionId}`);
    return res.data;
  },

  async createDetection(payload) {
    const res = await axios.post(API_BASE, payload);
    return res.data;
  },

  async review(detectionId, action) {
    const res = await axios.post(`${API_BASE}/${detectionId}/review`, { action });
    return res.data;
  }
};

export default detectionService;
