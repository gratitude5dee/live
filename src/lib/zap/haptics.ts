/**
 * Tiny haptic feedback helper. Android exposes `navigator.vibrate`; iOS
 * Safari ignores it silently. We also skip when the user has requested
 * reduced motion so haptics don't fire against explicit accessibility
 * preferences.
 */
export type HapticKind = "tick" | "ack" | "record";

const PATTERNS: Record<HapticKind, number | number[]> = {
  tick: 10,
  ack: [8, 30, 8],
  record: [12, 60, 12],
};

let cachedReduced: boolean | null = null;
function prefersReduced(): boolean {
  if (cachedReduced !== null) return cachedReduced;
  if (typeof window === "undefined") return false;
  cachedReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return cachedReduced;
}

export function haptic(kind: HapticKind): void {
  if (typeof navigator === "undefined") return;
  if (typeof (navigator as Navigator & { vibrate?: unknown }).vibrate !== "function") return;
  if (prefersReduced()) return;
  try {
    (navigator as Navigator & { vibrate: (p: number | number[]) => boolean }).vibrate(
      PATTERNS[kind],
    );
  } catch {
    /* ignore */
  }
}
