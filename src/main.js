/**
 * Ephemeris Express — app wiring.
 *
 * Performance architecture: Sun/Earth vectors in the Moon's body-fixed frame
 * are SITE-INDEPENDENT, so the time-series over the analysis window is
 * computed once and cached; evaluating any site against it is just a frame
 * rotation (microseconds). That's what makes site comparison instant.
 */
import './styles.css';
import { moonFixedState } from './physics/ephemeris.js';
import { makeSite, azEl } from './physics/topo.js';
import { visibilityWindows, windowMetrics, nextEvents, altitudeAboveHorizon } from './physics/events.js';
import { SITES } from './data/sites.js';
import { maskFor, horizonFnFromMask } from './data/masks.js';
import { Scene3D } from './ui/scene3d.js';
import { Timeline } from './ui/timeline.js';
import { drawSkyPlot } from './ui/skyplot.js';
import { fmtDeg, fmtDur, fmtUTC, msToLocalInput, localInputToMs } from './ui/format.js';
import { interpret } from './ui/interpret.js';
import { initHelp } from './ui/help.js';
import { initCompare } from './ui/compare.js';
import { initMission } from './ui/mission.js';
import { loadTerrain } from './ui/terrain.js';

const WINDOW_DAYS = 30;
const SAMPLE_MIN = 20;

// ---------- state ----------
const state = {
  site: SITES[0],
  dateMs: Date.now(),
  playing: false,
  speed: 21600, // sim seconds per real second
  view: 'auto', // 'auto' | 'globe' | 'terrain'
  exag: 3,      // terrain vertical exaggeration (3x readable, 1x true scale)
};

// ---------- site-independent ephemeris cache ----------
let cache = null; // { t0, t1, times:[], sun:[[x,y,z]...], earth:[[..]] }
function ensureCache() {
  const half = (WINDOW_DAYS / 2) * 86400e3;
  // recenter when the cursor drifts into the outer quarters of the window
  if (cache && state.dateMs > cache.t0 + half / 2 && state.dateMs < cache.t1 - half / 2) return false;
  const t0 = state.dateMs - half, t1 = state.dateMs + half;
  const step = SAMPLE_MIN * 60e3;
  const times = [], sun = [], earth = [];
  for (let t = t0; t <= t1; t += step) {
    const st = moonFixedState(new Date(t));
    times.push(t); sun.push(st.sunKm); earth.push(st.earthKm);
  }
  cache = { t0, t1, times, sun, earth };
  return true;
}

// ---------- per-site derived data ----------
let derived = null; // { siteId, series, sunWindows, earthWindows, sunMetrics, earthMetrics, next }
function recomputeSite() {
  const s = state.site;
  const site = makeSite(s.lat, s.lon);
  ensureCache();
  const mask = maskFor(s.id);
  const horizonFn = mask ? horizonFnFromMask(mask) : () => 0;
  const opts = { horizonFn };
  const sunEl = [], earthEl = [];
  for (let i = 0; i < cache.times.length; i++) {
    sunEl.push(azEl(site, cache.sun[i]).elDeg);
    earthEl.push(azEl(site, cache.earth[i]).elDeg);
  }
  const sunWindows = visibilityWindows(site, 'sun', cache.t0, cache.t1, opts);
  const earthWindows = visibilityWindows(site, 'earth', cache.t0, cache.t1, opts);
  derived = {
    siteKey: `${s.lat},${s.lon}`,
    site,
    mask,
    horizonFn,
    series: { t0: cache.t0, t1: cache.t1, times: cache.times, sunEl, earthEl },
    sunMetrics: windowMetrics(sunWindows, cache.t0, cache.t1),
    earthMetrics: windowMetrics(earthWindows, cache.t0, cache.t1),
    nextSun: nextEvents(site, 'sun', state.dateMs, { horizonDays: 60, ...opts }),
    nextEarth: nextEvents(site, 'earth', state.dateMs, { horizonDays: 60, ...opts }),
  };
}

// ---------- DOM ----------
const el = (id) => document.getElementById(id);
const scene = new Scene3D(el('scene3d'));
const timeline = new Timeline(el('timeline'), (ms) => setDate(ms, { fromScrub: true }));

