/**
 * Scrubbable visibility timeline: Sun and Earth elevation curves over the
 * analysis window, lit/visible spans shaded, with a draggable now-cursor.
 */

export class Timeline {
  constructor(canvas, onScrub) {
    this.canvas = canvas;
    this.onScrub = onScrub;
    this.series = null; // { t0, t1, times[], sunEl[], earthEl[] }
    this.cursorMs = Date.now();

    const toMs = (ev) => {
      if (!this.series) return null;
      const rect = canvas.getBoundingClientRect();
      const frac = Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width));
      return this.series.t0 + frac * (this.series.t1 - this.series.t0);
    };
    let dragging = false;
    canvas.addEventListener('pointerdown', (ev) => {
      dragging = true;
      canvas.setPointerCapture(ev.pointerId);
      const ms = toMs(ev);
      if (ms != null) this.onScrub(ms);
    });
    canvas.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      const ms = toMs(ev);
      if (ms != null) this.onScrub(ms);
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
  }

  setSeries(series) { this.series = series; this.draw(); }
  setCursor(ms) { this.cursorMs = ms; this.draw(); }

  draw() {
    const canvas = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth, H = canvas.clientHeight;
    if (!W || !H) return;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    if (!this.series) return;

    const css = getComputedStyle(document.documentElement);
    const C = {
      line: css.getPropertyValue('--line').trim(),
      dim: css.getPropertyValue('--dim').trim(),
      sun: css.getPropertyValue('--sun').trim(),
      earth: css.getPropertyValue('--earth').trim(),
      text: css.getPropertyValue('--text').trim(),
    };
    const { t0, t1, times, sunEl, earthEl } = this.series;
    const X = (ms) => ((ms - t0) / (t1 - t0)) * W;

    const lanes = [
      { y0: 8, h: (H - 46) / 2, el: sunEl, color: C.sun, label: 'SUN', elMax: 90 },
      { y0: 8 + (H - 46) / 2 + 8, h: (H - 46) / 2, el: earthEl, color: C.earth, label: 'EARTH', elMax: 90 },
    ];

    for (const lane of lanes) {
      // auto-scale per lane for readability (polar sites live within ±10°)
      let m = 5;
      for (const e of lane.el) m = Math.max(m, Math.abs(e));
      m = Math.min(90, m * 1.15);
      const yOf = (el) => lane.y0 + lane.h * (1 - (el + m) / (2 * m));
      const y0line = yOf(0);

      // shaded "up" spans
      ctx.fillStyle = lane.color + '22';
      let spanStart = null;
      for (let i = 0; i < times.length; i++) {
        const up = lane.el[i] > 0;
        if (up && spanStart === null) spanStart = times[i];
        if ((!up || i === times.length - 1) && spanStart !== null) {
          ctx.fillRect(X(spanStart), lane.y0, X(times[i]) - X(spanStart), lane.h);
          spanStart = null;
        }
      }
      // horizon line
      ctx.strokeStyle = C.line; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y0line); ctx.lineTo(W, y0line); ctx.stroke();
      // elevation curve
      ctx.strokeStyle = lane.color; ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < times.length; i++) {
        const x = X(times[i]), y = yOf(lane.el[i]);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
      // label
      ctx.fillStyle = C.dim; ctx.font = '10px system-ui'; ctx.textAlign = 'left';
      ctx.fillText(`${lane.label}  (±${m.toFixed(0)}°)`, 6, lane.y0 + 11);
    }

    // date ticks
    ctx.fillStyle = C.dim; ctx.font = '10px system-ui'; ctx.textAlign = 'center';
    const spanDays = (t1 - t0) / 86400e3;
    const tickEvery = spanDays > 40 ? 7 : spanDays > 15 ? 3 : 1;
    const d0 = new Date(t0); d0.setUTCHours(0, 0, 0, 0);
    for (let ms = d0.getTime(); ms <= t1; ms += tickEvery * 86400e3) {
      if (ms < t0) continue;
      const x = X(ms);
      ctx.strokeStyle = C.line;
      ctx.beginPath(); ctx.moveTo(x, H - 30); ctx.lineTo(x, H - 24); ctx.stroke();
      const d = new Date(ms);
      ctx.fillText(`${d.getUTCMonth() + 1}/${d.getUTCDate()}`, x, H - 14);
    }

    // cursor
    const cx = X(this.cursorMs);
    if (cx >= 0 && cx <= W) {
      ctx.strokeStyle = C.text; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(cx, 4); ctx.lineTo(cx, H - 24); ctx.stroke();
      ctx.fillStyle = C.text;
      ctx.beginPath(); ctx.moveTo(cx - 5, 4); ctx.lineTo(cx + 5, 4); ctx.lineTo(cx, 12); ctx.closePath(); ctx.fill();
    }
  }
}
