/**
 * DepthEngine — WebGPU-accelerated monocular depth estimation via
 * Transformers.js. Produces a grayscale depth-map MediaStream that can be
 * hot-swapped into the outbound Lucy WebRTC track.
 *
 * Model: onnx-community/depth-anything-v2-small (webgpu, fp16).
 * Runs entirely in-browser; downloads weights from the HF CDN on first use.
 */

export class WebGPUUnsupportedError extends Error {
  constructor() {
    super("WebGPU is not available in this browser");
    this.name = "WebGPUUnsupportedError";
  }
}

export type DepthProgress = { status: string; progress?: number; file?: string };

type DepthPipeline = (
  input: unknown,
) => Promise<{ predicted_depth: { data: Float32Array; dims: number[] } }>;

export interface DepthAttachOptions {
  fps?: number;
  targetAspect?: number;
  targetHeight?: number;
  /** downscaled square edge fed to the model (px) */
  inputSize?: number;
}

export class DepthEngine {
  private pipeline: DepthPipeline | null = null;
  private RawImageCtor: (new (
    data: Uint8ClampedArray,
    width: number,
    height: number,
    channels: number,
  ) => unknown) | null = null;

  readonly canvas: HTMLCanvasElement;
  readonly stream: MediaStream;
  private ctx: CanvasRenderingContext2D;
  private sampleCanvas: HTMLCanvasElement;
  private sampleCtx: CanvasRenderingContext2D;
  private raf: number | null = null;
  private inFlight = false;
  private stopped = false;
  private paused = false;
  private source: HTMLVideoElement | null = null;
  private opts: Required<DepthAttachOptions>;
  private firstFrameResolve: (() => void) | null = null;
  readonly firstFrame: Promise<void>;
  // Hoisted paint buffers — reused across frames to avoid ~24Hz allocation
  // churn. Reallocated only when the model output dimensions change.
  private paintTmpCanvas: HTMLCanvasElement | null = null;
  private paintTmpCtx: CanvasRenderingContext2D | null = null;
  private paintImageData: ImageData | null = null;
  private paintDims: { w: number; h: number } | null = null;
  // Temporal EMA on min/max keeps background brightness stable when someone
  // walks across the scene (per-frame normalization otherwise pumps).
  private emaMin: number | null = null;
  private emaMax: number | null = null;


  constructor(opts: DepthAttachOptions = {}) {
    this.firstFrame = new Promise<void>((res) => {
      this.firstFrameResolve = res;
    });
    this.opts = {
      fps: opts.fps ?? 24,
      targetAspect: opts.targetAspect ?? 9 / 16,
      targetHeight: opts.targetHeight ?? 1280,
      inputSize: opts.inputSize ?? 392,
    };

    const h = this.opts.targetHeight;
    const w = Math.round(h * this.opts.targetAspect);
    this.canvas = document.createElement("canvas");
    this.canvas.width = w;
    this.canvas.height = h;
    const ctx = this.canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("DepthEngine: 2D context unavailable");
    this.ctx = ctx;
    // seed with black so downstream video sender has valid frames pre-warm
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, w, h);