function buildSiteList() {
  const wrap = el('siteList');
  wrap.innerHTML = '';
  let lastGroup = null;
  for (const s of SITES) {
    if (s.group !== lastGroup) {
      const g = document.createElement('div');
      g.className = 'group-label';
      g.textContent = s.group;
      wrap.appendChild(g);
      lastGroup = s.group;
    }
    const btn = document.createElement('button');
    btn.className = 'site-btn' + (s.id === state.site.id ? ' active' : '');
    btn.dataset.id = s.id;
    btn.innerHTML = `${s.name}<span class="coords">${s.lat.toFixed(2)}°, ${s.lon.toFixed(2)}°E${s.approx ? ' · region ≈' : ''}</span>`;
    btn.onclick = () => setSite(s);
    wrap.appendChild(btn);
  }
}

function renderMetrics() {
  const s = state.site;
  const site = derived.site;
  const st = moonFixedState(new Date(state.dateMs));
  const sun = azEl(site, st.sunKm);
  const earth = azEl(site, st.earthKm);
  const sunUp = altitudeAboveHorizon(site, 'sun', state.dateMs, derived.horizonFn) > 0;
  const earthUp = earth.elDeg > derived.horizonFn(earth.azDeg);

  const card = (title, chipTxt, chipUp, rows) => `
    <div class="mcard">
      <div class="ttl"><b>${title}</b><span class="chip ${chipUp ? 'up' : 'down'}">${chipTxt}</span></div>
      <div class="kv">${rows.map(([k, v, tip]) => `<span${tip ? ` title="${tip}"` : ''}>${k}</span><b>${v}</b>`).join('')}</div>
    </div>`;

  const interpCard = `
    <div class="mcard interp">
      <div class="ttl"><b>What this means, here &amp; now</b></div>
      ${interpret({
        site: s, sunEl: sun.elDeg, earthEl: earth.elDeg,
        sunMetrics: derived.sunMetrics, earthMetrics: derived.earthMetrics,
        nextSun: derived.nextSun, nextEarth: derived.nextEarth, nowMs: state.dateMs,
        hasTerrain: !!derived.mask,
      }).map((t) => `<p>${t}</p>`).join('')}
    </div>`;

  const nextSunEvt = sunUp
    ? ['Sunset in', fmtDur(derived.nextSun.nextSetMs ? derived.nextSun.nextSetMs - state.dateMs : null)]
    : ['Sunrise in', fmtDur(derived.nextSun.nextRiseMs ? derived.nextSun.nextRiseMs - state.dateMs : null)];
  const nextEarthEvt = earthUp
    ? ['Earthset in', fmtDur(derived.nextEarth.nextSetMs ? derived.nextEarth.nextSetMs - state.dateMs : null)]
    : ['Earthrise in', fmtDur(derived.nextEarth.nextRiseMs ? derived.nextEarth.nextRiseMs - state.dateMs : null)];

  el('metrics').innerHTML =
    `<div class="mcard"><div class="ttl"><b>${s.name}</b>${s.approx ? '<span class="chip down">region ≈</span>' : ''}</div>
      <div class="kv">
        <span>Coordinates</span><b>${s.lat.toFixed(3)}°, ${s.lon.toFixed(3)}°E</b>
        <span>Time (UTC)</span><b>${fmtUTC(state.dateMs)}</b>
      </div>
      ${s.note ? `<div class="approx-note">${s.note}</div>` : ''}
      <div class="approx-note">${derived.mask
        ? `⛰️ <b>Terrain horizon active</b> — ${derived.mask.source}. Site elevation ${derived.mask.siteElevM >= 0 ? '+' : ''}${(derived.mask.siteElevM / 1000).toFixed(2)} km.`
        : 'Smooth-sphere horizon (no terrain mask for this site).'}</div>
    </div>` +
    interpCard +
    card('Sun — power', sunUp ? 'DAYLIGHT' : 'NIGHT', sunUp, [
      ['Elevation', fmtDeg(sun.elDeg, 2), 'Height above the horizon: 0° = on the horizon, 90° = overhead. Flat solar panel output scales with sin(elevation).'],
      ['Azimuth', fmtDeg(sun.azDeg, 1), 'Compass direction: 0° = north, 90° = east, 180° = south, 270° = west.'],
      [...nextSunEvt, 'Countdown to the next sunrise/sunset, using the upper edge of the solar disk (the Moon has no atmosphere, so no refraction).'],
      [`Lit, ${WINDOW_DAYS}d window`, `${(derived.sunMetrics.fraction * 100).toFixed(1)}%`, 'Fraction of the 30-day analysis window with the Sun above the horizon — the site’s solar energy budget.'],
      ['Longest darkness', fmtDur(derived.sunMetrics.longestGapMs), 'Longest continuous night in the window — the battery/heater endurance a lander must carry.'],
    ]) +
    card('Earth — DTE comms', earthUp ? 'LINK POSSIBLE' : 'NO DIRECT LINK', earthUp, [
      ['Elevation', fmtDeg(earth.elDeg, 2), 'Earth’s height above the site’s horizon. Above 0° a direct-to-Earth radio link is geometrically possible; higher is a cleaner link.'],
      ['Azimuth', fmtDeg(earth.azDeg, 1), 'Compass direction toward Earth — where the high-gain antenna must point.'],
      [...nextEarthEvt, 'Earth rises and sets at polar sites over weeks, driven by lunar librations (the Moon’s slow ±7–8° wobble relative to Earth).'],
      [`Visible, ${WINDOW_DAYS}d window`, `${(derived.earthMetrics.fraction * 100).toFixed(1)}%`, 'Fraction of the window with Earth above the horizon — how often direct communication is possible at all.'],
      ['Longest comms gap', fmtDur(derived.earthMetrics.longestGapMs), 'Longest stretch with no direct Earth link — the autonomy the mission must plan for (or cover with a relay satellite).'],
    ]);
}

