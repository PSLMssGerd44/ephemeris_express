/**
 * Mission planner modal: for the selected site and arrival time, shows the
 * ballistic transfer trade (dV vs time-of-flight) computed from the REAL
 * lunar distance and speed at arrival, the implied departure epoch, and
 * launch-window estimates for major launch sites based on the Moon's
 * declination at arrival. Assumptions stated in the panel.
 */
import { Body, GeoVector, MakeTime, SiderealTime } from 'astronomy-engine';
import { transferScan, LAUNCH_SITES, launchWindows } from '../physics/mission.js';
import { fmtUTC, fmtDur } from './format.js';

const DEG = Math.PI / 180;

function moonStateAt(ms) {
  const t = MakeTime(new Date(ms));
  const m = GeoVector(Body.Moon, t, false);
  const AU = 149597870.7;
  const r = [m.x * AU, m.y * AU, m.z * AU];
  const dist = Math.hypot(...r);
  const m2 = GeoVector(Body.Moon, MakeTime(new Date(ms + 60e3)), false);
  const v = [(m2.x * AU - r[0]) / 60, (m2.y * AU - r[1]) / 60, (m2.z * AU - r[2]) / 60];
  return {
    distKm: dist,
    speedKms: Math.hypot(...v),
    decRad: Math.asin(r[2] / dist),
    raRad: Math.atan2(r[1], r[0]),
  };
}

const HTML = `
<div class="help-backdrop" id="msnBackdrop">
  <div class="help-modal msn-modal">
    <button class="help-close" id="msnClose">✕</button>
    <h2 style="margin-bottom:2px">🚀 Mission planner <span class="chip up" style="vertical-align:3px">first-order</span></h2>
    <p class="lead" id="msnHead"></p>
    <canvas id="msnChart" height="180"></canvas>
    <div class="msn-slider">
      <label>Time of flight <b id="msnTofLabel"></b></label>
      <input type="range" id="msnTof" min="0" max="1" step="1" />
    </div>
    <div class="kv msn-kv" id="msnDetails"></div>
    <h3>Launch sites — plane-alignment windows on departure day</h3>
    <table class="cmp-table" id="msnSites"><thead><tr>
      <th style="text-align:left">Site</th><th>Lat</th><th>Min. inclination</th><th>≈ windows (UTC)</th>
    </tr></thead><tbody></tbody></table>
    <h3>Assumptions</h3>
    <ul class="msn-assume">
      <li>Tangential TLI from a <b>185 km circular LEO</b>; two-body geocentric ellipse (Kepler) to the Moon's <b>actual distance at your arrival time</b>; coplanar arrival triangle with the Moon's actual orbital speed; LOI into a <b>100 km lunar orbit</b>.</li>
      <li>Transfer-plane geometry: minimum inclination = max(site latitude, |lunar declination at arrival|); a launch site rotates through that plane ≈ twice per day (times from sidereal geometry, ± a few minutes).</li>
      <li><b>Not modeled:</b> lunar gravity during transit (3-body), Earth oblateness, plane-change and finite-burn losses, descent &Delta;V (~1.9 km/s from low orbit). This is the standard first cut of preliminary mission design — real trajectory teams start exactly here, then refine.</li>
    </ul>
  </div>
</div>`;

