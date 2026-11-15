#!/usr/bin/env python3
"""
Terrain horizon masks from the LOLA polar DEM (LDEM_80S_80M).

For each south-polar site in the catalog, computes the horizon elevation
angle (deg above local horizontal) in 360 azimuth directions by marching
outward along the polar-stereographic map plane and tracking

    el(d) = atan( (h(d) - h_site - d^2 / (2 R)) / d )

where the d^2/(2R) term is the drop of the mean sphere below the site's
horizontal plane (curvature). The maximum over the march is the horizon.

Projection (from the PDS GDR documentation): polar stereographic, pixel
scale true at the pole; colatitude at map-plane distance r meters from the
pole is 2*atan(0.5*r/R). Inverse: r = 2*R*tan(colat/2).
Map-plane distance understates surface distance by <0.8% inside 80S
(scale factor k = (1+sin|lat|)/2); negligible for horizon angles.

Outputs:
  src/data/horizonMasks.json        - 360-point masks per site
  public/terrain/<siteId>.bin       - Float32 heightmap patches (for 3D view)
  public/terrain/<siteId>.json      - patch metadata

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

# South-polar sites from src/data/sites.js (|lat| > 80.3 to stay inside grid
# with margin for the 100 km horizon march)
SITES = {
    "shackleton-peak": (-89.66, 129.2),
    "connecting-ridge": (-89.45, 222.8),
    "malapert-massif": (-85.99, 2.92),
    "de-gerlache-rim": (-88.66, 273.0),
    "nobile-rim-1": (-85.2, 36.5),
    "amundsen-rim": (-84.25, 82.8),
    "im2-athena": (-84.79, 29.19),
}

MARCH_MAX_M = 100_000.0
N_AZ = 360
PATCH_HALF_M = 48_000.0   # 96 km box for 3D terrain
PATCH_PX = 1200


def parse_lbl(path):
    txt = Path(path).read_text(errors="ignore")
    def get(key, cast=float):
        m = re.search(rf"^\s*{key}\s*=\s*([-\w.\"']+)", txt, re.M)
        if not m:
            raise KeyError(key)
        v = m.group(1).strip("\"'")
        return cast(v)
    meta = {
        "lines": get("LINES", int),
        "samples": get("LINE_SAMPLES", int),
        "bits": get("SAMPLE_BITS", int),
        "stype": get("SAMPLE_TYPE", str),
        "scale": get("SCALING_FACTOR"),
        "offset": get("OFFSET"),
        "map_scale": get("MAP_SCALE"),          # m/px
        "line_off": get("LINE_PROJECTION_OFFSET"),
        "samp_off": get("SAMPLE_PROJECTION_OFFSET"),
    }
    return meta


def load_dem(img_path, meta):
    dt = np.dtype("<i2" if "LSB" in meta["stype"] else ">i2")
    dem = np.memmap(img_path, dtype=dt, mode="r",
                    shape=(meta["lines"], meta["samples"]))
    return dem


def latlon_to_xy(lat_deg, lon_deg):
    """South polar stereographic, meters from pole. x=r sin(lon), y=r cos(lon)."""
    colat = math.radians(90.0 + lat_deg)      # 0 at the south pole
    r = 2.0 * R_MOON * math.tan(colat / 2.0)
    lam = math.radians(lon_deg)
    return r * math.sin(lam), r * math.cos(lam)


def make_sampler(dem, meta):
    """Bilinear height sampler h(x, y) in meters (topography above R_MOON)."""
    scale = meta["map_scale"]
    line_off, samp_off = meta["line_off"], meta["samp_off"]
    lines, samples = meta["lines"], meta["samples"]
    sf, off = meta["scale"], meta["offset"]

    def h(x, y):
        # PDS convention: sample = samp_off + x/scale, line = line_off + y/scale
        # (y sign flips between N/S products; verified via --check landmarks)
        s = samp_off + x / scale
        l = line_off + y / scale
        if s < 1 or l < 1 or s > samples - 2 or l > lines - 2:
            return None
        s0, l0 = int(s), int(l)
        fs, fl = s - s0, l - l0
        block = dem[l0:l0 + 2, s0:s0 + 2].astype(np.float64)
        v = (block[0, 0] * (1 - fs) * (1 - fl) + block[0, 1] * fs * (1 - fl)
             + block[1, 0] * (1 - fs) * fl + block[1, 1] * fs * fl)
        # radius = v*sf + off; topographic height above mean radius:
        return v * sf + off - R_MOON

    return h


def horizon_mask(h, lat, lon, verbose=False):
    x0, y0 = latlon_to_xy(lat, lon)
    h0 = h(x0, y0)
    if h0 is None:
        raise ValueError("site outside DEM")
    lam = math.radians(lon)
    # local directions in map plane: north -> toward pole (origin), east tangent
    north = (-math.sin(lam), -math.cos(lam))
    east = (math.cos(lam), -math.sin(lam))
    mask = []
    Rloc = R_MOON + h0
    for a in range(N_AZ):
        ar = math.radians(a)
        ux = math.cos(ar) * north[0] + math.sin(ar) * east[0]
        uy = math.cos(ar) * north[1] + math.sin(ar) * east[1]
        best = -90.0
        d = 160.0
        while d <= MARCH_MAX_M:
            ht = h(x0 + ux * d, y0 + uy * d)
            if ht is None:
                break
            el = math.degrees(math.atan2(ht - h0 - d * d / (2 * Rloc), d))
            if el > best:
                best = el
            d += max(80.0, d * 0.01)   # grow step: fine nearby, coarser far
        mask.append(round(best, 3))
    if verbose:
        print(f"  site h={h0:7.1f} m   horizon min/median/max = "
              f"{min(mask):6.2f} / {sorted(mask)[180]:6.2f} / {max(mask):6.2f} deg")
    return h0, mask


def heightmap_patch(h, lat, lon, site_id, outdir):
    x0, y0 = latlon_to_xy(lat, lon)
    xs = np.linspace(x0 - PATCH_HALF_M, x0 + PATCH_HALF_M, PATCH_PX)
    ys = np.linspace(y0 - PATCH_HALF_M, y0 + PATCH_HALF_M, PATCH_PX)
    grid = np.empty((PATCH_PX, PATCH_PX), dtype=np.float32)
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            v = h(x, y)
            grid[j, i] = np.nan if v is None else v
    # fill any outside-grid corners with edge values
    if np.isnan(grid).any():
        grid = np.nan_to_num(grid, nan=float(np.nanmean(grid)))
    outdir.mkdir(parents=True, exist_ok=True)
    grid.tofile(outdir / f"{site_id}.bin")
    (outdir / f"{site_id}.json").write_text(json.dumps({
        "sizePx": PATCH_PX, "halfSizeM": PATCH_HALF_M,
        "minM": float(grid.min()), "maxM": float(grid.max()),
        "lat": lat, "lon": lon, "source": "LOLA LDEM_80S_80M (NASA/LRO)",
    }))


def selftest():
    """Synthetic DEM: flat plane + one conical mountain 2000 m tall, 10 km
    radius, centered 20 km due 'map-north' of a test site. The horizon mask
    must peak near the azimuth pointing at the mountain with el ~ atan(2000 /
    20000) minus curvature ~= 5.4 deg, and be ~ -curvature elsewhere."""
    meta = {"lines": 4000, "samples": 4000, "bits": 16, "stype": "LSB_INTEGER",
            "scale": 0.5, "offset": R_MOON, "map_scale": 80.0,
            "line_off": 2000.0, "samp_off": 2000.0}
    yy, xx = np.mgrid[0:4000, 0:4000]
    x_m = (xx - meta["samp_off"]) * meta["map_scale"]
    y_m = (yy - meta["line_off"]) * meta["map_scale"]
    lat, lon = -89.0, 0.0
    x0, y0 = latlon_to_xy(lat, lon)
    # mountain 20 km toward the pole (local north) from the site
    lam = math.radians(lon)
    mx = x0 + (-math.sin(lam)) * 20_000
    my = y0 + (-math.cos(lam)) * 20_000
    dist = np.hypot(x_m - mx, y_m - my)
    height_m = np.clip(2000.0 * (1 - dist / 10_000.0), 0, None)
    dem = (height_m / meta["scale"]).astype("<i2")
    h = make_sampler(dem, meta)
    h0, mask = horizon_mask(h, lat, lon, verbose=True)
    peak_az = int(np.argmax(mask))
    peak = max(mask)
    expected = math.degrees(math.atan2(2000 - 10_000**2 / (2 * R_MOON), 10_000))
    print(f"  peak at az={peak_az} deg (expect ~0/360), el={peak:.2f} deg")
    print(f"  (upper bound from cone apex geometry ~ {expected:.2f} deg at 10 km)")
    away = mask[180]
    print(f"  opposite azimuth el={away:.3f} deg (expect ~ -0.07, pure curvature at ~100 km: continuous ground)")
    ok = (peak_az <= 3 or peak_az >= 357) and 4.0 < peak < expected + 0.3 and -0.3 < away < 0.0
    print("  SELFTEST", "PASSED" if ok else "FAILED")
    return 0 if ok else 1


def main():
    if "--selftest" in sys.argv:
        sys.exit(selftest())
    img, lbl = sys.argv[1], sys.argv[2]
    meta = parse_lbl(lbl)
    print("DEM:", meta)
    dem = load_dem(img, meta)
    h = make_sampler(dem, meta)

    # landmark check: Malapert massif should be kilometers above Amundsen floor
    for name, (la, lo) in [("malapert-massif", SITES["malapert-massif"]),
                           ("amundsen-floor", (-84.4, 85.6))]:
        x, y = latlon_to_xy(la, lo)
        print(f"  landmark {name}: h = {h(x, y):8.1f} m")

    masks = {}
    outdir = Path(__file__).resolve().parents[1]
    for sid, (la, lo) in SITES.items():
        print(f"site {sid} ({la}, {lo})")
        h0, mask = horizon_mask(h, la, lo, verbose=True)
        masks[sid] = {"lat": la, "lon": lo, "siteElevM": round(h0, 1),
                      "source": "LOLA LDEM_80S_80M (NASA/LRO), 80 m/px",
                      "elevDeg": mask}
        heightmap_patch(h, la, lo, sid, outdir / "public" / "terrain")
    (outdir / "src" / "data" / "horizonMasks.json").write_text(json.dumps(masks))
    print("wrote src/data/horizonMasks.json and public/terrain/*")


if __name__ == "__main__":
    main()
