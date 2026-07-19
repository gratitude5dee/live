import type { GestureRecognizerResult, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { HAND_CONNECTIONS } from "./mediapipe";

export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  result: GestureRecognizerResult | null,
  holdProgress: number,
) {
  const { canvas } = ctx;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!result || !result.landmarks?.length) return;

  const W = canvas.width;
  const H = canvas.height;

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
      ctx.moveTo(pa.x * W, pa.y * H);
      ctx.lineTo(pb.x * W, pb.y * H);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fingertip + wrist dots
    ctx.fillStyle = color;
    for (const idx of [0, 4, 8, 12, 16, 20]) {
      const p = hand[idx];
      if (!p) continue;
      ctx.beginPath();
      ctx.arc(p.x * W, p.y * H, 4, 0, Math.PI * 2);
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
          wrist.x * W,
          wrist.y * H,
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
  alpha = 1,
) {
  const { width: W, height: H } = ctx.canvas;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.beginPath();
  for (const c of connectors) {
    const a = landmarks[c.start];
    const b = landmarks[c.end];
    if (!a || !b) continue;
    ctx.moveTo(a.x * W, a.y * H);
    ctx.lineTo(b.x * W, b.y * H);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawFaceOverlay(
  ctx: CanvasRenderingContext2D,
  result: FaceLandmarkerResult | null,
) {
  if (!result || !result.faceLandmarks?.length) return;
  for (const landmarks of result.faceLandmarks) {
    strokeConnectors(
      ctx,
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_TESSELATION as readonly Conn[],
      "#22D3EE",
      0.5,
      0.25,
    );
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_FACE_OVAL as readonly Conn[], "#FAFAFA", 1.5, 0.9);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS as readonly Conn[], "#F472B6", 1.5, 0.9);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE as readonly Conn[], "#A855F7", 1.5, 0.9);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE as readonly Conn[], "#A855F7", 1.5, 0.9);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW as readonly Conn[], "#67E8F9", 1.2, 0.8);
    strokeConnectors(ctx, landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW as readonly Conn[], "#67E8F9", 1.2, 0.8);
  }
}
