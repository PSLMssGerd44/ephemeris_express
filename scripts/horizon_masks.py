#!/usr/bin/env python3
"""
Terrain horizon masks from the LOLA polar DEM (LDEM_80S_80M, NASA/LRO).

For each south-polar site, computes the horizon elevation angle (deg above
local horizontal) in 360 azimuth directions by marching outward in the
polar-stereographic map plane and maximizing

    el(d) = atan( (h(d) - h_site - d^2 / (2 R)) / d )

where d^2/(2R) is the drop of the mean sphere below the site's horizontal
plane (curvature). Projection per the PDS label/GDR docs: polar stereographic
true at the pole, colatitude at map distance r meters = 2*atan(0.5*r/R);
inverse r = 2*R*tan(colat/2). South convention (verified empirically against
four landmarks — Malapert Massif +5.1 km, Cabeus/Amundsen/Shackleton floors
deep): x = r sin(lon), y = -r cos(lon),
sample = SAMPLE_PROJECTION_OFFSET + x/scale, line = LINE_PROJECTION_OFFSET + y/scale.
Local directions in the map plane: north = (-sin lon, cos lon), east = (cos lon, sin lon).
Map-plane distance understates surface distance by <0.8% inside 80S; negligible
for horizon angles. DEM frame: MEAN EARTH/POLAR AXIS (DE421) — same ME frame as
the app's ephemeris core.

Outputs:
  src/data/horizonMasks.json   - 360-point masks per site
  public/terrain/<siteId>.bin  - Float32 heightmap patches (for the 3D view)
  public/terrain/<siteId>.json - patch metadata

Usage:
  python3 scripts/horizon_masks.py --selftest
  python3 scripts/horizon_masks.py <LDEM_80S_80M.IMG> <LDEM_80S_80M.LBL>
"""
import json
import math
import re
import sys
from pathlib import Path

import numpy as np

R_MOON = 1_737_400.0  # m

# Rim/summit sites snapped to the local LOLA elevation crest (see repo docs):
# shackleton-peak -> highest point of Shackleton's rim annulus (+1736 m)
# de-gerlache-rim -> highest point of de Gerlache's rim annulus (+1814 m)
# malapert-massif -> local summit within 8 km of region center (+5172 m)
SITES = {
    "shackleton-peak": (-89.7787, 203.7574),
    "connecting-ridge": (-89.45, 222.8),
    "malapert-massif": (-85.9873, 2.0888),
    "de-gerlache-rim": (-88.6651, 291.5959),
    "nobile-rim-1": (-85.2, 36.5),
    "amundsen-rim": (-82.886, 77.9581),
    "im2-athena": (-84.79, 29.19),
}

MARCH_MAX_M = 100_000.0
N_AZ = 360
PATCH_HALF_M = 48_000.0
PATCH_PX = 768


def parse_lbl(path):
    txt = Path(path).read_text(errors="ignore")
    def get(key, cast=float):
        m = re.search(rf"^\s*{key}\s*=\s*([-\w.\"']+)", txt, re.M)
        if not m:
            raise KeyError(key)
        return cast(m.group(1).strip("\"'"))
    return {
        "lines": get("LINES", int),
        "samples": get("LINE_SAMPLES", int),
        "stype": get("SAMPLE_TYPE", str),
        "scale": get("SCALING_FACTOR"),
        "offset": get("OFFSET"),
        "map_scale": get("MAP_SCALE"),
        "line_off": get("LINE_PROJECTION_OFFSET"),
        "samp_off": get("SAMPLE_PROJECTION_OFFSET"),
    }


def load_dem(img_path, meta):
    dt = np.dtype("<i2" if "LSB" in meta["stype"] else ">i2")
    return np.memmap(img_path, dtype=dt, mode="r",
                     shape=(meta["lines"], meta["samples"]))


def latlon_to_xy(lat_deg, lon_deg):
    colat = math.radians(90.0 + lat_deg)  # 0 at south pole
    r = 2.0 * R_MOON * math.tan(colat / 2.0)
    lam = math.radians(lon_deg)
    return r * math.sin(lam), -r * math.cos(lam)


