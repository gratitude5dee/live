import { fal } from "@fal-ai/client";
import { mintFalRealtimeToken } from "@/lib/fal-token.functions";

export type TransportConnState = "connecting" | "connected" | "reconnecting" | "failed";

type TransportCallbacks = {
  onOutputStream: (stream: MediaStream) => void;
  onTransportChosen: (t: "webrtc") => void;
  onError: (e: unknown) => void;
  onStateChange?: (s: TransportConnState) => void;
};

export type TransportSend = (payload: {
  prompt: string;
  enable_prompt_expansion?: boolean;
  reference_image_url?: string;
}) => void;

type LucyRealtimeConnection = {
  send: (payload: Record<string, unknown>) => void;
  close: () => void;
};

/**
 * Video transport for Lucy 2.5 realtime.
 *
 * Lucy uses fal's realtime WebSocket for WebRTC signaling and prompt updates.
 * Video itself flows peer-to-peer over WebRTC.
 */
export class VideoTransport {
  private inputStream: MediaStream;
  private cb: TransportCallbacks;
  private pc: RTCPeerConnection | null = null;
  private videoSender: RTCRtpSender | null = null;
  private pendingTrack: MediaStreamTrack | null = null;
  private connection: LucyRealtimeConnection | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private outboundPaused = false;
  private remoteDescriptionSet = false;
  private pendingRemoteCandidates: RTCIceCandidateInit[] = [];
  private lastPrompt: {
    prompt: string;
    enable_prompt_expansion?: boolean;
    reference_image_url?: string;
  } | null = null;

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

  /**
   * Hot-swap the outbound video track without renegotiating SDP.
   * Same-kind swap (video → video) is supported natively by WebRTC.
   * `kind` guides the encoder's contentHint:
   *   - "motion" (default) → camera / composite feeds. Encoder prefers
   *      framerate over spatial detail on bandwidth pressure — right call
   *      for a realtime mirror.
   *   - "detail" → depth / static gradients. Preserves spatial detail;
   *      framerate can drop without hurting the look.
   */
  async replaceVideoTrack(
    track: MediaStreamTrack | null,
    opts?: { kind?: "motion" | "detail" },
  ) {
    if (!this.videoSender) {
      this.pendingTrack = track;
      return;
    }
    if (this.videoSender.track && track && this.videoSender.track.id === track.id) return;
    try {
      if (track) {
        try {
          (track as MediaStreamTrack & { contentHint?: string }).contentHint =
            opts?.kind ?? "motion";
        } catch {
          /* older UAs */
        }
      }
      await this.videoSender.replaceTrack(track);
      if (track) track.enabled = !this.outboundPaused;
    } catch (error) {
      console.warn("replaceVideoTrack failed", error);
    }
  }


  async start() {
    this.cb.onStateChange?.("connecting");
    await this.beginWebRTC([{ urls: "stun:stun.l.google.com:19302" }]);
  }

  send: TransportSend = (payload) => {
    this.lastPrompt = { ...payload };
    this.flushPrompt();
  };

  /**
   * Restart signaling + WebRTC without touching the outbound track or the
   * cached `lastPrompt`. flushPrompt() re-sends the last look on `ontrack`
   * so the visual state survives an ICE blip.
   */
  private reconnectAttempt = 0;
  private reconnecting = false;
  async attemptReconnect(): Promise<void> {
    if (this.closed || this.reconnecting) return;
    this.reconnecting = true;
    try {
      // Tear down peer connection but keep `this.inputStream` + callbacks
      // + `lastPrompt` intact.
      if (this.pc) {
        try { this.pc.close(); } catch { /* ignore */ }
        this.pc = null;
      }
      if (this.connection) {
        try { this.connection.close(); } catch { /* ignore */ }
        this.connection = null;
      }
      this.videoSender = null;
      this.remoteDescriptionSet = false;
      this.pendingRemoteCandidates = [];
      if (this.connectTimeout) {
        clearTimeout(this.connectTimeout);
        this.connectTimeout = null;
      }

      const maxAttempts = 3;
      for (let i = 0; i < maxAttempts; i++) {
        if (this.closed) return;
        this.reconnectAttempt = i + 1;
        this.cb.onStateChange?.("reconnecting");
        const backoff = 1000 * Math.pow(2, i);
        await new Promise((r) => setTimeout(r, backoff));
        if (this.closed) return;
        try {
          await this.beginWebRTC([{ urls: "stun:stun.l.google.com:19302" }]);
          this.reconnectAttempt = 0;
          return;
        } catch (e) {
          console.warn(`reconnect attempt ${i + 1} failed`, e);
          if (i === maxAttempts - 1) {
            this.cb.onStateChange?.("failed");
            this.cb.onError(new Error("Lucy reconnect failed after 3 attempts"));
          }
        }
      }
    } finally {
      this.reconnecting = false;
    }
  }