function renderSky() {
  const site = derived.site;
  // ±7-day tracks from the cache (every 3rd sample ≈ 1 h)
  const sunTrack = [], earthTrack = [];
  const t0 = state.dateMs - 7 * 86400e3, t1 = state.dateMs + 7 * 86400e3;
  for (let i = 0; i < cache.times.length; i += 3) {
    const t = cache.times[i];
    if (t < t0 || t > t1) continue;
    sunTrack.push(azEl(site, cache.sun[i]));
    earthTrack.push(azEl(site, cache.earth[i]));
  }
  const st = moonFixedState(new Date(state.dateMs));
  drawSkyPlot(el('skyplot'), {
    sunTrack, earthTrack,
    sunNow: azEl(site, st.sunKm),
    earthNow: azEl(site, st.earthKm),
    horizonMask: derived.mask ? derived.mask.elevDeg : null,
  });
}

function effectiveMode() {
  return state.view !== 'globe' && scene.terrainMesh ? 'terrain' : 'globe';
}

function updateViewToggle() {
  const btn = el('viewToggle');
  const exagBtn = el('exagToggle');
  if (!scene.terrainMesh) { btn.hidden = true; exagBtn.hidden = true; return; }
  btn.hidden = false;
  btn.textContent = effectiveMode() === 'terrain' ? '🌐 Globe view' : '⛰ Terrain view';
  exagBtn.hidden = effectiveMode() !== 'terrain';
  exagBtn.textContent = `relief ×${state.exag}`;
}

function renderScene() {
  const st = moonFixedState(new Date(state.dateMs));
  const site = derived.site;
  const norm = (v) => { const m = Math.hypot(...v); return [v[0] / m, v[1] / m, v[2] / m]; };
  const sun = azEl(site, st.sunKm);
  const earth = azEl(site, st.earthKm);
  scene.setState({
    mode: effectiveMode(),
    sunDir: norm(st.sunKm),
    earthDir: norm(st.earthKm),
    sunAzEl: sun,
    earthAzEl: earth,
    site: { lat: state.site.lat, lon: state.site.lon },
    earthVisible: earth.elDeg > derived.horizonFn(earth.azDeg),
  });
}

function renderAll({ heavy = false } = {}) {
  if (heavy || !derived || derived.siteKey !== `${state.site.lat},${state.site.lon}`) recomputeSite();
  timeline.setSeries(derived.series);
  timeline.setCursor(state.dateMs);
  el('tlSite').textContent = state.site.name;
  el('dateInput').value = msToLocalInput(state.dateMs);
  renderMetrics();
  renderSky();
  renderScene();
}

