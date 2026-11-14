/**
 * Topocentric geometry: azimuth/elevation of a target (Sun, Earth) as seen
 * from a site on the lunar surface.
 *
 * Includes topocentric parallax: the observer sits ~1737 km from the Moon's
 * center, which shifts the apparent elevation of the Earth by up to ~0.26 deg
 * — NOT negligible when Earth hovers within a couple of degrees of a polar
 * horizon, which is exactly the regime this tool cares about.
 *
 * Azimuth convention: degrees clockwise from lunar North (0=N, 90=E),
 * matching JPL Horizons. Elevation: degrees above the local horizontal
 * (plane perpendicular to the radial direction). No atmospheric refraction —
 * the Moon has no atmosphere.
 */

const DEG = Math.PI / 180;
import { MOON_RADIUS_KM } from './ephemeris.js';

/**
 * Site on the lunar surface.
 * @param {number} latDeg selenographic latitude (deg, +N)
 * @param {number} lonDeg selenographic longitude (deg, +E)
 * @param {number} [elevKm=0] elevation above the 1737.4 km reference sphere
 */
export function makeSite(latDeg, lonDeg, elevKm = 0) {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;
  const r = MOON_RADIUS_KM + elevKm;
  const up = [
    Math.cos(lat) * Math.cos(lon),
    Math.cos(lat) * Math.sin(lon),
    Math.sin(lat),
  ];
  const east = [-Math.sin(lon), Math.cos(lon), 0];
  const north = [
    -Math.sin(lat) * Math.cos(lon),
    -Math.sin(lat) * Math.sin(lon),
    Math.cos(lat),
  ];
  return {
    latDeg, lonDeg, elevKm,
    posKm: [up[0] * r, up[1] * r, up[2] * r],
    up, east, north,
  };
}

/**
 * Az/el of a target given its Moon-centered body-fixed position (km).
 * @returns {{ azDeg, elDeg, distKm }}
 */
export function azEl(site, targetKm) {
  // Topocentric vector: from the site, not the Moon's center.
  const t = [
    targetKm[0] - site.posKm[0],
    targetKm[1] - site.posKm[1],
    targetKm[2] - site.posKm[2],
  ];
  const distKm = Math.hypot(t[0], t[1], t[2]);
  const e = (t[0] * site.east[0] + t[1] * site.east[1] + t[2] * site.east[2]) / distKm;
  const n = (t[0] * site.north[0] + t[1] * site.north[1] + t[2] * site.north[2]) / distKm;
  const u = (t[0] * site.up[0] + t[1] * site.up[1] + t[2] * site.up[2]) / distKm;

  let azDeg = Math.atan2(e, n) / DEG;
  if (azDeg < 0) azDeg += 360;
  const elDeg = Math.asin(Math.max(-1, Math.min(1, u))) / DEG;
  return { azDeg, elDeg, distKm };
}

/**
 * Dip of the smooth-sphere horizon below the horizontal for an observer at
 * height h above the reference sphere (used for custom sites without a
 * terrain horizon mask). Returns degrees (>= 0 means horizon is below 0 el).
 */
export function sphereHorizonDipDeg(elevKm) {
  if (elevKm <= 0) return 0;
  const r = MOON_RADIUS_KM;
  return Math.acos(r / (r + elevKm)) / DEG;
}
