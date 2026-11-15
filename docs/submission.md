# Space Apps submission package — Ephemeris Express

Team: **Ephemeris Express Team — Paulina Sandoval**
Challenge: *Lunar Landing Site Navigator*
Live demo: https://pslmssgerd44.github.io/ephemeris_express/
Repository: https://github.com/PSLMssGerd44/ephemeris_express

---

## 28-second demo script

| t | SHOW (screen) | SAY |
|---|---|---|
| 0–4 s | App already open on **Shackleton Rim crest, Terrain view**, ▶ animation running at 1 d/s | "This is **Ephemeris Express** — mission planning for the lunar south pole." |
| 4–9 s | Keep animating: shadows sweeping across the terrain; mouse-orbit slightly | "Real NASA LOLA terrain, lit by the true Sun — validated against JPL Horizons to four *thousandths* of a degree." |
| 9–14 s | Click **Globe view**; point cursor at the Earth link line and the **Earth — DTE comms** card | "It predicts solar power and Earth-communication windows for any site, any date…" |
| 14–19 s | Click **IM-2 Athena** in the sidebar; the Sun % drops and the interpreter card updates | "…including why IM-2 froze in the dark — at this exact spot." |
| 19–24 s | Click **Compare**: the all-sites table appears; hover a row | "Compare every Artemis candidate region instantly…" |
| 24–28 s | Click **🚀 Mission**: ΔV-vs-TOF chart + launch windows; end on the chart | "…then plan the launch that gets you there. **Ephemeris Express.**" |

Recording tips: 1920×1080 browser window, hide bookmarks bar, do one
rehearsal pass so the site data is cached (terrain loads instantly the second
time), and speak over a screen recording rather than trying to do both live.

---

## Summary (for the submission form)

Ephemeris Express is a browser-based mission-planning tool that answers the
two questions that decide every lunar south-pole landing: when does a site
have sunlight (power), and when can it see Earth (communication)? Built for
the Lunar Landing Site Navigator challenge, it computes Sun and Earth
positions for any lunar site and date with a physics core validated against
NASA/JPL Horizons to 0.004° — including lunar librations, the finite solar
disk, and topocentric parallax. NASA's LOLA laser-altimeter elevation model
is integrated structurally: 360-azimuth terrain horizon masks correct every
illumination and comms metric, and a 3D terrain view renders real south-polar
topography with computed, time-accurate shadows. Mission planners can compare
all Artemis III candidate regions in one click, scrub decades of dates
instantly, and back-compute the Earth-departure picture — ΔV versus time of
flight and launch windows from six real launch sites. A built-in guide and a
live plain-language interpreter make the same tool useful to engineers,
educators, and the public. Everything runs client-side, free and open source.

*(~175 words)*

## Project Details (for the submission form)

**What it does.** Ephemeris Express evaluates lunar landing sites in
seconds. Pick a site — any of the 13 curated sites (Artemis III candidate
regions, CLPS and international robotic landings, Apollo) or custom
coordinates — and a date. The tool shows the Sun and Earth in the local sky,
countdowns to sunset/Earthset, 30-day illumination and direct-to-Earth
communication statistics, a scrubbable timeline, a 3D view with a physically
correct terminator, and — for south-polar sites — real LOLA terrain with
computed shadows. A comparison table scores every site over the same window,
and a mission planner estimates trans-lunar injection ΔV, C3, arrival
v-infinity, LOI, and plane-alignment launch windows for six launch sites.

**How it works.** The core insight: Sun/Earth direction vectors expressed in
the Moon's body-fixed ME frame are site-independent, so one cached ephemeris
time-series serves every site — az/el at any coordinates is a single rotation,
making comparison effectively free, with no server and no API calls. Positions
come from an analytic planetary ephemeris plus the IAU WGCCRE lunar
orientation model with all 13 libration terms; topocentric parallax and the
Sun's 0.53° disk are modeled; there is no atmospheric refraction, correctly.
The pipeline that processes the LOLA LDEM_80S_80M polar DEM verifies its
projection against four known landmarks and even snapped our rim sites to the
true LOLA elevation crests — it caught one of our own site guesses sitting
3 km deep inside Amundsen crater.

**Validation.** Every angle is validated against NASA/JPL Horizons (DE441):
maximum residual 0.004° azimuth / 0.001° elevation — about 1/130th of the
solar disk. The validation re-runs in CI on every commit; the site cannot
deploy if the physics drifts. A year-long geometric invariant suite (polar
Sun within ±1.6°, librations within ±8°, synodic rates) guards the frame
chain.

**Benefits and impact.** The challenge notes that mission planners must
re-evaluate sites quickly when schedules slip, and that existing tools are
hard to use for rapid comparison. Ephemeris Express makes that evaluation
instant and visual, and the same physics teaches: select IM-2 Athena and the
tool shows the harsh lighting at the exact spot where that lander froze; the
far-side Chang'e 4 shows Earth permanently below the horizon — why relay
satellites exist. A built-in guide, glossary, hover explanations, and a live
"What this means" interpreter translate every number into mission language
for students and the public.

**Tools.** JavaScript (ES modules), Three.js, Vite, astronomy-engine;
Python/NumPy for the offline LOLA pipeline; GitHub Actions CI with a
validation gate; GitHub Pages hosting. NASA data: LRO LOLA GDR (PDS), JPL
Horizons, Artemis III candidate regions. Fully open source.

**Creativity.** The site-independent ephemeris architecture, terrain shadows
that are computed rather than painted, landmark-verified data processing, a
validation-gated deploy pipeline, and the flat-vs-terrain comparison insight
(terrain *helps* summit sites and *hurts* plateau sites) are, to our
knowledge, unique among rapid site-evaluation tools.
