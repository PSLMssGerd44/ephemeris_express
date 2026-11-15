/**
 * Help / About overlay: what the tool is, how to use it, what every panel
 * means, and a glossary. Opens on first visit; reopenable via the "?" button.
 */

const HTML = `
<div class="help-backdrop" id="helpBackdrop">
  <div class="help-modal">
    <button class="help-close" id="helpClose" title="Close">✕</button>
    <h2>Ephemeris Express</h2>
    <p class="lead">A mission-planning tool that answers two questions for any landing site on
    the Moon, at any date: <b>when does it have sunlight</b> (power), and
    <b>when can it see Earth</b> (communication)?</p>

    <h3>Why is this hard enough to need a tool?</h3>
    <p>The Moon's day lasts ~29.5 Earth days, and near the <b>south pole</b> the Sun never climbs
    more than ~1.5° above the horizon — it just circles it. Whether a site is lit for months or
    dark for weeks is decided by degrees of latitude and meters of terrain. Meanwhile the Earth,
    which hangs almost fixed in the lunar sky, slowly <b>nods and wobbles by ±7–8°</b> (librations):
    at a polar site that's the difference between talking to Earth and two weeks of silence.
    NASA selects Artemis landing sites around exactly these constraints.</p>

    <h3>How to use it</h3>
    <ol>
      <li><b>Pick a site</b> on the left — Artemis III candidate regions, robotic missions, Apollo — or enter custom coordinates.</li>
      <li><b>Pick a time</b> — type a date (UTC), press ▶ to animate, or <b>drag across the timeline</b> at the bottom.</li>
      <li><b>Read the verdict</b> on the right: current Sun/Earth positions, countdowns to sunset/Earthset, and 30-day statistics. The <b>“What this means”</b> card translates the numbers into plain language.</li>
    </ol>

    <h3>Reading the panels</h3>
    <ul>
      <li><b>3D view</b> — the Moon at the selected moment. The red ring is your site. The day/night boundary (the <b>terminator</b>) is computed from the true Sun direction: what you see lit really is lit at that time. The line from the site to Earth is green when a direct radio link is geometrically possible, red when Earth is below the site's horizon. Sun and Earth are drawn in their true <i>directions</i> (distances compressed to fit the view).</li>
      <li><b>Local sky</b> — the sky as seen standing at the site, like a fisheye photo facing up: center = zenith, outer bold ring = horizon, N/E/S/W around the edge. Trails show where the Sun and Earth travel over ±7 days. At polar sites, watch the Sun circle the horizon ring instead of crossing the sky.</li>
      <li><b>Timeline</b> — Sun (gold) and Earth (blue) elevation over 30 days. Shaded spans = above the horizon. Drag to time-travel.</li>
      <li><b>Sun card</b> — elevation drives solar power: a panel's output scales with the sine of elevation for flat panels, so polar landers use vertical arrays. “Longest darkness” sizes the batteries.</li>
      <li><b>Earth card</b> — “DTE” = direct-to-Earth radio. Visible Earth = link possible without a relay satellite. “Longest comms gap” is the autonomy the mission must survive.</li>
    </ul>

    <h3>Glossary</h3>
    <dl>
      <dt>Terminator</dt><dd>The moving line separating lunar day from lunar night.</dd>
      <dt>Elevation / Azimuth</dt><dd>How high above the horizon (0° = on it, 90° = overhead) / compass direction (0° = north, 90° = east).</dd>
      <dt>Libration</dt><dd>The Moon keeps one face toward Earth, but not perfectly — its orbit is elliptical and tilted, so Earth appears to trace a slow ±7–8° figure in the lunar sky over each month. This alone creates Earth-rise/Earth-set cycles at polar sites.</dd>
      <dt>DTE</dt><dd>Direct-to-Earth communication — radio line-of-sight from lander to Earth, no relay orbiter.</dd>
      <dt>Solar limb</dt><dd>The Sun is a disk 0.53° wide, not a point. Sunrise/sunset here use its upper edge — at the poles this changes event times by hours.</dd>
      <dt>Region ≈</dt><dd>Artemis III entries are ~15×15 km candidate <i>regions</i>; the coordinate shown is an approximate center, not a chosen landing point.</dd>
    </dl>

    <h3>Can I trust the numbers?</h3>
    <p>The positions are computed in your browser from the IAU lunar-orientation model (librations included)
    plus a planetary ephemeris, and are <b>validated against NASA/JPL Horizons to ≤0.004°</b> —
    about 1/130th of the Sun's apparent size. Assumption to know about: the horizon is currently a smooth
    sphere; real polar terrain (mountains, crater rims) will trim the sunlight numbers. Terrain-aware
    horizons from NASA LOLA elevation data are the next feature.</p>

    <p class="help-foot">NASA Space Apps Challenge 2026 — <i>Lunar Landing Site Navigator</i>. Open source.</p>
  </div>
</div>`;

export function initHelp(buttonEl) {
  const wrap = document.createElement('div');
  wrap.innerHTML = HTML;
  document.body.appendChild(wrap.firstElementChild);
  const backdrop = document.getElementById('helpBackdrop');
  const close = () => backdrop.classList.remove('open');
  const open = () => backdrop.classList.add('open');
  document.getElementById('helpClose').onclick = close;
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  buttonEl.onclick = open;

  // open on first visit (storage may be unavailable in some embeds)
  let seen = false;
  try { seen = localStorage.getItem('ee-help-seen') === '1'; } catch { /* ignore */ }
  if (!seen) {
    open();
    try { localStorage.setItem('ee-help-seen', '1'); } catch { /* ignore */ }
  }
}