// ---------- actions ----------
function setSite(s) {
  state.site = s;
  state.view = 'auto';
  document.querySelectorAll('.site-btn').forEach((b) => b.classList.toggle('active', b.dataset.id === s.id));
  scene.setTerrainData(null);
  updateViewToggle();
  if (maskFor(s.id)) {
    loadTerrain(s.id).then((data) => {
      if (state.site.id !== s.id || !data) return;
      scene.setTerrainData(data, state.exag);
      updateViewToggle();
      if (effectiveMode() === 'terrain') scene.focusTerrain();
      renderScene();
    });
  }
  scene.focusSite(s.lat, s.lon);
  renderAll({ heavy: true });
}

let lastHeavy = 0;
function setDate(ms, { fromScrub = false } = {}) {
  state.dateMs = ms;
  const recentered = ensureCache();
  if (recentered) {
    recomputeSite();
    timeline.setSeries(derived.series);
  } else if (!fromScrub || Date.now() - lastHeavy > 1500) {
    // refresh countdowns occasionally while scrubbing
    derived.nextSun = nextEvents(derived.site, 'sun', ms, { horizonDays: 60, horizonFn: derived.horizonFn });
    derived.nextEarth = nextEvents(derived.site, 'earth', ms, { horizonDays: 60, horizonFn: derived.horizonFn });
    lastHeavy = Date.now();
  }
  timeline.setCursor(ms);
  el('dateInput').value = msToLocalInput(ms);
  renderMetrics();
  renderSky();
  renderScene();
}

// ---------- controls ----------
el('dateInput').addEventListener('change', (e) => {
  const ms = localInputToMs(e.target.value);
  if (Number.isFinite(ms)) setDate(ms);
});
el('nowBtn').onclick = () => setDate(Date.now());
el('playBtn').onclick = () => {
  state.playing = !state.playing;
  el('playBtn').textContent = state.playing ? '⏸' : '▶';
};
el('speedSel').onchange = (e) => { state.speed = Number(e.target.value); };
el('customGo').onclick = () => {
  const lat = Number(el('customLat').value);
  let lon = Number(el('customLon').value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90) return;
  if (lon > 180) lon -= 360;
  setSite({
    id: 'custom', name: `Custom (${lat.toFixed(2)}, ${lon.toFixed(2)})`, lat, lon,
    group: 'Custom', approx: false,
    note: 'Custom site — smooth-sphere horizon (no terrain mask).',
  });
};

// play loop
let lastT = performance.now();
function tick(t) {
  const dt = (t - lastT) / 1000;
  lastT = t;
  if (state.playing) setDate(state.dateMs + state.speed * 1000 * dt, { fromScrub: true });
  requestAnimationFrame(tick);
}

el('viewToggle').onclick = () => {
  state.view = effectiveMode() === 'terrain' ? 'globe' : 'terrain';
  if (effectiveMode() === 'terrain') scene.focusTerrain();
  else scene.focusSite(state.site.lat, state.site.lon);
  updateViewToggle();
  renderScene();
};

el('exagToggle').onclick = () => {
  state.exag = state.exag === 3 ? 1 : 3;
  scene.setExaggeration(state.exag);
  updateViewToggle();
  renderScene();
};

el('noteBtn').onclick = () => {
  const note = el('sceneNote');
  note.hidden = !note.hidden;
};

// zoom slider <-> camera distance (log scale), synced both ways
const ZOOM_MIN = 0.45, ZOOM_MAX = 12;
const zoomEl = el('zoomSlider');
zoomEl.addEventListener('input', () => {
  const f = Number(zoomEl.value) / 100;
  // slider right (+) = closer, left (−) = farther
  scene.setCamDistance(ZOOM_MAX * Math.pow(ZOOM_MIN / ZOOM_MAX, f));
});
scene.onCameraChange = () => {
  const d = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scene.camDistance()));
  zoomEl.value = Math.round((Math.log(d / ZOOM_MAX) / Math.log(ZOOM_MIN / ZOOM_MAX)) * 100);
};

// ---------- boot ----------
initHelp(el('helpBtn'));
initCompare(el('cmpBtn'), () => ({ t0: cache.t0, t1: cache.t1 }), (s) => setSite(s));
initMission(el('msnBtn'), () => ({ dateMs: state.dateMs, siteName: state.site.name }));
buildSiteList();
setSite(state.site);
requestAnimationFrame(tick);
window.addEventListener('resize', () => { timeline.draw(); renderSky(); });
