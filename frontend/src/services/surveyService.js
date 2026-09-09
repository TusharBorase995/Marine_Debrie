import axios from 'axios';

const API_BASE = '/api/surveys';

export const surveyService = {
  async getAll() {
    const res = await axios.get(API_BASE);
    return res.data;
  },

  async getById(surveyId) {
    const res = await axios.get(`${API_BASE}/${surveyId}`);
    return res.data;
  },

  async create(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(API_BASE, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  async delete(surveyId) {
    const res = await axios.delete(`${API_BASE}/${surveyId}`);
    return res.data;
  }
};

export default surveyService;