  private async beginWebRTC(iceServers: RTCIceServer[]) {
    try {
      const pc = new RTCPeerConnection({ iceServers });
      this.pc = pc;

      // Add local webcam tracks
      for (const track of this.inputStream.getVideoTracks()) {
        try {
          (track as MediaStreamTrack & { contentHint?: string }).contentHint = "motion";
        } catch {
          /* older UAs */
        }
        const sender = pc.addTrack(track, this.inputStream);
        if (!this.videoSender) this.videoSender = sender;
      }
      // Realtime encoder tuning: drop resolution before framerate on
      // bandwidth pressure — glass-to-glass latency is our primary metric.
      if (this.videoSender) {
        try {
          const params = this.videoSender.getParameters();
          (params as RTCRtpSendParameters & { degradationPreference?: string })
            .degradationPreference = "maintain-framerate";
          params.encodings = [
            { maxBitrate: 2_000_000, maxFramerate: 30 },
          ];
          await this.videoSender.setParameters(params);
        } catch (error) {
          console.warn("sender param tuning failed", error);
        }
      }
      // Apply any track that was requested before the sender existed.
      if (this.pendingTrack && this.videoSender) {
        const pending = this.pendingTrack;
        this.pendingTrack = null;
        void this.replaceVideoTrack(pending);
      }

      pc.addTransceiver("video", { direction: "recvonly" });

      pc.ontrack = (ev) => {
        if (this.closed) return;
        const remote = ev.streams[0] ?? new MediaStream([ev.track]);
        this.cb.onOutputStream(remote);
        this.cb.onTransportChosen("webrtc");
        this.flushPrompt();
      };

      pc.onicecandidate = (ev) => {
        if (this.closed || !this.connection) return;
        try {
          if (ev.candidate) {
            this.connection.send({ candidate: ev.candidate.toJSON() });
          } else {
            // End-of-candidates signal
            this.connection.send({ candidate: null });
          }
        } catch (error) {
          console.warn("failed to forward ICE candidate", error);
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed") {
          // Try to recover before surfacing an error to the user.
          if (!this.reconnecting && !this.closed) {
            void this.attemptReconnect();
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          if (this.connectTimeout) clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
          this.cb.onStateChange?.("connected");
        } else if (pc.connectionState === "failed") {
          if (!this.reconnecting && !this.closed) {
            void this.attemptReconnect();
          }
        }
      };

      let offerSent = false;
      const sendOffer = async (connection: LucyRealtimeConnection) => {
        if (offerSent || this.closed) return;
        offerSent = true;
        const offer = await pc.createOffer({
          offerToReceiveVideo: true,
          offerToReceiveAudio: false,
        });
        await pc.setLocalDescription(offer);
        const sdp = pc.localDescription?.sdp;
        if (!sdp) throw new Error("WebRTC offer was empty");
        connection.send({ type: "offer", sdp });
        this.connectTimeout = setTimeout(() => {
          if (pc.connectionState !== "connected" && !this.reconnecting && !this.closed) {
            void this.attemptReconnect();
          }
        }, 20_000);
      };

      const connection = fal.realtime.connect("decart/lucy-2-5/realtime", {
        clientOnly: true,
        tokenProvider: async (app) =>
          mintFalRealtimeToken({ data: { app } }),
        tokenExpirationSeconds: 120,
        onResult: (result: unknown) => {
          if (this.closed || !this.pc) return;
          const message = result as {
            type?: RTCSdpType;
            sdp?: string;
            candidate?: RTCIceCandidateInit | null;
            iceServers?: RTCIceServer[] | null;
            error?: unknown;
          };
          if (message.error) {
            this.cb.onError(new Error("Lucy signaling failed"));
            return;
          }
          if (message.iceServers?.length) {
            this.pc.setConfiguration({ iceServers: message.iceServers });
            void sendOffer(connection as LucyRealtimeConnection).catch((error) =>
              this.cb.onError(error),
            );
          } else if (message.sdp && message.type) {
            void this.pc
              .setRemoteDescription({ type: message.type, sdp: message.sdp })
              .then(() => {
                this.remoteDescriptionSet = true;
                const buf = this.pendingRemoteCandidates;
                this.pendingRemoteCandidates = [];
                for (const c of buf) {
                  void this.pc?.addIceCandidate(c).catch(() => {});
                }
              })
              .catch((error) => this.cb.onError(error));
          } else if (message.candidate) {
            if (!this.remoteDescriptionSet) {
              this.pendingRemoteCandidates.push(message.candidate);
            } else {
              void this.pc
                .addIceCandidate(message.candidate)
                .catch((error) => this.cb.onError(error));
            }
          }
        },
        onError: (error) => this.cb.onError(error),
      });
      this.connection = connection as LucyRealtimeConnection;
      (connection as LucyRealtimeConnection).send({});
    } catch (e) {
      this.cb.onError(e);
      throw e;
    }
  }

  private flushPrompt() {
    if (!this.lastPrompt || !this.connection) return;
    const payload = this.lastPrompt;
    try {
      this.connection.send({
        prompt: payload.prompt,
        enable_prompt_expansion: payload.enable_prompt_expansion ?? true,
        ...(payload.reference_image_url
          ? { reference_image_url: payload.reference_image_url }
          : {}),
      });
    } catch (error) {
      this.cb.onError(error);
    }
  }

  close() {
    this.closed = true;
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.connectTimeout = null;
    try {
      this.connection?.close();
    } catch {
      // ignore
    }
    this.connection = null;
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }
  }
}
