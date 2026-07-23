// 4x4 Bayer ordered-dither helpers used by CloudCanvas and the blob rims.

// Normalized 0..1 thresholds (divide by 16, offset by 0.5 to center).
export const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

export function bayerThreshold(x: number, y: number) {
  return BAYER_4X4[y & 3][x & 3];
}

// Parse a "#rrggbb" into [r,g,b].
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}
