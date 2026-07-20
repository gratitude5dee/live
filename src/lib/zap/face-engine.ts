import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

export type FaceAction =
  | "confetti"
  | "sparkle"
  | "no_face"
  | "face_back"
  | "golden_hour"
  | "parallax"
  | "snapshot";

type BlendshapeCategory = { categoryName: string; score: number };

type Trigger = {
  id: string;
  action: FaceAction;
  /** Compute a score from the current blendshape bag. Return 0 to skip. */
  score: (bs: BlendshapeCategory[]) => number;
  threshold: number;
  /** Milliseconds the score must stay above threshold. */
  holdMs: number;
  sinceMs: number | null;
};

const NO_FACE_MS = 3000;
const REACTIVE_COOLDOWN_MS = 6000;
const DOUBLE_BLINK_WINDOW_MS = 700;

function getScore(bs: BlendshapeCategory[], name: string): number {
  return bs.find((c) => c.categoryName === name)?.score ?? 0;
}

export class FaceEngine {
  enabled = false;
  lastResult: FaceLandmarkerResult | null = null;
  /** Head roll in degrees, derived from the 4x4 facial transform matrix. */
  headRollDeg = 0;

  private triggers: Trigger[] = [
    {
      id: "jawOpen",
      action: "confetti",
      score: (bs) => getScore(bs, "jawOpen"),
      threshold: 0.6,
      holdMs: 500,
      sinceMs: null,
    },
    {
      id: "browInnerUp",
      action: "sparkle",
      score: (bs) => getScore(bs, "browInnerUp"),
      threshold: 0.5,
      holdMs: 500,
      sinceMs: null,
    },
    {
      id: "smile",
      action: "golden_hour",
      score: (bs) => (getScore(bs, "mouthSmileLeft") + getScore(bs, "mouthSmileRight")) / 2,
      threshold: 0.7,
      holdMs: 500,
      sinceMs: null,
    },
    {
      id: "headTilt",
      action: "parallax",
      score: () => Math.abs(this.headRollDeg) / 45,
      threshold: 15 / 45, // ~15 degrees
      holdMs: 500,
      sinceMs: null,
    },
  ];

  private lastReactiveAt = 0;
  private noFaceSince: number | null = null;
  private facePresent = true;
  // Double-blink tracking
  private lastBlinkPeak = 0;
  private inBlink = false;

  onReactive: ((action: FaceAction, label: string, score: number) => void) | null = null;
  onFacePresence: ((present: boolean) => void) | null = null;

  ingest(result: FaceLandmarkerResult) {
    this.lastResult = result;
    const now = performance.now();
    const hasFace = (result.faceLandmarks?.length ?? 0) > 0;

    // No-face pause / resume (always active, independent of reactive mode)
    if (!hasFace) {
      if (this.noFaceSince === null) this.noFaceSince = now;
      if (this.facePresent && now - this.noFaceSince > NO_FACE_MS) {
        this.facePresent = false;
        this.onFacePresence?.(false);
      }
    } else {
      this.noFaceSince = null;
      if (!this.facePresent) {
        this.facePresent = true;
        this.onFacePresence?.(true);
      }
    }

    // Derive head roll from the transformation matrix when present.
    const matrix = (result as unknown as {
      facialTransformationMatrixes?: { data: Float32Array | number[] }[];
    }).facialTransformationMatrixes?.[0]?.data;
    if (matrix && matrix.length >= 16) {
      // Column-major 4x4. Roll around Z ≈ atan2(m10, m00).
      const m00 = matrix[0];
      const m10 = matrix[1];
      this.headRollDeg = (Math.atan2(m10, m00) * 180) / Math.PI;
    }

    if (!this.enabled || !hasFace) {
      for (const t of this.triggers) t.sinceMs = null;
      this.inBlink = false;
      return;
    }

    if (now - this.lastReactiveAt < REACTIVE_COOLDOWN_MS) return;

    const bs = (result.faceBlendshapes?.[0]?.categories ?? []) as BlendshapeCategory[];

    // Threshold-based triggers (shared 6s cooldown via lastReactiveAt).
    for (const t of this.triggers) {
      const s = t.score(bs);
      if (s >= t.threshold) {
        if (t.sinceMs === null) t.sinceMs = now;
        if (now - t.sinceMs >= t.holdMs) {
          this.lastReactiveAt = now;
          t.sinceMs = null;
          this.onReactive?.(t.action, t.id, s);
          return;
        }
      } else {
        t.sinceMs = null;
      }
    }

    // Double-blink detector: two eye-blink peaks within DOUBLE_BLINK_WINDOW_MS.
    const eyeScore = (getScore(bs, "eyeBlinkLeft") + getScore(bs, "eyeBlinkRight")) / 2;
    if (eyeScore > 0.5) {
      if (!this.inBlink) {
        this.inBlink = true;
        const peakAt = now;
        if (peakAt - this.lastBlinkPeak <= DOUBLE_BLINK_WINDOW_MS && this.lastBlinkPeak > 0) {
          this.lastReactiveAt = now;
          this.lastBlinkPeak = 0;
          this.onReactive?.("snapshot", "doubleBlink", eyeScore);
          return;
        }
        this.lastBlinkPeak = peakAt;
      }
    } else {
      this.inBlink = false;
    }
  }
}
