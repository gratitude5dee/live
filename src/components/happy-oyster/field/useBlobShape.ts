import { useMemo } from "react";

// Seeded pseudo-random (mulberry32) so every blob is stable across renders.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Catmull-Rom → cubic Bézier for a closed polyline of radial points around a
// center. Returns an SVG path string in the local coordinate space
// [0..2r] × [0..2r] so the blob draws inside its bounding box.
export function useBlobShape(seed: number, radius: number, points = 10, jitter = 0.22) {
  return useMemo(() => {
    const rnd = mulberry32(seed);
    const cx = radius;
    const cy = radius;
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const r = radius * (1 - jitter + rnd() * jitter * 2);
      pts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
    }
    const n = pts.length;
    const get = (i: number) => pts[((i % n) + n) % n];
    let d = `M ${get(0).x.toFixed(2)} ${get(0).y.toFixed(2)}`;
    for (let i = 0; i < n; i++) {
      const p0 = get(i - 1);
      const p1 = get(i);
      const p2 = get(i + 1);
      const p3 = get(i + 2);
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    }
    d += " Z";
    return d;
  }, [seed, radius, points, jitter]);
}
