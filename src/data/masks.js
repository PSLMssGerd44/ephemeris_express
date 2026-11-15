/**
 * Terrain horizon masks computed offline from the LOLA LDEM_80S_80M polar DEM
 * (see scripts/horizon_masks.py). Each mask is the horizon elevation angle in
 * degrees for azimuths 0..359. Sites without a mask fall back to the smooth
 * sphere (horizon at 0°).
 */
import masks from './horizonMasks.json';

export function maskFor(siteId) {
  return masks[siteId] ?? null;
}

/** Interpolating horizon function az(deg) -> horizon elevation (deg). */
export function horizonFnFromMask(mask) {
  const arr = mask.elevDeg;
  return (az) => {
    const a = ((az % 360) + 360) % 360;
    const i = Math.floor(a);
    const f = a - i;
    return arr[i] * (1 - f) + arr[(i + 1) % 360] * f;
  };
}
