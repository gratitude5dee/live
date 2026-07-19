import { fal } from "@fal-ai/client";
import { mintFalRealtimeToken } from "@/lib/fal-token.functions";

type TransportCallbacks = {
  onOutputStream: (stream: MediaStream) => void;
  onTransportChosen: (t: "webrtc") => void;
  onError: (e: unknown) => void;
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
 * Lucy uses fal's WMA bridge for the one-shot SDP exchange. Media and prompt
 * controls then flow peer-to-peer over WebRTC.
 */
export class VideoTransport {
  private inputStream: MediaStream;
  private cb: TransportCallbacks;
  private pc: RTCPeerConnection | null = null;
  private connection: LucyRealtimeConnection | null = null;
  private connectTimeout: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private outboundPaused = false;
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

  async start() {
    await this.beginWebRTC([{ urls: "stun:stun.l.google.com:19302" }]);
  }

  send: TransportSend = (payload) => {
    this.lastPrompt = { ...payload };
    this.flushPrompt();
  };

  private async beginWebRTC(iceServers: RTCIceServer[]) {
    try {
      const pc = new RTCPeerConnection({ iceServers });
      this.pc = pc;

      // Add local webcam tracks
      for (const track of this.inputStream.getVideoTracks()) {
        pc.addTrack(track, this.inputStream);
      }
      pc.addTransceiver("video", { direction: "recvonly" });

      pc.ontrack = (ev) => {
        if (this.closed) return;
        const remote = ev.streams[0] ?? new MediaStream([ev.track]);
        this.cb.onOutputStream(remote);
        this.cb.onTransportChosen("webrtc");
        this.flushPrompt();
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          if (this.connectTimeout) clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
        } else if (pc.connectionState === "failed") {
          this.cb.onError(new Error("Lucy WebRTC connection failed"));
        }
      };

      const connection = fal.realtime.connect("decart/lucy-2-5/realtime", {
        clientOnly: true,
        tokenProvider: async (app) =>
          mintFalRealtimeToken({ data: { app } }),
        tokenExpirationSeconds: 10,
        onResult: (result: unknown) => {
          if (this.closed || !this.pc) return;
          const message = result as {
            type?: RTCSdpType;
            sdp?: string;
            candidate?: RTCIceCandidateInit | null;
            error?: unknown;
          };
          if (message.error) {
            this.cb.onError(new Error("Lucy signaling failed"));
            return;
          }
          if (message.sdp && message.type) {
            void this.pc
              .setRemoteDescription({ type: message.type, sdp: message.sdp })
              .catch((error) => this.cb.onError(error));
          } else if (message.candidate) {
            void this.pc
              .addIceCandidate(message.candidate)
              .catch((error) => this.cb.onError(error));
          }
        },
        onError: (error) => this.cb.onError(error),
      });
      this.connection = connection as LucyRealtimeConnection;

      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      });
      await pc.setLocalDescription(offer);

      // Send a complete offer so Lucy can establish media without trickle ICE.
      await new Promise<void>((resolve, reject) => {
        if (pc.iceGatheringState === "complete") return resolve();
        const timeout = setTimeout(
          () => reject(new Error("Timed out gathering WebRTC candidates")),
          10_000,
        );
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === "complete") {
            clearTimeout(timeout);
            resolve();
          }
        };
      });

      const sdp = pc.localDescription?.sdp;
      if (!sdp) throw new Error("WebRTC offer was empty");
      (connection as LucyRealtimeConnection).send({ type: "offer", sdp });
      this.connectTimeout = setTimeout(() => {
        if (pc.connectionState !== "connected") {
          this.cb.onError(new Error("Lucy did not establish a media connection"));
        }
      }, 15_000);
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