def make_sampler(dem, meta):
    """Vectorized bilinear height sampler h(x, y) -> meters above R_MOON.
    Accepts scalars or numpy arrays; out-of-grid points return np.nan."""
    scale = meta["map_scale"]
    line_off, samp_off = meta["line_off"], meta["samp_off"]
    lines, samples = meta["lines"], meta["samples"]
    sf = meta["scale"]

    def h(x, y):
        x = np.asarray(x, dtype=np.float64)
        y = np.asarray(y, dtype=np.float64)
        s = samp_off + x / scale
        l = line_off + y / scale
        ok = (s >= 1) & (l >= 1) & (s <= samples - 2) & (l <= lines - 2)
        s0 = np.clip(s.astype(np.int64), 0, samples - 2)
        l0 = np.clip(l.astype(np.int64), 0, lines - 2)
        fs, fl = s - s0, l - l0
        v = (dem[l0, s0] * (1 - fs) * (1 - fl) + dem[l0, s0 + 1] * fs * (1 - fl)
             + dem[l0 + 1, s0] * (1 - fs) * fl + dem[l0 + 1, s0 + 1] * fs * fl)
        out = v * sf
        return np.where(ok, out, np.nan)

    return h


def march_distances():
    """Growing-step march: 80 m steps nearby, ~1% growth, to 100 km (~450 pts)."""
    ds = [160.0]
    while ds[-1] < MARCH_MAX_M:
        ds.append(ds[-1] + max(80.0, ds[-1] * 0.012))
    return np.array(ds)


def horizon_mask(h, lat, lon, verbose=False):
    x0, y0 = latlon_to_xy(lat, lon)
    h0 = float(h(x0, y0))
    if math.isnan(h0):
        raise ValueError("site outside DEM")
    lam = math.radians(lon)
    north = np.array([-math.sin(lam), math.cos(lam)])
    east = np.array([math.cos(lam), math.sin(lam)])
    d = march_distances()
    Rloc = R_MOON + h0
    drop = d * d / (2.0 * Rloc)
    az = np.radians(np.arange(N_AZ))
    # direction per azimuth: (N_AZ, 2)
    u = (np.cos(az)[:, None] * north[None, :] + np.sin(az)[:, None] * east[None, :])
    # points: (N_AZ, n_d)
    px = x0 + u[:, 0:1] * d[None, :]
    py = y0 + u[:, 1:2] * d[None, :]
    ht = h(px, py)                         # nan outside grid
    el = np.degrees(np.arctan2(ht - h0 - drop[None, :], d[None, :]))
    el = np.where(np.isnan(el), -90.0, el)
    mask = np.max(el, axis=1)
    if verbose:
        print(f"  h0={h0:8.1f} m  horizon min/med/max = "
              f"{mask.min():6.2f} / {np.median(mask):6.2f} / {mask.max():6.2f} deg")
    return h0, [round(float(v), 3) for v in mask]


def heightmap_patch(h, lat, lon, site_id, outdir):
    from PIL import Image
    OFF, SCALE = -15000.0, 0.002   # terrain-RGB: h = OFF + code*SCALE
    x0, y0 = latlon_to_xy(lat, lon)
    xs = np.linspace(x0 - PATCH_HALF_M, x0 + PATCH_HALF_M, PATCH_PX)
    ys = np.linspace(y0 - PATCH_HALF_M, y0 + PATCH_HALF_M, PATCH_PX)
    gx, gy = np.meshgrid(xs, ys)
    grid = h(gx, gy).astype(np.float32)
    if np.isnan(grid).any():
        grid = np.nan_to_num(grid, nan=float(np.nanmean(grid)))
    outdir.mkdir(parents=True, exist_ok=True)
    code = np.clip(np.round((grid - OFF) / SCALE), 0, 2**24 - 1).astype(np.uint32)
    rgb = np.zeros((PATCH_PX, PATCH_PX, 3), dtype=np.uint8)
    rgb[..., 0] = (code >> 16) & 0xFF
    rgb[..., 1] = (code >> 8) & 0xFF
    rgb[..., 2] = code & 0xFF
    Image.fromarray(rgb, "RGB").save(outdir / f"{site_id}.png", optimize=True)
    (outdir / f"{site_id}.json").write_text(json.dumps({
        "sizePx": PATCH_PX, "halfSizeM": PATCH_HALF_M,
        "minM": float(grid.min()), "maxM": float(grid.max()),
        "lat": lat, "lon": lon,
        "encoding": {"type": "terrain-rgb", "offsetM": OFF, "scaleM": SCALE},
        "source": "LOLA LDEM_80S_80M (NASA/LRO), ME frame (DE421)",
    }))


