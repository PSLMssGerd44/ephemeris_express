/**
 * Mission context: first-order Earth->Moon transfer estimates, patched-conic,
 * driven by the REAL lunar state at arrival (distance, speed, declination,
 * right ascension) from the same validated ephemeris as the rest of the tool.
 *
 * Model (standard preliminary-design approach, cf. Bate-Mueller-White ch. 7):
 * - Departure: tangential TLI burn at perigee of the transfer ellipse from a
 *   circular 185-km parking orbit (r_p = 6563 km).
 * - Transfer: two-body geocentric ellipse; time of flight from perigee to
 *   lunar distance d via Kepler's equation. For a given TOF, the semi-major
 *   axis is found by bisection (TOF decreases monotonically with energy).
 * - Arrival: v_infinity from the velocity triangle at lunar distance
 *   (flight-path angle from angular momentum; Moon's velocity from the
 *   ephemeris, coplanar assumption), then LOI burn into a 100-km circular
 *   lunar orbit.
 * - Launch windows: the transfer plane must contain the Moon at arrival;
 *   minimum inclination is max(site latitude, |lunar declination|). A site
 *   rotates through that plane ~twice daily; times from GAST.
 *
 * NOT modeled (stated honestly in the UI): Earth oblateness, lunar gravity
 * during transit (3-body), plane-change costs, finite burns, descent.
 * Typical accuracy vs real missions: ~1-3% on dV, minutes on window times.
 */

const MU_E = 398600.4418;   // km^3/s^2
const MU_M = 4902.800066;
const R_LEO = 6378.137 + 185;
const R_LLO = 1737.4 + 100;

/** Time (s) from perigee (r_p = R_LEO) to radius d on ellipse with sma a. */
function tofFromPerigee(a, d) {
  const e = 1 - R_LEO / a;
  const cosE = (1 - d / a) / e;
  if (cosE < -1 || cosE > 1) return null;   // never reaches d (or past apogee)
  const E = Math.acos(cosE);
  const M = E - e * Math.sin(E);
  return Math.sqrt((a * a * a) / MU_E) * M;
}

/**
 * Scan ballistic transfers for a given lunar distance/speed at arrival.
 * @returns array of { tofDays, aKm, c3, dvTLI, vArr, gammaDeg, vInf, dvLOI, dvTotal }
 */
export function transferScan(moonDistKm, moonSpeedKms) {
  const d = moonDistKm;
  const aMin = (R_LEO + d) / 2;              // apogee exactly at the Moon
  const tofMax = tofFromPerigee(aMin * (1 + 1e-9), d);
  const vCirc = Math.sqrt(MU_E / R_LEO);
  const out = [];
  const tofLo = 1.8 * 86400;
  const tofHi = Math.min(5.9 * 86400, tofMax - 3600);
  for (let tof = tofLo; tof <= tofHi; tof += 0.05 * 86400) {
    // bisect a: tofFromPerigee decreases as a increases
    let lo = aMin * (1 + 1e-9), hi = 2.5e6;
    for (let i = 0; i < 80; i++) {
      const mid = 0.5 * (lo + hi);
      const t = tofFromPerigee(mid, d);
      if (t === null || t > tof) lo = mid; else hi = mid;
    }
    const a = 0.5 * (lo + hi);
    const vp = Math.sqrt(MU_E * (2 / R_LEO - 1 / a));
    const vArr = Math.sqrt(MU_E * (2 / d - 1 / a));
    const h = R_LEO * vp;
    const cosg = Math.min(1, h / (d * vArr));
    const gamma = Math.acos(cosg);           // flight-path angle at arrival
    const vm = moonSpeedKms;
    // coplanar velocity triangle: Moon's velocity ~ perpendicular to radius
    const vInf = Math.sqrt(Math.max(0, vArr * vArr + vm * vm - 2 * vArr * vm * cosg));
    const dvLOI = Math.sqrt(vInf * vInf + (2 * MU_M) / R_LLO) - Math.sqrt(MU_M / R_LLO);
    const dvTLI = vp - vCirc;
    out.push({
      tofDays: tof / 86400, aKm: a, c3: -MU_E / a,
      dvTLI, vArr, gammaDeg: (gamma * 180) / Math.PI, vInf, dvLOI,
      dvTotal: dvTLI + dvLOI,
    });
  }
  return out;
}

export const LAUNCH_SITES = [
  { name: 'Kennedy Space Center (USA)', lat: 28.57, lon: -80.65 },
  { name: 'Starbase, Boca Chica (USA)', lat: 25.99, lon: -97.16 },
  { name: 'Vandenberg SFB (USA)', lat: 34.74, lon: -120.57 },
  { name: 'Kourou / CSG (Europe)', lat: 5.24, lon: -52.77 },
  { name: 'Tanegashima (Japan)', lat: 30.37, lon: 130.96 },
  { name: 'Satish Dhawan / SHAR (India)', lat: 13.72, lon: 80.23 },
  { name: 'Wenchang (China)', lat: 19.61, lon: 110.95 },
];

const DEG = Math.PI / 180;

/**
 * Daily launch-window times (UTC, ms) near `nearMs` for a site to enter a
 * plane of inclination i containing the Moon (RA alpha, dec delta, radians).
 * gastDegAt(ms) must return Greenwich apparent sidereal time in degrees.
 */
export function launchWindows(site, alpha, delta, nearMs, gastDegAt) {
  const phi = site.lat * DEG;
  const i = Math.max(Math.abs(phi), Math.abs(delta)) + 0.5 * DEG;
  // RAAN options so the plane contains the Moon direction
  const uM = Math.asin(Math.min(1, Math.max(-1, Math.sin(delta) / Math.sin(i))));
  const omegas = [
    alpha - Math.atan2(Math.cos(i) * Math.sin(uM), Math.cos(uM)),
    alpha - Math.atan2(Math.cos(i) * Math.sin(Math.PI - uM), Math.cos(Math.PI - uM)),
  ];
  // argument of latitude where the orbit crosses the site latitude (ascending)
  const uL = Math.asin(Math.min(1, Math.sin(Math.abs(phi)) / Math.sin(i)));
  const times = [];
  for (const om of omegas) {
    const lstDeg = (((om + Math.atan2(Math.cos(i) * Math.sin(uL), Math.cos(uL))) / DEG) % 360 + 360) % 360;
    // Solve GAST(t)*1 + lon = lst  (degrees), sidereal rate 360.9856473 deg/day
    const g0 = gastDegAt(nearMs);
    let dDeg = (lstDeg - site.lon - g0) % 360;
    if (dDeg < -180) dDeg += 360;
    if (dDeg > 180) dDeg -= 360;
    times.push(nearMs + (dDeg / 360.9856473) * 86400e3);
  }
  return { iReqDeg: i / DEG, times: times.sort((a, b) => a - b) };
}
