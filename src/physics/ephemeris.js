/**
 * Ephemeris core: Sun and Earth position vectors in the Moon's body-fixed
 * ME frame, in km, as functions of time.
 *
 * Key design insight: these vectors are SITE-INDEPENDENT. The az/el of the
 * Sun or Earth at any selenographic (lat, lon) is a pure rotation of these
 * vectors (plus a topocentric parallax shift of the origin to the site).
 * That makes multi-site, multi-date comparison O(1) per site-time pair.
 *
 * Positions from astronomy-engine (VSOP87/ELP-grade, ~1 arcmin geocentric),
 * lunar orientation from the IAU WGCCRE model (librations included).
 * Geometric positions (no light-time/aberration): the difference vs apparent
 * is < 0.006 deg, negligible against the 0.53-deg solar disk. Validated
 * against JPL Horizons (see docs/validation.md).
 */

import { Body, GeoVector, MakeTime } from 'astronomy-engine';
import { icrfToMoonFixedMatrix, matVec } from './iauMoon.js';

export const AU_KM = 149597870.7;
export const SUN_RADIUS_KM = 695700;
export const EARTH_RADIUS_KM = 6371;
export const MOON_RADIUS_KM = 1737.4;

/**
 * Sun and Earth state in the lunar ME frame at a given time.
 * @param {Date|number|AstroTime} date - JS Date (UTC), or astronomy-engine time
 * @returns {{ sunKm: number[], earthKm: number[], time: AstroTime }}
 *   Vectors are Moon-center -> body, in km, in the ME body-fixed frame.
 */
export function moonFixedState(date) {
  const time = MakeTime(date);
  // Geocentric vectors in J2000 equatorial (EQJ ~ ICRF), units AU
  const moon = GeoVector(Body.Moon, time, false);
  const sun = GeoVector(Body.Sun, time, false);

  const sunFromMoonIcrf = [
    (sun.x - moon.x) * AU_KM,
    (sun.y - moon.y) * AU_KM,
    (sun.z - moon.z) * AU_KM,
  ];
  const earthFromMoonIcrf = [-moon.x * AU_KM, -moon.y * AU_KM, -moon.z * AU_KM];

  const M = icrfToMoonFixedMatrix(time.tt);
  return {
    sunKm: matVec(M, sunFromMoonIcrf),
    earthKm: matVec(M, earthFromMoonIcrf),
    time,
  };
}

/** Angular radius of the Sun as seen from the Moon at distance d km. */
export function sunAngularRadiusDeg(distKm) {
  return (Math.asin(SUN_RADIUS_KM / distKm) * 180) / Math.PI;
}

/** Angular radius of the Earth as seen from the Moon at distance d km. */
export function earthAngularRadiusDeg(distKm) {
  return (Math.asin(EARTH_RADIUS_KM / distKm) * 180) / Math.PI;
}
