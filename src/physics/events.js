/**
 * Event engine: horizon crossings (sunrise/sunset, Earthrise/Earthset),
 * visibility windows, and mission metrics.
 *
 * Scientific choices:
 * - The Sun uses its UPPER LIMB (center elevation + angular radius): at the
 *   poles the Sun skims the horizon, so the ~0.265-deg solar radius changes
 *   sunset times by many hours. This matches the convention of JPL Horizons'
 *   solar-presence flag.
 * - The Earth uses its CENTER (a conservative proxy for direct-to-Earth
 *   communication line-of-sight to mid-latitude ground stations).
 * - An arbitrary horizon function horizonFn(azDeg) -> elevation deg supports
 *   terrain horizon masks (LOLA-derived) or the smooth-sphere horizon dip.
 * - Crossings found by coarse scan + bisection to 30 s. The fastest the Sun's
 *   elevation changes at a polar site is ~1.5 deg/day, so a 45-min coarse
 *   step cannot skip a visibility window there; at low latitudes rates reach
 *   ~0.5 deg/hr, still safely sampled.
 */

import { moonFixedState, sunAngularRadiusDeg } from './ephemeris.js';
import { azEl } from './topo.js';

const MIN_MS = 60_000;

/** Altitude of target above the effective horizon (deg). */
export function altitudeAboveHorizon(site, target, tMs, horizonFn = () => 0, useLimb = target === 'sun') {
  const st = moonFixedState(new Date(tMs));
  const vec = target === 'sun' ? st.sunKm : st.earthKm;
  const { azDeg, elDeg, distKm } = azEl(site, vec);
  const limb = useLimb ? sunAngularRadiusDeg(distKm) : 0;
  return elDeg + limb - horizonFn(azDeg);
}

/**
 * All horizon crossings of `target` ('sun'|'earth') in [t0Ms, t1Ms].
 * @returns {Array<{timeMs: number, rising: boolean}>}
 */
export function findCrossings(site, target, t0Ms, t1Ms, opts = {}) {
  const horizonFn = opts.horizonFn ?? (() => 0);
  const useLimb = opts.useLimb ?? (target === 'sun');
  const coarseMs = (opts.coarseMin ?? 45) * MIN_MS;

  const crossings = [];
  let prevT = t0Ms;
  let prevF = altitudeAboveHorizon(site, target, prevT, horizonFn, useLimb);
  for (let t = t0Ms + coarseMs; t <= t1Ms + coarseMs; t += coarseMs) {
    const tc = Math.min(t, t1Ms);
    if (tc <= prevT) break;
    const f = altitudeAboveHorizon(site, target, tc, horizonFn, useLimb);
    if ((prevF <= 0) !== (f <= 0)) {
      let a = prevT, b = tc, fa = prevF;
      while (b - a > MIN_MS / 2) {
        const m = (a + b) / 2;
        const fm = altitudeAboveHorizon(site, target, m, horizonFn, useLimb);
        if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else { b = m; }
      }
      crossings.push({ timeMs: (a + b) / 2, rising: f > 0 });
    }
    prevT = tc; prevF = f;
  }
  return crossings;
}

/**
 * Visibility windows (target above horizon) in [t0Ms, t1Ms].
 * Windows touching the interval edges are flagged clipped.
 */
export function visibilityWindows(site, target, t0Ms, t1Ms, opts = {}) {
  const horizonFn = opts.horizonFn ?? (() => 0);
  const useLimb = opts.useLimb ?? (target === 'sun');
  const crossings = findCrossings(site, target, t0Ms, t1Ms, { ...opts, horizonFn, useLimb });
  const upAtStart = altitudeAboveHorizon(site, target, t0Ms, horizonFn, useLimb) > 0;

  const windows = [];
  let curStart = upAtStart ? t0Ms : null;
  for (const c of crossings) {
    if (c.rising) {
      curStart = c.timeMs;
    } else if (curStart !== null) {
      windows.push({ startMs: curStart, endMs: c.timeMs, clippedStart: curStart === t0Ms, clippedEnd: false });
      curStart = null;
    }
  }
  if (curStart !== null) {
    windows.push({ startMs: curStart, endMs: t1Ms, clippedStart: curStart === t0Ms, clippedEnd: true });
  }
  return windows;
}

/** Aggregate stats over an interval from its visibility windows. */
export function windowMetrics(windows, t0Ms, t1Ms) {
  const spanMs = t1Ms - t0Ms;
  let totalMs = 0, longestMs = 0;
  for (const w of windows) {
    const d = w.endMs - w.startMs;
    totalMs += d;
    longestMs = Math.max(longestMs, d);
  }
  let longestGapMs = 0, prevEnd = t0Ms;
  for (const w of windows) {
    longestGapMs = Math.max(longestGapMs, w.startMs - prevEnd);
    prevEnd = w.endMs;
  }
  longestGapMs = Math.max(longestGapMs, t1Ms - prevEnd);
  return { fraction: totalMs / spanMs, totalMs, longestMs, longestGapMs, spanMs };
}

/**
 * Next rise and next set after `fromMs` (searches up to `horizonDays` ahead).
 * @returns {{ nextRiseMs: number|null, nextSetMs: number|null }}
 */
export function nextEvents(site, target, fromMs, opts = {}) {
  const horizonDays = opts.horizonDays ?? 90;
  const crossings = findCrossings(site, target, fromMs, fromMs + horizonDays * 86400e3, opts);
  let nextRiseMs = null, nextSetMs = null;
  for (const c of crossings) {
    if (c.rising && nextRiseMs === null) nextRiseMs = c.timeMs;
    if (!c.rising && nextSetMs === null) nextSetMs = c.timeMs;
    if (nextRiseMs !== null && nextSetMs !== null) break;
  }
  return { nextRiseMs, nextSetMs };
}
