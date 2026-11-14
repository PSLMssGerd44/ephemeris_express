/** Formatting helpers. */

export function fmtDeg(x, digits = 1) {
  return `${x.toFixed(digits)}°`;
}

export function fmtDur(ms) {
  if (ms == null) return '—';
  const sign = ms < 0 ? '-' : '';
  ms = Math.abs(ms);
  const d = Math.floor(ms / 86400e3);
  const h = Math.floor((ms % 86400e3) / 3600e3);
  const m = Math.floor((ms % 3600e3) / 60e3);
  if (d > 0) return `${sign}${d}d ${h}h`;
  if (h > 0) return `${sign}${h}h ${m}m`;
  return `${sign}${m}m`;
}

export function fmtUTC(ms) {
  if (ms == null) return '—';
  return new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + 'Z';
}

/** For <input type="datetime-local"> (which has no timezone — we treat it as UTC). */
export function msToLocalInput(ms) {
  return new Date(ms).toISOString().slice(0, 16);
}
export function localInputToMs(v) {
  return Date.parse(v + ':00Z');
}
