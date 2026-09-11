import axios from 'axios';

const AUTH_BASE = '/api/auth';

export const authService = {
  async register({ email, password, fullName, role }) {
    const res = await axios.post(`${AUTH_BASE}/register`, {
      email,
      password,
      full_name: fullName || 'Marine Specialist',
      role: role || 'Lead Marine Analyst'
    });
    return res.data;
  },

  async login({ email, password, role }) {
    const res = await axios.post(`${AUTH_BASE}/login`, {
      email,
      password,
      role
    });
    return res.data;
  },

  async getProfile() {
    const res = await axios.get(`${AUTH_BASE}/me`);
    return res.data;
  },

  async deleteAccount() {
    const res = await axios.delete(`${AUTH_BASE}/account`);
    return res.data;
  }
};

export default authService;
