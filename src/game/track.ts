import * as THREE from "three";

const RAW: [number, number][] = [
  [0, 0], [60, 0], [100, 20], [110, 60], [80, 90], [40, 80], [20, 110],
  [-30, 120], [-70, 90], [-60, 40], [-95, 10], [-70, -35], [-25, -25],
];

export const curve = new THREE.CatmullRomCurve3(
  RAW.map(([x, z]) => new THREE.Vector3(x * 1.4, 0, z * 1.4)),
  true,
  "centripetal",
);

export const N = 800;
export const ROAD_W = 8; // half width
export const LAPS = 3;
export const samples = curve.getSpacedPoints(N).slice(0, N);
export const tangents = samples.map((_, i) => curve.getTangentAt(i / N));
export const trackLength = curve.getLength();

/** Nearest sample index to (x,z). Windowed search around `hint` when given. */
export function nearest(x: number, z: number, hint = -1) {
  let best = 0;
  let bd = Infinity;
  const from = hint < 0 ? 0 : hint - 40;
  const to = hint < 0 ? N : hint + 40;
  for (let k = from; k < to; k++) {
    const i = ((k % N) + N) % N;
    const p = samples[i];
    const d = (p.x - x) ** 2 + (p.z - z) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return { i: best, d: Math.sqrt(bd) };
}

/** Left-pointing unit vector at sample i. */
export function leftAt(i: number) {
  const t = tangents[i];
  return new THREE.Vector3(t.z, 0, -t.x).normalize();
}

/** Grid spawn slot behind the start line. */
export function gridSlot(slot: number) {
  const row = Math.floor(slot / 2);
  const col = slot % 2 === 0 ? 1 : -1;
  const i = N - 6 - row * 7;
  const p = samples[i];
  const l = leftAt(i);
  const t = tangents[i];
  return {
    x: p.x + l.x * col * 3.2,
    z: p.z + l.z * col * 3.2,
    ry: Math.atan2(t.x, t.z),
    idx: i,
  };
}

export function lapProgress(lap: number, idx: number) {
  return lap + idx / N;
}
