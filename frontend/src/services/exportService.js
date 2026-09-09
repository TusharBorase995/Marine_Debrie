export const exportService = {
  exportJSON() {
    window.open('/api/reports/export?format=json', '_blank');
  },

  exportCSV() {
    window.open('/api/reports/export?format=csv', '_blank');
  }
};

export default exportService;
