import type { FaceLandmarkerResult } from "@mediapipe/tasks-vision";

export type FaceAction = "confetti" | "sparkle" | "no_face" | "face_back";

type Trigger = { label: string; threshold: number; sinceMs: number | null; action: FaceAction };

const HOLD_MS = 500;
const NO_FACE_MS = 3000;
const REACTIVE_COOLDOWN_MS = 6000;

export class FaceEngine {
  enabled = false;
  private triggers: Trigger[] = [
    { label: "jawOpen", threshold: 0.6, sinceMs: null, action: "confetti" },
    { label: "browInnerUp", threshold: 0.5, sinceMs: null, action: "sparkle" },
  ];
  private lastReactiveAt = 0;
  private noFaceSince: number | null = null;
  private facePresent = true;

  onReactive: ((action: FaceAction, label: string, score: number) => void) | null = null;
  onFacePresence: ((present: boolean) => void) | null = null;

  ingest(result: FaceLandmarkerResult) {
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

    if (!this.enabled || !hasFace) {
      for (const t of this.triggers) t.sinceMs = null;
      return;
    }

    if (now - this.lastReactiveAt < REACTIVE_COOLDOWN_MS) return;

    const bs = result.faceBlendshapes?.[0]?.categories ?? [];
    for (const t of this.triggers) {
      const cat = bs.find((c) => c.categoryName === t.label);
      const score = cat?.score ?? 0;
      if (score >= t.threshold) {
        if (t.sinceMs === null) t.sinceMs = now;
        if (now - t.sinceMs >= HOLD_MS) {
          this.lastReactiveAt = now;
          t.sinceMs = null;
          this.onReactive?.(t.action, t.label, score);
          return;
        }
      } else {
        t.sinceMs = null;
      }
    }
  }
}
