import axios from 'axios';
import { MAP_CONFIG } from '../config/mapConfig';

export { MAP_CONFIG };
export const TILE_PROVIDER = MAP_CONFIG.tileLayer;

export const mapService = {
  async getVesselTrack() {
    const res = await axios.get('/api/vessel-track');
    return res.data;
  },

  async getVesselTelemetry() {
    const res = await axios.get('/api/vessel-track/telemetry');
    return res.data;
  }
};

export default mapService;