export function initMission(buttonEl, getContext) {
  const wrap = document.createElement('div');
  wrap.innerHTML = HTML;
  document.body.appendChild(wrap.firstElementChild);
  const backdrop = document.getElementById('msnBackdrop');
  const close = () => backdrop.classList.remove('open');
  document.getElementById('msnClose').onclick = close;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  let scan = null, arrivalMs = 0, moon = null;

  function drawChart(selIdx) {
    const canvas = document.getElementById('msnChart');
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || 600, H = 180;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    const css = getComputedStyle(document.documentElement);
    const C = { line: css.getPropertyValue('--line').trim(), dim: css.getPropertyValue('--dim').trim(),
      sun: css.getPropertyValue('--sun').trim(), earth: css.getPropertyValue('--earth').trim(), text: css.getPropertyValue('--text').trim() };
    const x0 = 44, x1 = W - 10, y0 = H - 24, y1 = 10;
    const tofA = scan[0].tofDays, tofB = scan[scan.length - 1].tofDays;
    let vMin = Infinity, vMax = -Infinity;
    for (const r of scan) { vMin = Math.min(vMin, r.dvTLI); vMax = Math.max(vMax, r.dvTotal); }
    vMin -= 0.05; vMax += 0.05;
    const X = (t) => x0 + ((t - tofA) / (tofB - tofA)) * (x1 - x0);
    const Y = (v) => y0 - ((v - vMin) / (vMax - vMin)) * (y0 - y1);
    // grid + labels
    ctx.strokeStyle = C.line; ctx.fillStyle = C.dim; ctx.font = '10px system-ui'; ctx.lineWidth = 1;
    for (let v = Math.ceil(vMin * 10) / 10; v <= vMax; v += 0.2) {
      ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke();
      ctx.textAlign = 'right'; ctx.fillText(v.toFixed(1), x0 - 4, Y(v) + 3);
    }
    for (let t = Math.ceil(tofA); t <= tofB; t++) {
      ctx.textAlign = 'center'; ctx.fillText(`${t}d`, X(t), H - 10);
    }
    ctx.save(); ctx.translate(12, (y0 + y1) / 2); ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center'; ctx.fillText('ΔV (km/s)', 0, 0); ctx.restore();
    // curves
    const line = (key, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath();
      scan.forEach((r, i) => { const x = X(r.tofDays), y = Y(r[key]); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
      ctx.stroke();
    };
    line('dvTLI', C.sun);
    line('dvTotal', C.earth);
    ctx.fillStyle = C.sun; ctx.textAlign = 'left';
    ctx.fillText('TLI', x1 - 60, Y(scan[scan.length - 1].dvTLI) - 5);
    ctx.fillStyle = C.earth;
    ctx.fillText('TLI + LOI', x1 - 60, Y(scan[scan.length - 1].dvTotal) - 5);
    // selection
    const sel = scan[selIdx];
    ctx.strokeStyle = C.text; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(X(sel.tofDays), y0); ctx.lineTo(X(sel.tofDays), y1); ctx.stroke();
    ctx.setLineDash([]);
  }

  function renderSel(idx) {
    const r = scan[idx];
    const depMs = arrivalMs - r.tofDays * 86400e3;
    document.getElementById('msnTofLabel').textContent = `${r.tofDays.toFixed(2)} days`;
    document.getElementById('msnDetails').innerHTML = [
      ['Departure (TLI burn)', fmtUTC(depMs)],
      ['Arrival at the Moon', fmtUTC(arrivalMs)],
      ['Moon distance at arrival', `${Math.round(moon.distKm).toLocaleString()} km`],
      ['Lunar declination at arrival', `${(moon.decRad / DEG).toFixed(1)}°`],
      ['TLI ΔV (from 185 km LEO)', `${r.dvTLI.toFixed(3)} km/s`],
      ['C3 (characteristic energy)', `${r.c3.toFixed(2)} km²/s²`],
      ['Arrival v∞ at the Moon', `${r.vInf.toFixed(3)} km/s`],
      ['LOI ΔV (into 100 km orbit)', `${r.dvLOI.toFixed(3)} km/s`],
      ['<b>Total TLI + LOI</b>', `<b>${r.dvTotal.toFixed(3)} km/s</b>`],
    ].map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
    drawChart(idx);

    // launch windows table for the departure day
    const gastDegAt = (ms) => SiderealTime(MakeTime(new Date(ms))) * 15;
    const tb = document.querySelector('#msnSites tbody');
    tb.innerHTML = LAUNCH_SITES.map((s) => {
      const w = launchWindows(s, moon.raRad, moon.decRad, depMs, gastDegAt);
      const times = w.times.map((t) => new Date(t).toISOString().slice(11, 16) + 'Z').join(' · ');
      return `<tr><td style="text-align:left">${s.name}</td><td>${s.lat.toFixed(1)}°</td><td>${w.iReqDeg.toFixed(1)}°</td><td>${times}</td></tr>`;
    }).join('');
  }

  buttonEl.onclick = () => {
    const ctx = getContext();
    arrivalMs = ctx.dateMs;
    moon = moonStateAt(arrivalMs);
    scan = transferScan(moon.distKm, moon.speedKms);
    document.getElementById('msnHead').textContent =
      `Back-computed Earth departure for arrival at ${ctx.siteName} on ${fmtUTC(arrivalMs)} (the time currently selected).`;
    const slider = document.getElementById('msnTof');
    slider.max = String(scan.length - 1);
    // default: a day faster than minimum energy, a realistic pick
    let def = scan.findIndex((r) => r.tofDays >= scan[scan.length - 1].tofDays - 1);
    if (def < 0) def = Math.floor(scan.length / 2);
    slider.value = String(def);
    slider.oninput = () => renderSel(Number(slider.value));
    backdrop.classList.add('open');
    renderSel(def);
  };
}
