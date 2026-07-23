import { useEffect, useRef } from "react";
import { HO } from "./tokens";
import { BAYER_4X4, hexToRgb } from "./dither";

// Static ordered-dither cloud layer. Draws a few low-frequency gray blobs onto
// an offscreen canvas, then rewrites every pixel with a 4×4 Bayer threshold
// so soft cloud edges break into a chunky checkerboard over the paper.

interface Props {
  width: number;
  height: number;
  pixelSize?: number; // chunky pixel size in screen px
  seed?: number;
}

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

export function CloudCanvas({ width, height, pixelSize = 4, seed = 12345 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const cw = Math.max(1, Math.floor(width / pixelSize));
    const ch = Math.max(1, Math.floor(height / pixelSize));
    canvas.width = cw;
    canvas.height = ch;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rnd = mulberry32(seed);
    const paper = hexToRgb(HO.paper);
    const dark = hexToRgb(HO.cloudDark);
    const mid = hexToRgb(HO.cloud);

    // 1. Paint the soft cloud field at low resolution
    ctx.fillStyle = HO.paper;
    ctx.fillRect(0, 0, cw, ch);

    const blobCount = Math.max(10, Math.round((cw * ch) / 9000));
    for (let i = 0; i < blobCount; i++) {
      const cx = rnd() * cw;
      const cy = rnd() * ch;
      const r = (0.12 + rnd() * 0.25) * Math.min(cw, ch);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, `rgba(92,96,99, ${0.85 + rnd() * 0.1})`);
      grad.addColorStop(0.55, `rgba(138,140,139, ${0.4 + rnd() * 0.2})`);
      grad.addColorStop(1, "rgba(138,140,139, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // A second, softer diffuse pass to bind cloud masses together
    for (let i = 0; i < Math.round(blobCount / 3); i++) {
      const cx = rnd() * cw;
      const cy = rnd() * ch;
      const r = (0.25 + rnd() * 0.4) * Math.min(cw, ch);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, "rgba(120,122,121, 0.35)");
      grad.addColorStop(1, "rgba(120,122,121, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Read back, apply Bayer threshold per pixel
    const img = ctx.getImageData(0, 0, cw, ch);
    const data = img.data;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const idx = (y * cw + x) * 4;
        // luminance of the drawn pixel (0..1); paper is bright, cloud dark
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        // "cloudness" = 1 when very dark cloud, 0 when paper
        const cloudness = Math.min(1, Math.max(0, (0.92 - lum) / 0.55));
        const threshold = BAYER_4X4[y & 3][x & 3];
        let out: [number, number, number];
        if (cloudness > 0.72) {
          // Solid interior — use dark tone directly
          out = dark;
        } else if (cloudness > threshold) {
          // Edge dither — pick between mid and dark based on density
          out = cloudness > 0.55 ? dark : mid;
        } else {
          out = paper;
        }
        data[idx] = out[0];
        data[idx + 1] = out[1];
        data[idx + 2] = out[2];
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [width, height, pixelSize, seed]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        imageRendering: "pixelated",
        pointerEvents: "none",
      }}
    />
  );
}
