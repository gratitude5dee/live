import { fal } from "@fal-ai/client";
import { mintFalRealtimeToken } from "@/lib/fal-token.functions";
import { LUCY_APP } from "./types";

type FalPayload = Record<string, unknown>;

type TransportCallbacks = {
  onOutputStream: (stream: MediaStream) => void;
  onTransportChosen: (t: "webrtc") => void;
  onError: (e: unknown) => void;
};

type FalConnection = { send: (p: unknown) => void; close: () => void };

export type TransportSend = (payload: {
  prompt: string;
  enable_prompt_expansion?: boolean;
  reference_image_url?: string;
}) => void;

/**
 * Video transport for Lucy 2.5 realtime.
 *
 * Lucy is a WebRTC video-to-video model. `fal.realtime.connect()` opens a
 * WebSocket that carries WebRTC signaling; media flows peer-to-peer.
 * `connection.send({ prompt })` only ships prompt updates over the signaling
 * channel — the video is the webcam's `MediaStream`.
 */
export class VideoTransport {
  private inputStream: MediaStream;
  private cb: TransportCallbacks;
  private connection: FalConnection | null = null;
  private pc: RTCPeerConnection | null = null;
  private closed = false;
  private outboundPaused = false;
  private lastPrompt: {
    prompt: string;
    enable_prompt_expansion?: boolean;
    reference_image_url?: string;
  } | null = null;
  private negotiated = false;
  private pendingLocalCandidates: RTCIceCandidateInit[] = [];

  constructor(inputStream: MediaStream, cb: TransportCallbacks) {
    this.inputStream = inputStream;
    this.cb = cb;
  }

  setOutboundPaused(paused: boolean) {
    this.outboundPaused = paused;
    if (this.pc) {
      for (const sender of this.pc.getSenders()) {
        if (sender.track) sender.track.enabled = !paused;
      }
    }
  }

  async start() {
    this.connection = fal.realtime.connect(LUCY_APP, {
      throttleInterval: 0,
      onResult: (result) => this.handleResult(result as FalPayload),
      onError: (e) => this.cb.onError(e),
      tokenProvider: async () => {
        return await mintFalRealtimeToken({ data: { app: LUCY_APP } });
      },
      tokenExpirationSeconds: 60,
    } as Parameters<typeof fal.realtime.connect>[1]) as unknown as FalConnection;

    // Kick off WebRTC negotiation immediately with public STUN.
    // The bridge may send back updated iceServers via onResult; we'll ignore
    // for now since the default set works for browser origination.
    await this.beginWebRTC([{ urls: "stun:stun.l.google.com:19302" }]);
    this.cb.onTransportChosen("webrtc");
  }

  send: TransportSend = (payload) => {
    this.lastPrompt = { ...payload };
    if (!this.connection) return;
    try {
      this.connection.send({
        prompt: payload.prompt,
        enable_prompt_expansion: payload.enable_prompt_expansion ?? true,
        ...(payload.reference_image_url
          ? { reference_image_url: payload.reference_image_url }
          : {}),
      });
    } catch (e) {
      this.cb.onError(e);
    }
  };

  private async handleResult(result: FalPayload) {
    // Log unknown payloads to help refine the signaling shape at runtime.
    if (!result || typeof result !== "object") return;

    // Common signaling shapes we know how to react to
    if (result.type === "answer" && typeof result.sdp === "string") {
      try {
        await this.pc?.setRemoteDescription({ type: "answer", sdp: result.sdp });
        this.flushPendingCandidates();
      } catch (e) {
        this.cb.onError(e);
      }
      return;
    }
    if (
      result.type === "candidate" &&
      result.candidate &&
      typeof result.candidate === "object"
    ) {
      try {
        await this.pc?.addIceCandidate(result.candidate as RTCIceCandidateInit);
      } catch (e) {
        console.warn("addIceCandidate failed", e);
      }
      return;
    }
    if (result.type === "iceServers" && Array.isArray(result.iceServers)) {
      // Late iceServers — nothing to do post-offer; skip.
      return;
    }
    // Debug: log any other payloads so we can iterate on unknown fields
    console.debug("[lucy] onResult", result);
  }

  private async beginWebRTC(iceServers: RTCIceServer[]) {
    try {
      const pc = new RTCPeerConnection({ iceServers });
      this.pc = pc;

      // Add local webcam tracks
      for (const track of this.inputStream.getVideoTracks()) {
        pc.addTrack(track, this.inputStream);
      }
      // Also want to receive remote video
      pc.addTransceiver("video", { direction: "sendrecv" });

      pc.ontrack = (ev) => {
        if (this.closed) return;
        const remote = ev.streams[0] ?? new MediaStream([ev.track]);
        this.cb.onOutputStream(remote);
      };

      pc.onicecandidate = (ev) => {
        if (!ev.candidate) return;
        const cand = ev.candidate.toJSON();
        if (!this.negotiated) {
          this.pendingLocalCandidates.push(cand);
        } else {
          this.connection?.send({ type: "candidate", candidate: cand });
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      });
      await pc.setLocalDescription(offer);

      // Wait briefly for ICE gathering to reduce trickle
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const timeout = setTimeout(resolve, 1500);
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      this.negotiated = true;
      this.connection?.send({
        type: "offer",
        sdp: pc.localDescription?.sdp,
      });
      // Flush any candidates that gathered after "complete" fired
      this.flushPendingCandidates();
    } catch (e) {
      this.cb.onError(e);
    }
  }

  private flushPendingCandidates() {
    if (!this.connection) return;
    for (const cand of this.pendingLocalCandidates) {
      this.connection.send({ type: "candidate", candidate: cand });
    }
    this.pendingLocalCandidates = [];
  }

  close() {
    this.closed = true;
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }
    try {
      this.connection?.close();
    } catch {
      // ignore
    }
    this.connection = null;
  }
}
