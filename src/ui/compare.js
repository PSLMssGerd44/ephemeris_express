/**
 * Site comparison overlay: every catalog site evaluated over the current
 * analysis window — Sun lit %, longest darkness, Earth visible %, longest
 * comms gap — terrain-aware where masks exist. Sortable; click a row to
 * jump to that site.
 */
import { makeSite } from '../physics/topo.js';
import { visibilityWindows, windowMetrics } from '../physics/events.js';
import { SITES } from '../data/sites.js';
import { maskFor, horizonFnFromMask } from '../data/masks.js';
import { fmtDur, fmtUTC } from './format.js';

const day = 86400e3;
let cacheKey = null;
let rowsCache = null;

function computeRow(s, t0, t1) {
  const site = makeSite(s.lat, s.lon);
  const mask = maskFor(s.id);
  const opts = mask ? { horizonFn: horizonFnFromMask(mask) } : {};
  const sun = windowMetrics(visibilityWindows(site, 'sun', t0, t1, opts), t0, t1);
  const earth = windowMetrics(visibilityWindows(site, 'earth', t0, t1, opts), t0, t1);
  return {
    site: s, terrain: !!mask,
    sunPct: sun.fraction * 100, maxDark: sun.longestGapMs,
    earthPct: earth.fraction * 100, maxGap: earth.longestGapMs,
  };
}

const HTML = `
<div class="help-backdrop" id="cmpBackdrop">
  <div class="help-modal cmp-modal">
    <button class="help-close" id="cmpClose">✕</button>
    <h2 style="margin-bottom:2px">Site comparison</h2>
    <p class="lead" id="cmpWindow"></p>
    <div id="cmpStatus" class="approx-note"></div>
    <table class="cmp-table" id="cmpTable">
      <thead><tr>
        <th data-k="name" style="text-align:left">Site</th>
        <th data-k="sunPct">Sun lit %</th>
        <th data-k="maxDark">Longest darkness</th>
        <th data-k="earthPct">Earth visible %</th>
        <th data-k="maxGap">Longest comms gap</th>
        <th data-k="terrain">Horizon</th>
      </tr></thead>
      <tbody></tbody>
    </table>
    <p class="help-foot">Metrics over the current 30-day analysis window. ⛰ = LOLA terrain horizon; ○ = smooth sphere. Click a column to sort, a row to open that site.</p>
  </div>
</div>`;

export function initCompare(buttonEl, getWindow, onPick) {
  const wrap = document.createElement('div');
  wrap.innerHTML = HTML;
  document.body.appendChild(wrap.firstElementChild);
  const backdrop = document.getElementById('cmpBackdrop');
  const close = () => backdrop.classList.remove('open');
  document.getElementById('cmpClose').onclick = close;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });

  let sortK = 'sunPct', sortDir = -1;

  function renderRows(rows) {
    const tb = backdrop.querySelector('tbody');
    const sorted = [...rows].sort((a, b) => {
      if (sortK === 'name') return sortDir * a.site.name.localeCompare(b.site.name);
      if (sortK === 'terrain') return sortDir * (Number(a.terrain) - Number(b.terrain));
      return sortDir * (a[sortK] - b[sortK]);
    });
    tb.innerHTML = sorted.map((r) => `
      <tr data-id="${r.site.id}">
        <td style="text-align:left">${r.site.name}</td>
        <td><div class="pctbar"><i style="width:${r.sunPct.toFixed(0)}%;background:var(--sun)"></i></div>${r.sunPct.toFixed(1)}%</td>
        <td>${fmtDur(r.maxDark)}</td>
        <td><div class="pctbar"><i style="width:${r.earthPct.toFixed(0)}%;background:var(--earth)"></i></div>${r.earthPct.toFixed(1)}%</td>
        <td>${fmtDur(r.maxGap)}</td>
        <td>${r.terrain ? '⛰' : '○'}</td>
      </tr>`).join('');
    tb.querySelectorAll('tr').forEach((tr) => {
      tr.onclick = () => { const s = SITES.find((x) => x.id === tr.dataset.id); if (s) { onPick(s); close(); } };
    });
  }

  backdrop.querySelectorAll('th').forEach((th) => {
    th.onclick = () => {
      const k = th.dataset.k;
      sortDir = sortK === k ? -sortDir : (k === 'name' ? 1 : -1);
      sortK = k;
      if (rowsCache) renderRows(rowsCache);
    };
  });

  buttonEl.onclick = async () => {
    backdrop.classList.add('open');
    const { t0, t1 } = getWindow();
    document.getElementById('cmpWindow').textContent =
      `${fmtUTC(t0)} → ${fmtUTC(t1)}  (${((t1 - t0) / day).toFixed(0)} days)`;
    const key = `${t0}-${t1}`;
    if (cacheKey === key && rowsCache) { renderRows(rowsCache); return; }
    const status = document.getElementById('cmpStatus');
    const rows = [];
    rowsCache = null;
    for (let i = 0; i < SITES.length; i++) {
      status.textContent = `computing ${i + 1}/${SITES.length}: ${SITES[i].name}…`;
      await new Promise((r) => setTimeout(r, 0));   // let the UI breathe
      rows.push(computeRow(SITES[i], t0, t1));
      renderRows(rows);
    }
    status.textContent = '';
    cacheKey = key;
    rowsCache = rows;
  };
}
