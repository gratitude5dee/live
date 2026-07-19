/**
 * CompositeStream
 *
 * Draws a source <video> element onto an offscreen portrait canvas each
 * animation frame (center-cropped to a target aspect — default 9:16 to
 * match Lucy + recording), invokes a caller-supplied overlay callback for
 * MediaPipe landmarks etc., then exposes the canvas as a live MediaStream
 * via captureStream().
 */

export type CompositeDrawFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

export interface CompositeOptions {
  fps?: number;
  targetAspect?: number; // width / height, e.g. 9/16 = 0.5625
  targetHeight?: number; // canvas height in px
}

export class CompositeStream {
  readonly canvas: HTMLCanvasElement;
  readonly stream: MediaStream;
  private ctx: CanvasRenderingContext2D;
  private raf: number | null = null;
  private lastDraw = 0;
  private frameInterval: number;
  private stopped = false;

  constructor(
    private source: HTMLVideoElement,
    private draw: CompositeDrawFn,
    opts: CompositeOptions = {},
  ) {
    const fps = opts.fps ?? 30;
    const targetAspect = opts.targetAspect ?? 9 / 16;
    const h = opts.targetHeight ?? 1920;
    const w = Math.round(h * targetAspect);
    this.frameInterval = 1000 / fps;
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("CompositeStream: could not acquire 2D context");
    this.ctx = ctx;

    const anyCanvas = this.canvas as HTMLCanvasElement & {
      captureStream?: (fps?: number) => MediaStream;
    };
    if (!anyCanvas.captureStream) {
      throw new Error("CompositeStream: canvas.captureStream not supported");
    }
    this.stream = anyCanvas.captureStream(fps);
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  private loop(now: number) {
    if (this.stopped) return;
    if (now - this.lastDraw >= this.frameInterval) {
      const v = this.source;
      if (v.readyState >= 2 && v.videoWidth > 0 && v.videoHeight > 0) {
        const cw = this.canvas.width;
        const ch = this.canvas.height;
        const vw = v.videoWidth;
        const vh = v.videoHeight;
        // Center-crop (object-cover) so subject stays framed in portrait.
        const scale = Math.max(cw / vw, ch / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        const dx = (cw - dw) / 2;
        const dy = (ch - dh) / 2;
        try {
          this.ctx.fillStyle = "#000";
          this.ctx.fillRect(0, 0, cw, ch);
          this.ctx.drawImage(v, dx, dy, dw, dh);
          this.draw(this.ctx, cw, ch);
        } catch {
          // ignore transient draw errors (e.g. source not ready)
        }
        this.lastDraw = now;
      }
    }
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.stopped = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.stream.getTracks().forEach((t) => t.stop());
  }
}
