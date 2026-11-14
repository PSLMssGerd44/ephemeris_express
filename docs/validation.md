# Physics validation

The entire tool rests on one computation: the azimuth/elevation of the Sun
and the Earth as seen from a site on the lunar surface. This document shows
that our implementation agrees with NASA/JPL Horizons to the millidegree
level, and explains why.

## Method

- **Planetary positions**: `astronomy-engine` (VSOP87/ELP-grade analytic
  ephemeris, geocentric EQJ ≈ ICRF vectors).
- **Lunar orientation**: IAU WGCCRE closed-form model (Archinal et al.),
  including all 13 periodic libration terms, giving the Mean-Earth/Polar-Axis
  (ME) frame — the frame of all LRO/LOLA cartographic products and
  selenographic coordinates.
- **Topocentric correction**: the observer is displaced ~1737 km from the
  Moon's center; this parallax shifts Earth's apparent elevation by up to
  ~0.26°, which matters precisely in the regime we care about (Earth hovering
  degrees above a polar horizon).
- **No atmospheric refraction** — the Moon is airless.
- Positions are geometric; Horizons reports "airless apparent" (light-time,
  stellar aberration, gravitational bending). This bounds agreement at the
  few-millidegree level, far below the 0.53° solar disk.

## Reference

JPL Horizons API, fetched 2026-11-14. DE441 ephemeris, `MEAN_ME (high
precision)` center frame, observer site 89.66°S 129.2°E, 0 km (Shackleton
crater area), 2026-11-01 → 2026-11-10, 1-day steps, QUANTITIES=4
(apparent az/el), targets Sun (10) and Earth (399).

## Results

Run `node scripts/validate-horizons.mjs` to reproduce.

| Target | Max \|Δaz\| | Max \|Δel\| |
|--------|------------|------------|
| Sun    | 0.0040°    | 0.0007°    |
| Earth  | 0.0027°    | 0.0010°    |

For scale: the Sun's angular radius from the Moon is ~0.265°. Our worst-case
elevation error is **0.4% of the solar radius** — equivalent to a sunset-time
error of under ~10 seconds at polar sun-drift rates.

## Geometric invariants (sanity suite)

`node scripts/sanity.mjs` additionally verifies, over a full year:

1. Sun elevation at the exact south pole stays within ±1.6° (spin-axis tilt
   to the ecliptic is 1.54°).
2. Earth elevation at the pole stays within ±7.2° (optical librations +
   parallax).
3. Earth stays within 10° of zenith at (0°N, 0°E), the mean sub-Earth point.
4. Sun azimuth at the pole drifts at the synodic rate, ~12.2°/day.
