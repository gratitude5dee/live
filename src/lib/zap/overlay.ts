import type { GestureRecognizerResult } from "@mediapipe/tasks-vision";
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
