/**
 * CompositeStream
 *
 * Draws a source <video> element onto an offscreen canvas each animation
 * frame, invoking a caller-supplied overlay callback after the video is
 * drawn (for MediaPipe landmarks etc.), then exposes the canvas as a live
 * MediaStream via captureStream().
 *
 * This lets us send Lucy the composited feed (webcam + overlays baked in)
 * instead of the raw camera track.
 */

export type CompositeDrawFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) => void;

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
    fps = 30,
  ) {
    this.frameInterval = 1000 / fps;
    this.canvas = document.createElement("canvas");
    // Initial size — resynced on first frame from real videoWidth/Height.
    this.canvas.width = 720;
    this.canvas.height = 1280;
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("CompositeStream: could not acquire 2D context");
    this.ctx = ctx;

    // captureStream returns a MediaStream backed by canvas paints.
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
        const w = v.videoWidth;
        const h = v.videoHeight;
        if (this.canvas.width !== w) this.canvas.width = w;
        if (this.canvas.height !== h) this.canvas.height = h;
        try {
          this.ctx.drawImage(v, 0, 0, w, h);
          this.draw(this.ctx, w, h);
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
