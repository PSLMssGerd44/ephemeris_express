/**
 * Physics sanity checks — these exploit known geometric invariants of the
 * Earth-Moon-Sun system, so they catch sign/convention errors loudly.
 *
 * 1. At the lunar south pole, Sun elevation must stay within ~±1.7 deg
 *    (the Moon's spin axis is tilted only 1.54 deg to the ecliptic).
 * 2. At the south pole, Earth elevation must stay within ~±8.5 deg
 *    (optical librations ±6.9 deg lat + topocentric parallax ~0.95 deg).
 * 3. At (0N, 0E) — the mean sub-Earth point — Earth must stay near zenith
 *    (elevation > 78 deg; total libration excursion < ~12 deg).
 * 4. Sun azimuth at the pole must advance ~360 deg per synodic month
 *    (~12.2 deg/day).
 */
import { moonFixedState } from '../src/physics/ephemeris.js';
import { makeSite, azEl } from '../src/physics/topo.js';

const pole = makeSite(-90, 0);
const subEarth = makeSite(0, 0);

let sunElMin = 99, sunElMax = -99, earthElMin = 99, earthElMax = -99;
let subEarthElMin = 99;

const t0 = Date.UTC(2026, 0, 1);
const stepH = 6;
const nSteps = (365 * 24) / stepH;

for (let i = 0; i <= nSteps; i++) {
  const date = new Date(t0 + i * stepH * 3600 * 1000);
  const { sunKm, earthKm } = moonFixedState(date);
  const s = azEl(pole, sunKm);
  const e = azEl(pole, earthKm);
  const ze = azEl(subEarth, earthKm);
  sunElMin = Math.min(sunElMin, s.elDeg); sunElMax = Math.max(sunElMax, s.elDeg);
  earthElMin = Math.min(earthElMin, e.elDeg); earthElMax = Math.max(earthElMax, e.elDeg);
  subEarthElMin = Math.min(subEarthElMin, ze.elDeg);
}

console.log('=== Sanity over calendar year 2026, 6 h steps ===');
console.log(`South pole Sun  elevation range: [${sunElMin.toFixed(3)}, ${sunElMax.toFixed(3)}] deg  (expect within ±1.7)`);
console.log(`South pole Earth elevation range: [${earthElMin.toFixed(3)}, ${earthElMax.toFixed(3)}] deg (expect within ±8.5)`);
console.log(`Sub-Earth point (0,0) min Earth elevation: ${subEarthElMin.toFixed(3)} deg (expect > 78)`);

const ok1 = sunElMin > -1.8 && sunElMax < 1.8;
const ok2 = earthElMin > -8.6 && earthElMax < 8.6;
const ok3 = subEarthElMin > 78;

// Sun azimuth drift rate at pole
const a1 = azEl(pole, moonFixedState(new Date(Date.UTC(2026, 2, 1))).sunKm).azDeg;
const a2 = azEl(pole, moonFixedState(new Date(Date.UTC(2026, 2, 2))).sunKm).azDeg;
let rate = a2 - a1;
if (rate > 180) rate -= 360;
if (rate < -180) rate += 360;
console.log(`Sun azimuth drift at pole: ${rate.toFixed(2)} deg/day (expect ~±12.2)`);
const ok4 = Math.abs(Math.abs(rate) - 12.19) < 1.0;

// Sample table: Shackleton crater area (89.66 S, 129.2 E)
const shack = makeSite(-89.66, 129.2);
console.log('\n=== Shackleton (89.66S 129.2E), first days of Nov 2026 ===');
console.log('UTC                  SunAz    SunEl   EarthAz  EarthEl');
for (let dday = 0; dday < 10; dday += 1) {
  const date = new Date(Date.UTC(2026, 10, 1, 0) + dday * 86400e3);
  const { sunKm, earthKm } = moonFixedState(date);
  const s = azEl(shack, sunKm);
  const e = azEl(shack, earthKm);
  console.log(
    `${date.toISOString().slice(0, 16)}   ${s.azDeg.toFixed(2).padStart(7)} ${s.elDeg.toFixed(3).padStart(8)} ${e.azDeg.toFixed(2).padStart(8)} ${e.elDeg.toFixed(3).padStart(8)}`
  );
}

console.log(`\nRESULT: ${ok1 && ok2 && ok3 && ok4 ? 'ALL SANITY CHECKS PASSED' : 'FAILURES: ' + [ok1, ok2, ok3, ok4].map((o, i) => (o ? '' : 'check' + (i + 1))).filter(Boolean).join(', ')}`);
