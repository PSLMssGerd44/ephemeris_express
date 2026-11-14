/**
 * Polar sky plot: zenith at center, horizon at the outer bold ring,
 * azimuth clockwise from North (up). Shows ±7-day Sun/Earth tracks and
 * current positions. Elevations down to -12° are drawn (dimmed) outside the
 * horizon ring so polar "grazing" geometry stays readable.
 */

const EL_MIN = -12;

function rOf(el, R) {
  // el 90 -> 0, el 0 -> R*0.88 (horizon ring), el EL_MIN -> R
  const horizonR = 0.88;
  if (el >= 0) return ((90 - el) / 90) * R * horizonR;
  return R * (horizonR + (Math.min(-el, -EL_MIN) / -EL_MIN) * (1 - horizonR));
}

function xy(az, el, cx, cy, R) {
  const r = rOf(el, R);
  const a = ((az - 90) * Math.PI) / 180; // N up, E right, az clockwise
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

export function drawSkyPlot(canvas, { sunTrack, earthTrack, sunNow, earthNow }) {
  const dpr = window.devicePixelRatio || 1;
  const size = canvas.clientWidth || 300;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2, R = size / 2 - 14;
  const css = getComputedStyle(document.documentElement);
  const C = {
    line: css.getPropertyValue('--line').trim() || '#262c3b',
    dim: css.getPropertyValue('--dim').trim() || '#8b94a8',
    sun: css.getPropertyValue('--sun').trim() || '#ffd166',
    earth: css.getPropertyValue('--earth').trim() || '#4cc9f0',
  };

  // elevation rings
  ctx.lineWidth = 1;
  for (const el of [60, 30]) {
    ctx.strokeStyle = C.line;
    ctx.beginPath(); ctx.arc(cx, cy, rOf(el, R), 0, 2 * Math.PI); ctx.stroke();
  }
  // horizon
  ctx.strokeStyle = C.dim; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, rOf(0, R), 0, 2 * Math.PI); ctx.stroke();
  // below-horizon limit
  ctx.setLineDash([3, 4]); ctx.strokeStyle = C.line; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, rOf(EL_MIN, R), 0, 2 * Math.PI); ctx.stroke();
  ctx.setLineDash([]);

  // cardinal labels
  ctx.fillStyle = C.dim; ctx.font = '11px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy - R - 7 + 14);
  ctx.fillText('S', cx, cy + R + 7 - 14);
  ctx.fillText('E', cx + R + 7 - 14, cy);
  ctx.fillText('W', cx - R - 7 + 14, cy);

  // tracks
  const drawTrack = (track, color) => {
    ctx.lineWidth = 1.4;
    let prev = null;
    for (const p of track) {
      if (p.elDeg < EL_MIN) { prev = null; continue; }
      const pt = xy(p.azDeg, p.elDeg, cx, cy, R);
      if (prev) {
        ctx.strokeStyle = color;
        ctx.globalAlpha = p.elDeg >= 0 ? 0.75 : 0.25;
        ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(pt[0], pt[1]); ctx.stroke();
      }
      prev = pt;
    }
    ctx.globalAlpha = 1;
  };
  drawTrack(sunTrack, C.sun);
  drawTrack(earthTrack, C.earth);

  // current markers
  const marker = (p, color, rad) => {
    if (!p || p.elDeg < EL_MIN) return;
    const [x, y] = xy(p.azDeg, p.elDeg, cx, cy, R);
    ctx.fillStyle = color;
    ctx.globalAlpha = p.elDeg >= 0 ? 1 : 0.4;
    ctx.beginPath(); ctx.arc(x, y, rad, 0, 2 * Math.PI); ctx.fill();
    ctx.globalAlpha = 1;
  };
  marker(sunNow, C.sun, 6);
  marker(earthNow, C.earth, 5);
}
