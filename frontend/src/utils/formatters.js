/**
 * PS 26057 - Display Formatters and Normalization Utilities
 * Formats machine-readable ML outputs into professional maritime UI labels and verified values.
 */

export function formatConfidence(val) {
  if (val === null || val === undefined || val === '') return 'N/A';
  const num = Number(val);
  if (isNaN(num)) return 'N/A';
  // If 0.0 - 1.0 format, convert to percentage integer
  const pct = num <= 1.0 ? Math.round(num * 100) : Math.round(num);
  return `${Math.max(0, Math.min(100, pct))}%`;
}

export function formatClassLabel(cls) {
  if (!cls) return 'Acoustic Anomaly';
  const clean = String(cls).toLowerCase().trim();
  const map = {
    'debris_net': 'Debris Net',
    'pipe_cylinder': 'Subsea Pipeline',
    'pipeline': 'Subsea Pipeline',
    'cylinder': 'Submerged Cylinder',
    'wreck_structure': 'Shipwreck Structure',
    'shipwreck': 'Shipwreck Structure',
    'cargo_container': 'Cargo Container',
    'container': 'Cargo Container',
    'naval_mine': 'Acoustic Mine Hazard',
    'mine': 'Acoustic Mine Hazard',
    'pipe_joint': 'Pipeline Free-Span & Joint',
    'debris': 'Marine Debris'
  };
  if (map[clean]) return map[clean];
  return clean
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

export function formatSize(val) {
  if (val === null || val === undefined || val === '') return 'N/A';
  const num = Number(val);
  if (isNaN(num)) return 'N/A';
  return `${num.toFixed(1)} m`;
}

export function formatCoordinates(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) {
    return 'Coordinates Pending';
  }
  const latNum = Number(lat);
  const lonNum = Number(lon);
  if (isNaN(latNum) || isNaN(lonNum)) return 'Invalid GPS';

  const latDir = latNum >= 0 ? 'N' : 'S';
  const lonDir = lonNum >= 0 ? 'E' : 'W';
  return `${Math.abs(latNum).toFixed(5)}° ${latDir}, ${Math.abs(lonNum).toFixed(5)}° ${lonDir}`;
}

export function formatTimestamp(ts) {
  if (!ts) return 'N/A';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return String(ts);
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const mins = String(d.getUTCMinutes()).padStart(2, '0');
    const secs = String(d.getUTCSeconds()).padStart(2, '0');
    return `${day} ${month} ${year} ${hours}:${mins}:${secs} UTC`;
  } catch (e) {
    return String(ts);
  }
}

export function normalizeStatus(status) {
  if (!status) return 'pending_review';
  const s = String(status).toLowerCase().trim();
  if (s === 'confirmed' || s === 'verified') return 'confirmed';
  if (s === 'rejected') return 'rejected';
  return 'pending_review';
}

export function getStatusBadgeInfo(status) {
  const norm = normalizeStatus(status);
  if (norm === 'confirmed') {
    return {
      label: 'CONFIRMED',
      bgClass: 'bg-[#DCFCE7] text-[#16A34A]',
      borderClass: 'border-emerald-200',
      dotClass: 'bg-[#16A34A]'
    };
  }
  if (norm === 'rejected') {
    return {
      label: 'REJECTED',
      bgClass: 'bg-[#FEE2E2] text-[#DC2626]',
      borderClass: 'border-red-200',
      dotClass: 'bg-[#DC2626]'
    };
  }
  return {
    label: 'PENDING',
    bgClass: 'bg-[#FEF9C3] text-[#CA8A04]',
    borderClass: 'border-amber-200',
    dotClass: 'bg-[#CA8A04]'
  };
}

