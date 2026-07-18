import { fal } from "@fal-ai/client";
import { mintFalRealtimeToken } from "@/lib/fal-token.functions";
import { LUCY_APP } from "./types";

export type FalResult =
  | { type: "iceServers"; iceServers: RTCIceServer[] }
  | { type: "answer"; sdp: string }
  | { type: "candidate"; candidate: RTCIceCandidateInit }
  | { image: { url: string } | string }
  | Record<string, unknown>;

type TransportCallbacks = {
  onOutputStream: (stream: MediaStream) => void;
  onTransportChosen: (t: "webrtc" | "frame") => void;
  onError: (e: unknown) => void;
};

export type TransportSend = (payload: {
  prompt: string;
  enable_prompt_expansion?: boolean;
  reference_image_url?: string;
  image_url?: string;
}) => void;

export class VideoTransport {
  private inputStream: MediaStream;
  private cb: TransportCallbacks;
  private connection: ReturnType<typeof fal.realtime.connect> | null = null;
  private pc: RTCPeerConnection | null = null;
  private mode: "webrtc" | "frame" | null = null;
  private fallbackTimer: number | null = null;
  private frameLoopHandle: number | null = null;
  private lastPayload:
    | { prompt: string; enable_prompt_expansion?: boolean; reference_image_url?: string }
    | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private outputCanvas: HTMLCanvasElement | null = null;
  private outputImg: HTMLImageElement | null = null;
  private outputStreamOut: MediaStream | null = null;
  private closed = false;

  constructor(inputStream: MediaStream, cb: TransportCallbacks) {
    this.inputStream = inputStream;
    this.cb = cb;
  }

  private rawSend(payload: Record<string, unknown>) {
    (this.connection as unknown as { send?: (p: unknown) => void } | null)?.send?.(payload);
  }


  async start() {
    this.connection = fal.realtime.connect(LUCY_APP, {
      throttleInterval: 0,
      onResult: (result) => this.handleResult(result as FalResult),
      onError: (e) => this.cb.onError(e),
      // @ts-expect-error tokenProvider is supported at runtime by @fal-ai/client
      tokenProvider: async () => {
        const { token } = await mintFalRealtimeToken({ data: { app: LUCY_APP } });
        return token;
      },
    });

    // Give WebRTC 8s to produce a remote track, otherwise fall back.
    this.fallbackTimer = window.setTimeout(() => {
      if (this.mode !== "webrtc") this.switchToFrame();
    }, 8000);
  }

  send: TransportSend = (payload) => {
    this.lastPayload = {
      prompt: payload.prompt,
      enable_prompt_expansion: payload.enable_prompt_expansion,
      reference_image_url: payload.reference_image_url,
    };
    if (!this.connection) return;
    if (this.mode === "frame") {
      // frame mode also needs image_url; skip send here (frame loop attaches it)
      return;
    }
    this.connection.send({
      prompt: payload.prompt,
      enable_prompt_expansion: payload.enable_prompt_expansion ?? true,
      ...(payload.reference_image_url
        ? { reference_image_url: payload.reference_image_url }
        : {}),
    });
  };

  private async handleResult(result: FalResult) {
    // Frame push mode: output image
    const r = result as Record<string, unknown>;
    if (r.image) {
      const url =
        typeof r.image === "string" ? r.image : (r.image as { url?: string }).url;
      if (url && this.mode !== "webrtc") {
        this.mode ??= "frame";
        this.paintFrame(url);
      }
      return;
    }

    // WebRTC signaling
    if (r.type === "iceServers" && Array.isArray(r.iceServers)) {
      await this.beginWebRTC(r.iceServers as RTCIceServer[]);
    } else if (r.type === "answer" && typeof r.sdp === "string") {
      if (this.pc) {
        await this.pc.setRemoteDescription({ type: "answer", sdp: r.sdp });
      }
    } else if (r.type === "candidate" && r.candidate) {
      if (this.pc) {
        await this.pc.addIceCandidate(r.candidate as RTCIceCandidateInit);
      }
    }
  }

  private async beginWebRTC(iceServers: RTCIceServer[]) {
    try {
      const pc = new RTCPeerConnection({ iceServers });
      this.pc = pc;
      for (const track of this.inputStream.getVideoTracks()) {
        pc.addTrack(track, this.inputStream);
      }
      pc.ontrack = (ev) => {
        if (this.closed) return;
        const [remote] = ev.streams;
        if (remote) {
          this.mode = "webrtc";
          if (this.fallbackTimer) {
            clearTimeout(this.fallbackTimer);
            this.fallbackTimer = null;
          }
          this.cb.onTransportChosen("webrtc");
          this.cb.onOutputStream(remote);
        }
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate && this.connection) {
          this.connection.send({
            type: "candidate",
            candidate: ev.candidate.toJSON(),
          });
        }
      };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.connection?.send({ type: "offer", sdp: offer.sdp });
    } catch (e) {
      this.cb.onError(e);
      this.switchToFrame();
    }
  }

  private switchToFrame() {
    if (this.mode === "frame") return;
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
      this.pc = null;
    }
    this.mode = "frame";
    this.cb.onTransportChosen("frame");
    this.startFrameLoop();
  }

  private startFrameLoop() {
    // Grabs a 1280x720 frame at ~12fps and sends it to fal.
    const video = document.createElement("video");
    video.srcObject = this.inputStream;
    video.muted = true;
    video.playsInline = true;
    video.play().catch(() => {});
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    this.canvas = canvas;
    const ctx = canvas.getContext("2d")!;
    let inFlight = false;
    const tick = () => {
      if (this.closed) return;
      if (!inFlight && video.readyState >= 2 && this.lastPayload) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        inFlight = true;
        try {
          this.connection?.send({
            prompt: this.lastPayload.prompt,
            enable_prompt_expansion:
              this.lastPayload.enable_prompt_expansion ?? true,
            image_url: dataUrl,
            ...(this.lastPayload.reference_image_url
              ? { reference_image_url: this.lastPayload.reference_image_url }
              : {}),
          });
        } catch (e) {
          this.cb.onError(e);
        }
        // Reset in-flight quickly; fal streams results independently.
        window.setTimeout(() => (inFlight = false), 80);
      }
    };
    this.frameLoopHandle = window.setInterval(tick, 1000 / 12);

    // Output canvas -> stream for recording
    if (!this.outputCanvas) {
      this.outputCanvas = document.createElement("canvas");
      this.outputCanvas.width = 1280;
      this.outputCanvas.height = 720;
      const stream = this.outputCanvas.captureStream(30);
      this.outputStreamOut = stream;
      this.cb.onOutputStream(stream);
    }
  }

  private paintFrame(url: string) {
    if (!this.outputCanvas) return;
    if (!this.outputImg) this.outputImg = new Image();
    const img = this.outputImg;
    const ctx = this.outputCanvas.getContext("2d")!;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, this.outputCanvas!.width, this.outputCanvas!.height);
    };
    img.src = url;
  }

  close() {
    this.closed = true;
    if (this.fallbackTimer) clearTimeout(this.fallbackTimer);
    if (this.frameLoopHandle) clearInterval(this.frameLoopHandle);
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
    }
    try {
      this.connection?.close();
    } catch {}
  }
}
