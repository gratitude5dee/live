import type { GestureRecognizerResult, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { HAND_CONNECTIONS } from "./mediapipe";

/**
 * Rect describing where the source video is actually painted inside the
 * canvas (object-cover cropping). Landmarks are normalized to the raw
 * video, so we map them into this rect — not the full canvas — otherwise
 * they drift when the video and canvas aspect ratios differ.
 */
export type OverlayRect = { dx: number; dy: number; dw: number; dh: number };

function rectFromCanvas(ctx: CanvasRenderingContext2D, rect?: OverlayRect): OverlayRect {
  if (rect) return rect;
  return { dx: 0, dy: 0, dw: ctx.canvas.width, dh: ctx.canvas.height };
}

export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  result: GestureRecognizerResult | null,
  holdProgress: number,
  rect?: OverlayRect,
) {
  if (!result || !result.landmarks?.length) return;
  const { dx, dy, dw, dh } = rectFromCanvas(ctx, rect);

  result.landmarks.forEach((hand, i) => {
    const handed = result.handedness?.[i]?.[0]?.categoryName ?? "Right";
    // Mirror-aware: input PiP is mirrored (-scale-x-100), so flip handedness label
    const isRight = handed === "Left";
    const color = isRight ? "#22D3EE" : "#E879F9";

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (const [a, b] of HAND_CONNECTIONS) {
      const pa = hand[a];
      const pb = hand[b];
      if (!pa || !pb) continue;
      ctx.moveTo(dx + pa.x * dw, dy + pa.y * dh);
      ctx.lineTo(dx + pb.x * dw, dy + pb.y * dh);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fingertip + wrist dots
    ctx.fillStyle = color;
    for (const idx of [0, 4, 8, 12, 16, 20]) {
      const p = hand[idx];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(dx + p.x * dw, dy + p.y * dh, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Open-palm hold ring at wrist
    if (holdProgress > 0 && i === 0) {
      const wrist = hand[0];
      if (wrist) {
        ctx.strokeStyle = "#FAFAFA";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(
          dx + wrist.x * dw,
          dy + wrist.y * dh,
          22,
          -Math.PI / 2,
          -Math.PI / 2 + Math.PI * 2 * holdProgress,
        );
        ctx.stroke();
      }
    }
  });
}

type Conn = { start: number; end: number };

function strokeConnectors(
  ctx: CanvasRenderingContext2D,
  landmarks: Array<{ x: number; y: number }>,
  connectors: readonly Conn[],
  color: string,
  lineWidth: number,
  alpha: number,
  rect: OverlayRect,
) {
  const { dx, dy, dw, dh } = rect;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (const c of connectors) {
    const a = landmarks[c.start];
    const b = landmarks[c.end];
    if (!a || !b) continue;
    ctx.moveTo(dx + a.x * dw, dy + a.y * dh);
    ctx.lineTo(dx + b.x * dw, dy + b.y * dh);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  result: FaceLandmarkerResult | null,
  rect?: OverlayRect,
) {
  if (!result || !result.faceLandmarks?.length) return;
  const r = rectFromCanvas(ctx, rect);
  for (const landmarks of result.faceLandmarks) {
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION as readonly Conn[], "#22D3EE", 0.5, 0.25, r);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL as readonly Conn[], "#FAFAFA", 1.5, 0.9, r);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS as readonly Conn[], "#F472B6", 1.5, 0.9, r);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE as readonly Conn[], "#A855F7", 1.5, 0.9, r);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE as readonly Conn[], "#A855F7", 1.5, 0.9, r);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW as readonly Conn[], "#67E8F9", 1.2, 0.8, r);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW as readonly Conn[], "#67E8F9", 1.2, 0.8, r);
  }
}
