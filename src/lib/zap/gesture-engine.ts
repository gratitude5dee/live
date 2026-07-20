import type { GestureRecognizerResult } from "@mediapipe/tasks-vision";

export type GestureAction =
  | "commit"
  | "undo"
  | "next_preset"
  | "clear"
  | "snapshot"
  | "toggle_reactive"
  | "toggle_hud";

const GESTURE_ACTION_MAP: Record<string, GestureAction> = {
  Thumb_Up: "commit",
  Thumb_Down: "undo",
  Victory: "next_preset",
  Open_Palm: "clear",
  Closed_Fist: "snapshot",
  ILoveYou: "toggle_reactive",
  Pointing_Up: "toggle_hud",
};

const CONFIDENCE_THRESHOLD = 0.7;
// Wall-clock instead of frame-count so gestures feel identical across
// 60Hz laptops, 120Hz phones, and low-power throttled devices.
const REQUIRED_STREAK_MS = 200;
const COOLDOWN_MS = 1500;
const OPEN_PALM_HOLD_MS = 800;

type State = {
  currentLabel: string | null;
  currentScore: number;
  streakStartMs: number;
  streakLabel: string | null;
  lastFireAt: number;
  openPalmStart: number | null;
  lastFiredLabel: string | null;
};

export class GestureEngine {
  private state: State = {
    currentLabel: null,
    currentScore: 0,
    streakStartMs: 0,
    streakLabel: null,
    lastFireAt: 0,
    openPalmStart: null,
    lastFiredLabel: null,
  };

  onFire: ((label: string, action: GestureAction, score: number) => void) | null =
    null;

  onLiveUpdate:
    | ((label: string | null, score: number, holdProgress: number) => void)
    | null = null;

  ingest(result: GestureRecognizerResult) {
    const now = performance.now();
    // Pick highest-score gesture across hands
    let bestLabel: string | null = null;
    let bestScore = 0;
    for (const hand of result.gestures ?? []) {
      const top = hand[0];
      if (top && top.score > bestScore) {
        bestScore = top.score;
        bestLabel = top.categoryName;
      }
    }

    this.state.currentLabel = bestLabel;
    this.state.currentScore = bestScore;

    // Streak tracking (only for actionable, high-confidence)
    if (bestLabel && bestScore >= CONFIDENCE_THRESHOLD && GESTURE_ACTION_MAP[bestLabel]) {
      if (this.state.streakLabel === bestLabel) {
        // continue streak
      } else {
        this.state.streakLabel = bestLabel;
        this.state.streakStartMs = now;
      }
    } else {
      this.state.streakLabel = null;
      this.state.streakStartMs = 0;
      this.state.openPalmStart = null;
      this.state.lastFiredLabel = null;
    }

    const streakMs =
      this.state.streakLabel && this.state.streakStartMs
        ? now - this.state.streakStartMs
        : 0;

    let holdProgress = 0;

    if (this.state.streakLabel === "Open_Palm" && streakMs >= REQUIRED_STREAK_MS) {
      if (this.state.openPalmStart === null) this.state.openPalmStart = now;
      holdProgress = Math.min(1, (now - this.state.openPalmStart) / OPEN_PALM_HOLD_MS);
    }

    this.onLiveUpdate?.(bestLabel, bestScore, holdProgress);

    if (now - this.state.lastFireAt < COOLDOWN_MS) return;
    if (!this.state.streakLabel || streakMs < REQUIRED_STREAK_MS) return;
    if (this.state.lastFiredLabel === this.state.streakLabel) return;

    const label = this.state.streakLabel;
    const action = GESTURE_ACTION_MAP[label];
    if (!action) return;

    if (label === "Open_Palm" && holdProgress < 1) return;

    this.state.lastFireAt = now;
    this.state.lastFiredLabel = label;
    this.onFire?.(label, action, this.state.currentScore);
  }
}
