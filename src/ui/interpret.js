/**
 * Live plain-language interpretation: turns the current numbers into the
 * mission-planning sentences a non-specialist can act on.
 */
import { fmtDur } from './format.js';

export function interpret({ site, sunEl, earthEl, sunMetrics, earthMetrics, nextSun, nextEarth, nowMs }) {
  const out = [];
  const polar = Math.abs(site.lat) > 80;

  // --- Sun / power ---
  if (sunEl <= -0.3) {
    out.push(`☀️ It is <b>lunar night</b> here. No solar power — the lander runs on batteries (or a radioisotope heater) until sunrise${nextSun.nextRiseMs ? ` in <b>${fmtDur(nextSun.nextRiseMs - nowMs)}</b>` : ''}.`);
  } else if (sunEl < 3) {
    const horiz = Math.max(0, Math.sin(sunEl * Math.PI / 180)) * 100;
    out.push(`☀️ The Sun is <b>grazing the horizon</b> (${sunEl.toFixed(2)}°) — typical for polar sites. A flat-mounted solar panel would collect only ~${horiz.toFixed(0)}% of full power, which is why polar landers mount their arrays <b>vertically</b>, like sails. Shadows here stretch for kilometers.`);
  } else if (sunEl < 20) {
    out.push(`☀️ Morning/evening-style illumination (Sun at ${sunEl.toFixed(1)}°). Good power with tilted arrays; thermal conditions are mild.`);
  } else {
    out.push(`☀️ High Sun (${sunEl.toFixed(1)}°): abundant power on flat arrays, but surface temperatures soar past 100 °C — thermal management becomes the problem.`);
  }

  // --- Darkness budget ---
  if (sunMetrics.longestGapMs > 36e5) {
    out.push(`🔋 Longest darkness in this 30-day window: <b>${fmtDur(sunMetrics.longestGapMs)}</b>. Batteries (and heaters) must survive that — this number drives lander mass.`);
  } else if (polar) {
    out.push(`🔋 No darkness at all in this window — this is the near-continuous illumination that makes polar peaks prime real estate. (Flat-horizon assumption; real terrain will carve pieces out of this.)`);
  }

  // --- Earth / comms ---
  if (earthEl > 0) {
    out.push(`📡 Earth is <b>${earthEl.toFixed(1)}° above the horizon</b> — the lander can talk to Earth directly, no relay needed${nextEarth.nextSetMs ? `. But Earth sets in <b>${fmtDur(nextEarth.nextSetMs - nowMs)}</b>` : ''}${polar ? ' — at polar sites Earth slowly rises and sets over weeks, purely because of lunar librations (the Moon’s slow nod and wobble relative to Earth)' : ''}.`);
  } else if (earthMetrics.fraction === 0) {
    out.push(`📡 Earth is <b>never visible</b> from this site — it's on the lunar far side. Every byte must go through a relay orbiter (this is why Chang'e 4 needed the Queqiao satellite).`);
  } else {
    out.push(`📡 Earth is <b>below the horizon</b> — no direct-to-Earth link right now. Next Earthrise${nextEarth.nextRiseMs ? ` in <b>${fmtDur(nextEarth.nextRiseMs - nowMs)}</b>` : ': beyond 60 days'}. Until then: relay satellite or silence.`);
  }
  if (earthMetrics.longestGapMs > 86400e3 && earthMetrics.fraction > 0) {
    out.push(`⏳ Worst comms blackout this window: <b>${fmtDur(earthMetrics.longestGapMs)}</b> without direct Earth contact. Mission ops must plan autonomy for that stretch.`);
  }

  return out;
}
