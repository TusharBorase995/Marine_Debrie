import axios from 'axios';

const API_BASE = '/api/targets';

/**
 * Consolidates multiple raw sonar detections/observations into unique physical targets.
 * Guarantees that multiple observations sharing a target_id produce exactly ONE
 * consolidated physical target with fused coordinates and confidence.
 */
export const consolidateDetectionsToTargets = (detections = []) => {
  if (!Array.isArray(detections) || detections.length === 0) return [];

  const groups = new Map();

  detections.forEach((det) => {
    const targetId = det.target_id || det.id;
    if (!groups.has(targetId)) {
      groups.set(targetId, []);
    }
    groups.get(targetId).push(det);
  });

  const consolidated = [];

  groups.forEach((observations, targetId) => {
    const primary = observations[0];
    const obsCount = observations.length;

    // Calculate mean centroid coordinates
    const sumLat = observations.reduce((acc, curr) => acc + (curr.latitude || 0), 0);
    const sumLon = observations.reduce((acc, curr) => acc + (curr.longitude || 0), 0);
    const avgLat = Number((sumLat / obsCount).toFixed(6));
    const avgLon = Number((sumLon / obsCount).toFixed(6));

    // Calculate fused confidence across repeated observations
    const confValues = observations.map(o => o.fused_confidence ?? o.confidence ?? 0.85);
    const maxConf = Math.max(...confValues);
    const avgConf = confValues.reduce((a, b) => a + b, 0) / obsCount;
    const fusedConfidence = Number((maxConf * 0.75 + avgConf * 0.25).toFixed(2));

    // Determine target-level status
    const isVerified = observations.some(o => 
      (o.human_review_status || o.status) === 'verified' || 
      (o.human_review_status || o.status) === 'confirmed'
    );
    const isRejected = observations.every(o => 
      (o.human_review_status || o.status) === 'rejected'
    );
    const status = isVerified ? 'verified' : (isRejected ? 'rejected' : 'pending_review');

    consolidated.push({
      target_id: targetId,
      id: targetId, // For compatibility with components expecting .id
      class: primary.class || primary.category || 'debris_net',
      category: primary.category || primary.class || 'debris_net',
      label: primary.target_label || primary.label || `Physical Target (${targetId})`,
      latitude: avgLat,
      longitude: avgLon,
      estimated_size_m: primary.estimated_size_m || 3.0,
      status: status,
      human_review_status: status === 'verified' ? 'confirmed' : (status === 'rejected' ? 'rejected' : 'pending'),
      confidence: fusedConfidence,
      fused_confidence: fusedConfidence,
      observation_count: obsCount,
      sonar_image_ref: primary.sonar_image_ref,
      observations: observations
    });
  });

  return consolidated;
};

export const targetService = {
  async getAll(params = {}) {
    try {
      const res = await axios.get(API_BASE, { params });
      return res.data;
    } catch (err) {
      console.warn('Falling back to client-side target consolidation from /api/detections:', err);
      const detRes = await axios.get('/api/detections', { params });
      return consolidateDetectionsToTargets(detRes.data);
    }
  },

  async getById(targetId) {
    const res = await axios.get(`${API_BASE}/${targetId}`);
    return res.data;
  },

  async review(targetId, action) {
    const res = await axios.post(`${API_BASE}/${targetId}/review`, { action });
    return res.data;
  },

  async reviewTarget(targetId, action) {
    return this.review(targetId, action);
  },

  consolidateDetectionsToTargets,
  extractImageKeys
};

/**
 * Normalizes and extracts all acoustic frame identifiers from a target or observation.
 * Matches across multi-pass sonar frames, image IDs, and relative paths.
 */
export const extractImageKeys = (tgt) => {
  if (!tgt) return [];
  const keys = new Set();
  const add = (v) => {
    if (!v || typeof v !== 'string') return;
    const base = v.split('/').pop().split('?')[0];
    if (base) {
      keys.add(base);
      const noExt = base.replace(/\.[^/.]+$/, '');
      keys.add(noExt);
      const prefix = noExt.match(/^(IMG-[A-Za-z0-9_-]+)-\d+$/);
      if (prefix) keys.add(prefix[1]);
    }
  };

  add(tgt.image_id);
  add(tgt.sonar_image_ref);
  if (Array.isArray(tgt.observations)) {
    tgt.observations.forEach(o => {
      add(o.image_id);
      add(o.sonar_image_ref);
    });
  }
  return Array.from(keys);
};

export default targetService;