    this.sampleCanvas = document.createElement("canvas");
    this.sampleCanvas.width = this.opts.inputSize;
    this.sampleCanvas.height = this.opts.inputSize;
    const sctx = this.sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sctx) throw new Error("DepthEngine: sample 2D context unavailable");
    this.sampleCtx = sctx;

    const capture = (this.canvas as HTMLCanvasElement & {
      captureStream?: (fps?: number) => MediaStream;
    }).captureStream;
    if (!capture) throw new Error("DepthEngine: captureStream unsupported");
    this.stream = capture.call(this.canvas, this.opts.fps);
  }

  static webgpuAvailable(): boolean {
    return typeof navigator !== "undefined" && "gpu" in navigator;
  }

  async init(onProgress?: (p: DepthProgress) => void) {
    if (this.pipeline) return;
    if (!DepthEngine.webgpuAvailable()) throw new WebGPUUnsupportedError();
    const mod = await import("@huggingface/transformers");
    this.RawImageCtor = mod.RawImage as unknown as typeof this.RawImageCtor;
    const pl = await mod.pipeline(
      "depth-estimation",
      "onnx-community/depth-anything-v2-small",
      {
        device: "webgpu",
        dtype: "fp16",
        progress_callback: (p: unknown) => {
          if (onProgress) onProgress(p as DepthProgress);
        },
      },
    );
    this.pipeline = pl as unknown as DepthPipeline;
  }

  attach(source: HTMLVideoElement) {
    this.source = source;
    if (this.raf === null) this.raf = requestAnimationFrame(this.loop);
  }

  /** Pause inference without tearing down the pipeline — cheap to resume. */
  pause() {
    this.paused = true;
    this.emaMin = null;
    this.emaMax = null;
  }
  resume() {
    this.paused = false;
  }

  private loop = () => {
    if (this.stopped) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.paused) void this.tick();
  };

  private async tick() {
    if (this.inFlight || !this.pipeline || !this.RawImageCtor || !this.source) return;
    const v = this.source;
    if (v.readyState < 2 || v.videoWidth === 0) return;
    this.inFlight = true;
    try {
      const N = this.opts.inputSize;
      const vw = v.videoWidth;
      const vh = v.videoHeight;
      // center-crop → NxN
      const scale = Math.max(N / vw, N / vh);
      const dw = vw * scale;
      const dh = vh * scale;
      const dx = (N - dw) / 2;
      const dy = (N - dh) / 2;
      this.sampleCtx.drawImage(v, dx, dy, dw, dh);
      const imgData = this.sampleCtx.getImageData(0, 0, N, N);
      // RawImage(data, width, height, channels)
      const raw = new this.RawImageCtor(imgData.data, N, N, 4);
      const out = await this.pipeline(raw);
      if (this.stopped) return;
      this.paintDepth(out.predicted_depth.data, out.predicted_depth.dims);
    } catch (err) {
      console.warn("depth inference failed", err);
    } finally {
      this.inFlight = false;
    }
  }

  private paintDepth(data: Float32Array, dims: number[]) {
    // dims: [H, W] or [1, H, W]
    const h = dims[dims.length - 2];
    const w = dims[dims.length - 1];

    // Subsampled min/max scan (every 4th pixel is visually identical, ~4x cheaper).
    let rawMin = Infinity;
    let rawMax = -Infinity;
    for (let i = 0; i < data.length; i += 4) {
      const d = data[i];
      if (d < rawMin) rawMin = d;
      if (d > rawMax) rawMax = d;
    }
    if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) return;
    // Temporal EMA — kills the "walk-through-frame" brightness pump.
    const alpha = 0.1;
    this.emaMin = this.emaMin === null ? rawMin : this.emaMin * (1 - alpha) + rawMin * alpha;
    this.emaMax = this.emaMax === null ? rawMax : this.emaMax * (1 - alpha) + rawMax * alpha;
    const min = this.emaMin;
    const range = (this.emaMax - this.emaMin) || 1;

    // Hoisted paint buffers — only reallocated when output dims change.
    if (!this.paintDims || this.paintDims.w !== w || this.paintDims.h !== h) {
      const tmp = document.createElement("canvas");
      tmp.width = w;
      tmp.height = h;
      const tctx = tmp.getContext("2d");
      if (!tctx) return;
      this.paintTmpCanvas = tmp;
      this.paintTmpCtx = tctx;
      this.paintImageData = new ImageData(w, h);
      this.paintDims = { w, h };
    }
    const src = this.paintImageData!;
    const sd = src.data;
    for (let i = 0; i < data.length; i++) {
      const g = Math.round(((data[i] - min) / range) * 255);
      const j = i * 4;
      sd[j] = g;
      sd[j + 1] = g;
      sd[j + 2] = g;
      sd[j + 3] = 255;
    }
    this.paintTmpCtx!.putImageData(src, 0, 0);
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const s = Math.max(cw / w, ch / h);
    const outW = w * s;
    const outH = h * s;
    const ox = (cw - outW) / 2;
    const oy = (ch - outH) / 2;
    this.ctx.fillStyle = "#000";
    this.ctx.fillRect(0, 0, cw, ch);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.imageSmoothingQuality = "high";
    this.ctx.drawImage(this.paintTmpCanvas!, ox, oy, outW, outH);
    if (this.firstFrameResolve) {
      this.firstFrameResolve();
      this.firstFrameResolve = null;
    }
  }

  waitForFirstFrame(timeoutMs = 4000): Promise<void> {
    return Promise.race([
      this.firstFrame,
      new Promise<void>((_, rej) =>
        setTimeout(() => rej(new Error("depth first frame timeout")), timeoutMs),
      ),
    ]);
  }

  stop() {
    this.stopped = true;
    if (this.raf !== null) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.source = null;
    this.stream.getTracks().forEach((t) => t.stop());
  }
}
