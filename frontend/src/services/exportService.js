import axios from 'axios';

export const exportService = {
  /**
   * Fetches deterministic operational analysis for live preview.
   */
  async getMissionAnalysis(missionId) {
    const url = missionId 
      ? `/api/missions/${missionId}/analysis` 
      : '/api/reports/analysis';
    const res = await axios.get(url);
    return res.data;
  },

  /**
   * Downloads Operational Mission PDF Report.
   */
  async downloadPDF(missionId) {
    const url = missionId 
      ? `/api/missions/${missionId}/export?format=pdf` 
      : '/api/reports/export?format=pdf';
    
    const response = await axios.get(url, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    // Extract filename from header or use default
    const contentDisposition = response.headers['content-disposition'];
    let filename = `${missionId || 'Survey'}_Operational_Report.pdf`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  },

  /**
   * Downloads Operational Mission Multi-Sheet Excel Report.
   */
  async downloadExcel(missionId) {
    const url = missionId 
      ? `/api/missions/${missionId}/export?format=excel` 
      : '/api/reports/export?format=excel';
    
    const response = await axios.get(url, { 
      responseType: 'blob',
      headers: { 'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    });
    
    const blob = new Blob([response.data], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    
    const contentDisposition = response.headers['content-disposition'];
    let filename = `${missionId || 'Survey'}_Operational_Report.xlsx`;
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
  }
};

export default exportService;
