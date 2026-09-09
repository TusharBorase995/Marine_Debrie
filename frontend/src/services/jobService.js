import axios from 'axios';

export const jobService = {
  async startProcess(surveyId) {
    const res = await axios.post(`/api/surveys/${surveyId}/process`);
    return res.data;
  },

  async getJobStatus(jobId) {
    const res = await axios.get(`/api/jobs/${jobId}`);
    return res.data;
  },

  async getJobEvents(jobId) {
    const res = await axios.get(`/api/jobs/${jobId}/events`);
    return res.data;
  }
};

export default jobService;
