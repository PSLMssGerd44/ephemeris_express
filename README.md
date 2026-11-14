# Ephemeris Express 🌗

**Rapid, scientifically rigorous evaluation of lunar landing sites.**
Built for the NASA Space Apps Challenge — *Lunar Landing Site Navigator*.

Pick a landing site and a date; instantly see where the Sun and Earth sit in
the local sky, how much sunlight a mission gets, how long the darkness lasts,
and when direct-to-Earth (DTE) communication is possible — the constraints
that drive real mission planning at the lunar south pole.

## Why it's trustworthy

The entire tool rests on one computation — Sun/Earth azimuth & elevation from
a lunar site — and that computation is **validated against NASA/JPL Horizons
(DE441)** to a maximum residual of **0.004° azimuth / 0.001° elevation**:
~0.4% of the solar disk radius, equivalent to a sunset-timing error under
~10 seconds. See [`docs/validation.md`](docs/validation.md). CI re-runs the
validation on every push; the site cannot deploy if the physics drifts.

The model includes what actually matters at the poles:

- **Librations** — the full 13-term IAU lunar orientation model. Earth wanders
  ±7–8° in the lunar sky; at a polar site that wobble *is* the comms story
  (Earth sets for ~15 days at a time).
- **Finite solar disk** — sunrise/sunset use the solar upper limb (0.265°
  angular radius). At the poles, where the Sun skims the horizon, this shifts
  events by many hours.
- **Topocentric parallax** — the observer is 1737 km from the Moon's center,
  shifting Earth's apparent elevation by up to 0.26°.
- **No atmospheric refraction** — correctly, because the Moon has none.

## Architecture: the site-independent trick

Sun/Earth direction vectors are computed in the Moon's body-fixed ME frame —
the frame of all LRO/LOLA cartography. Those vectors are the same for every
site; the az/el at any (lat, lon) is a single rotation. The ephemeris
time-series over an analysis window is computed once and cached, so comparing
sites and scrubbing dates is effectively instantaneous, entirely in-browser,
no server, no API calls.

```
astronomy-engine (ICRF positions)
        │
IAU WGCCRE orientation (librations) ──► Sun/Earth vectors in MOON_ME  ── cached, site-independent
        │
topocentric rotation + parallax  ──►  az/el at ANY site  ── O(1) per site
        │
event engine (bisection, solar limb) ──► windows, metrics, countdowns
```

## Run

```bash
npm install
npm run dev        # local dev server
npm run build      # production build -> dist/
npm run validate   # compare against JPL Horizons reference data
npm run sanity     # year-long geometric invariant checks
node scripts/events-test.mjs   # event-engine smoke test
```

## Data & references

- [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) — validation reference (DE441, MEAN_ME frame)
- IAU WGCCRE reports (Archinal et al.) — lunar orientation model
- [astronomy-engine](https://github.com/cosinekitty/astronomy) — planetary positions (MIT)
- NASA Artemis III candidate landing regions (2022 release)
- Mission landing coordinates from NASA/LROC and mission press materials
- Planned: LOLA (Lunar Orbiter Laser Altimeter) polar DEM for terrain horizon
  masks and 3D terrain

## Roadmap

- [x] Validated ephemeris core (Horizons-grade)
- [x] Event engine: rise/set, visibility windows, illumination & comms metrics
- [x] Interactive app: 3D Moon with true terminator, sky plot, scrubbable timeline
- [ ] LOLA DEM terrain horizon masks for south-pole sites
- [ ] 3D terrain scene with physically true shadows
- [ ] Side-by-side site comparison mode
- [ ] Mission context: TLI/launch-window estimator (Lambert, patched-conic)

---

*Solo project by Paulina — aerospace engineering student, Universidad de
Antioquia. Built with assistance from Claude.*
