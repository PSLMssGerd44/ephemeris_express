/** Smoke test for the event engine: windows + metrics at contrasting sites. */
import { makeSite } from '../src/physics/topo.js';
import { visibilityWindows, windowMetrics, nextEvents } from '../src/physics/events.js';

const t0 = Date.UTC(2026, 9, 1); // Oct 1 2026
const t1 = Date.UTC(2026, 11, 31); // Dec 31 2026
const day = 86400e3;

function report(name, lat, lon) {
  const site = makeSite(lat, lon);
  console.log(`\n=== ${name} (${lat}, ${lon}), Oct 1 – Dec 31 2026 ===`);
  for (const target of ['sun', 'earth']) {
    const w = visibilityWindows(site, target, t0, t1);
    const m = windowMetrics(w, t0, t1);
    console.log(`${target.toUpperCase()}: ${w.length} windows, visible ${(m.fraction * 100).toFixed(1)}%, longest ${(m.longestMs / day).toFixed(2)} d, longest gap ${(m.longestGapMs / day).toFixed(2)} d`);
    for (const win of w.slice(0, 6)) {
      console.log(`   ${new Date(win.startMs).toISOString().slice(0, 16)} -> ${new Date(win.endMs).toISOString().slice(0, 16)} (${((win.endMs - win.startMs) / day).toFixed(2)} d)${win.clippedStart || win.clippedEnd ? ' [clipped]' : ''}`);
    }
  }
  const ne = nextEvents(site, 'sun', Date.UTC(2026, 10, 14));
  console.log(`Next sunrise after Nov 14: ${ne.nextRiseMs ? new Date(ne.nextRiseMs).toISOString().slice(0, 16) : 'none<90d'}, next sunset: ${ne.nextSetMs ? new Date(ne.nextSetMs).toISOString().slice(0, 16) : 'none<90d'}`);
}

report('Peak near Shackleton', -89.66, 129.2);
report('Apollo 11', 0.67416, 23.47314);
report("Chang'e 4 (far side)", -45.444, 177.588);
