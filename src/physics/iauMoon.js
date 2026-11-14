/**
 * IAU WGCCRE lunar orientation model (Archinal et al. 2011/2018 report).
 *
 * Gives the orientation of the Moon's Mean-Earth/Polar-Axis (ME) frame with
 * respect to the ICRF, including the 13 periodic libration terms. The ME frame
 * is the frame in which LRO/LOLA cartographic products (and selenographic
 * lat/lon coordinates) are expressed.
 *
 * Accuracy vs. the full DE421/DE440 numerical orientation: ~0.005 deg
 * (~150 m on the surface), far below the angular size of the Sun (0.53 deg)
 * and more than sufficient for illumination / comms-window analysis.
 *
 * Inputs are days of Terrestrial Time (TT) since J2000.0 (TT ~ TDB to <2 ms,
 * entirely negligible here).
 */

const DEG = Math.PI / 180;

// Nutation-precession angles E1..E13: [constant (deg), rate (deg/day)]
// Values from the WGCCRE report tables (corrected signs for E3/E4).
const E_ARGS = [
  [125.045, -0.0529921],  // E1
  [250.089, -0.1059842],  // E2
  [260.008, 13.0120009],  // E3
  [176.625, 13.3407154],  // E4
  [357.529, 0.9856003],   // E5
  [311.589, 26.4057084],  // E6
  [134.963, 13.0649930],  // E7
  [276.617, 0.3287146],   // E8
  [34.226, 1.7484877],    // E9
  [15.134, -0.1589763],   // E10
  [119.743, 0.0036096],   // E11
  [239.961, 0.1643573],   // E12
  [25.053, 12.9590088],   // E13
];

/**
 * Euler angles (degrees) of the lunar ME frame at time d (TT days since J2000).
 * alpha, delta: ICRF right ascension / declination of the Moon's north pole.
 * W: prime meridian angle.
 */
export function moonEulerAngles(d) {
  const T = d / 36525;
  const s = new Array(13);
  const c = new Array(13);
  for (let i = 0; i < 13; i++) {
    const E = (E_ARGS[i][0] + E_ARGS[i][1] * d) * DEG;
    s[i] = Math.sin(E);
    c[i] = Math.cos(E);
  }

  const alpha = 269.9949 + 0.0031 * T
    - 3.8787 * s[0] - 0.1204 * s[1] + 0.0700 * s[2] - 0.0172 * s[3]
    + 0.0072 * s[5] - 0.0052 * s[9] + 0.0043 * s[12];

  const delta = 66.5392 + 0.0130 * T
    + 1.5419 * c[0] + 0.0239 * c[1] - 0.0278 * c[2] + 0.0068 * c[3]
    - 0.0029 * c[5] + 0.0009 * c[6] + 0.0008 * c[9] - 0.0009 * c[12];

  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d
    + 3.5610 * s[0] + 0.1208 * s[1] - 0.0642 * s[2] + 0.0158 * s[3]
    + 0.0252 * s[4] - 0.0066 * s[5] - 0.0047 * s[6] - 0.0046 * s[7]
    + 0.0028 * s[8] + 0.0052 * s[9] + 0.0040 * s[10] + 0.0019 * s[11]
    - 0.0044 * s[12];

  return { alpha, delta, W };
}

/**
 * 3x3 rotation matrix taking an ICRF (J2000 equatorial) vector into the
 * Moon's body-fixed ME frame:  R = Rz(W) * Rx(90 - delta) * Rz(90 + alpha).
 * Returned as an array of 3 row arrays.
 */
export function icrfToMoonFixedMatrix(d) {
  const { alpha, delta, W } = moonEulerAngles(d);
  const a = (90 + alpha) * DEG;   // Rz
  const b = (90 - delta) * DEG;   // Rx
  const w = W * DEG;              // Rz

  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cw = Math.cos(w), sw = Math.sin(w);

  // Rz(a)
  // [ ca  sa 0; -sa ca 0; 0 0 1 ]
  // Rx(b)
  // [ 1 0 0; 0 cb sb; 0 -sb cb ]
  // Rz(w)
  // [ cw sw 0; -sw cw 0; 0 0 1 ]
  // R = Rz(w) * Rx(b) * Rz(a):
  return [
    [cw * ca - sw * cb * sa, cw * sa + sw * cb * ca, sw * sb],
    [-sw * ca - cw * cb * sa, -sw * sa + cw * cb * ca, cw * sb],
    [sb * sa, -sb * ca, cb],
  ];
}

/** Apply 3x3 matrix (rows) to vector [x,y,z]. */
export function matVec(M, v) {
  return [
    M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
    M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
    M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2],
  ];
}
