/**
 * Validation against JPL Horizons (the gold standard).
 *
 * Reference data fetched 2026-11-14 from the Horizons API (DE441 ephemeris,
 * MEAN_ME high-precision lunar frame, airless apparent az/el):
 *
 *   CENTER='coord@301', COORD_TYPE='GEODETIC', SITE_COORD='129.2,-89.66,0'
 *   (Shackleton crater area), QUANTITIES='4', 2026-11-01 .. 2026-11-10, 1 day
 *   COMMAND='10' (Sun) and COMMAND='399' (Earth)
 *
 * Horizons values are "airless apparent" (light-time + stellar aberration +
 * gravitational light bending); ours are geometric. Expected agreement
 * limited by: aberration (~0.006 deg for the Sun), the IAU-series vs DE441
 * lunar orientation (~0.005 deg), and astronomy-engine positions (~0.0003 deg).
 */
import { moonFixedState } from '../src/physics/ephemeris.js';
import { makeSite, azEl } from '../src/physics/topo.js';

// [isoDate, azDeg, elDeg]
const HORIZONS_SUN = [
  ['2026-11-01', 155.933910, 1.146111],
  ['2026-11-02', 143.764345, 1.192053],
  ['2026-11-03', 131.587877, 1.250853],
  ['2026-11-04', 119.404750, 1.320286],
  ['2026-11-05', 107.215528, 1.397515],
  ['2026-11-06', 95.021038, 1.479236],
  ['2026-11-07', 82.822308, 1.561872],
  ['2026-11-08', 70.620517, 1.641768],
  ['2026-11-09', 58.416934, 1.715399],
  ['2026-11-10', 46.212871, 1.779555],
];

const HORIZONS_EARTH = [
  ['2026-11-01', 234.741836, 2.743316],
  ['2026-11-02', 235.546023, 1.257597],
  ['2026-11-03', 236.084636, -0.303830],
  ['2026-11-04', 236.381770, -1.848098],
  ['2026-11-05', 236.467101, -3.291836],
  ['2026-11-06', 236.366172, -4.563598],
  ['2026-11-07', 236.094893, -5.605677],
  ['2026-11-08', 235.658449, -6.375666],
  ['2026-11-09', 235.054073, -6.847522],
  ['2026-11-10', 234.276532, -7.011606],
];

const site = makeSite(-89.66, 129.2, 0);

function compare(label, refTable, pick) {
  let maxAz = 0, maxEl = 0;
  console.log(`\n=== ${label} ===`);
  console.log('Date         Horizons az/el        Ours az/el            dAz(deg)  dEl(deg)');
  for (const [iso, refAz, refEl] of refTable) {
    const state = moonFixedState(new Date(iso + 'T00:00:00Z'));
    const { azDeg, elDeg } = azEl(site, pick(state));
    let dAz = azDeg - refAz;
    if (dAz > 180) dAz -= 360;
    if (dAz < -180) dAz += 360;
    const dEl = elDeg - refEl;
    maxAz = Math.max(maxAz, Math.abs(dAz));
    maxEl = Math.max(maxEl, Math.abs(dEl));
    console.log(
      `${iso}   ${refAz.toFixed(4).padStart(9)} ${refEl.toFixed(4).padStart(9)}   ${azDeg.toFixed(4).padStart(9)} ${elDeg.toFixed(4).padStart(9)}   ${dAz.toFixed(5).padStart(9)} ${dEl.toFixed(5).padStart(9)}`
    );
  }
  console.log(`Max |dAz| = ${maxAz.toFixed(5)} deg, max |dEl| = ${maxEl.toFixed(5)} deg`);
  return { maxAz, maxEl };
}

const sun = compare('SUN as seen from Shackleton (89.66S, 129.2E)', HORIZONS_SUN, (s) => s.sunKm);
const earth = compare('EARTH as seen from Shackleton (89.66S, 129.2E)', HORIZONS_EARTH, (s) => s.earthKm);

const TOL_EL = 0.02;  // deg — ~4% of the solar disk
const TOL_AZ = 0.05;  // deg
const pass = sun.maxEl < TOL_EL && earth.maxEl < TOL_EL && sun.maxAz < TOL_AZ && earth.maxAz < TOL_AZ;
console.log(`\nRESULT: ${pass ? 'VALIDATION PASSED' : 'VALIDATION FAILED'} (tolerance: el < ${TOL_EL} deg, az < ${TOL_AZ} deg)`);
process.exit(pass ? 0 : 1);