def selftest():
    meta = {"lines": 4000, "samples": 4000, "stype": "LSB_INTEGER",
            "scale": 0.5, "offset": R_MOON, "map_scale": 80.0,
            "line_off": 2000.0, "samp_off": 2000.0}
    lat, lon = -89.0, 0.0
    x0, y0 = latlon_to_xy(lat, lon)
    lam = math.radians(lon)
    mx = x0 + (-math.sin(lam)) * 20_000   # 20 km due local north
    my = y0 + (math.cos(lam)) * 20_000
    yy, xx = np.mgrid[0:4000, 0:4000]
    x_m = (xx - meta["samp_off"]) * meta["map_scale"]
    y_m = (yy - meta["line_off"]) * meta["map_scale"]
    dist = np.hypot(x_m - mx, y_m - my)
    dem = (np.clip(2000.0 * (1 - dist / 10_000.0), 0, None) / meta["scale"]).astype("<i2")
    h = make_sampler(dem, meta)
    h0, mask = horizon_mask(h, lat, lon, verbose=True)
    peak_az = int(np.argmax(mask))
    peak = max(mask)
    # exact: apex 2000 m at 20 km -> atan((2000 - 20000^2/2R)/20000)
    exact = math.degrees(math.atan2(2000 - 20_000**2 / (2 * (R_MOON + h0)), 20_000))
    print(f"  peak az={peak_az} (expect 0/359), el={peak:.3f} (exact apex calc {exact:.3f})")
    ok = (peak_az <= 2 or peak_az >= 358) and abs(peak - exact) < 0.05
    print("  SELFTEST", "PASSED" if ok else "FAILED")
    return 0 if ok else 1


def main():
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    img, lbl = sys.argv[1], sys.argv[2]
    meta = parse_lbl(lbl)
    print("DEM meta:", meta)
    dem = load_dem(img, meta)
    h = make_sampler(dem, meta)

    # Landmark sign check: Malapert Massif should be ~ +4..+6 km;
    # Amundsen crater floor ~ -2..-4 km. If both look wrong, the y-sign
    # convention is flipped — abort rather than emit garbage.
    hm = float(h(*latlon_to_xy(-85.99, 2.92)))
    ha = float(h(*latlon_to_xy(-84.5, 85.0)))
    print(f"landmarks: malapert-massif {hm:8.1f} m | amundsen-floor {ha:8.1f} m")
    if not (hm > 2000 and ha < 0):
        print("LANDMARK CHECK FAILED — projection sign suspect, aborting")
        sys.exit(1)

    masks = {}
    root = Path(__file__).resolve().parents[1]
    for sid, (la, lo) in SITES.items():
        print(f"site {sid} ({la}, {lo})")
        h0, mask = horizon_mask(h, la, lo, verbose=True)
        masks[sid] = {"lat": la, "lon": lo, "siteElevM": round(h0, 1),
                      "source": "LOLA LDEM_80S_80M (NASA/LRO), 80 m/px",
                      "elevDeg": mask}
        heightmap_patch(h, la, lo, sid, root / "public" / "terrain")
    (root / "src" / "data" / "horizonMasks.json").write_text(json.dumps(masks))
    print("wrote src/data/horizonMasks.json and public/terrain/*")


if __name__ == "__main__":
    main()
