import {
  createLucySession,
  heartbeatLucySession,
} from "@/lib/wma-session.functions";

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
  private controlChannel: RTCDataChannel | null = null;
  private sessionId: string | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
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

  private attachControlChannel(channel: RTCDataChannel) {
    this.controlChannel = channel;
    channel.onopen = () => this.flushPrompt();
    channel.onerror = () => this.cb.onError(new Error("Lucy control channel failed"));
  }

  private async beginWebRTC(iceServers: RTCIceServer[]) {
    try {
      const pc = new RTCPeerConnection({ iceServers });
      this.pc = pc;

      // Add local webcam tracks
      for (const track of this.inputStream.getVideoTracks()) {
        pc.addTrack(track, this.inputStream);
      }
      pc.addTransceiver("video", { direction: "recvonly" });
      pc.ondatachannel = (event) => this.attachControlChannel(event.channel);

      pc.ontrack = (ev) => {
        if (this.closed) return;
        const remote = ev.streams[0] ?? new MediaStream([ev.track]);
        this.cb.onOutputStream(remote);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          if (this.connectTimeout) clearTimeout(this.connectTimeout);
          this.connectTimeout = null;
          this.cb.onTransportChosen("webrtc");
        } else if (pc.connectionState === "failed") {
          this.cb.onError(new Error("Lucy WebRTC connection failed"));
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      });
      await pc.setLocalDescription(offer);

      // WMA does not support trickle ICE: the offer must contain candidates.
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
      const answer = await createLucySession({
        data: { type: "offer", sdp },
      });
      if (this.closed) return;
      this.sessionId = answer.session_id;
      await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });

      this.heartbeat = setInterval(() => {
        if (!this.sessionId || this.closed) return;
        heartbeatLucySession({ data: { sessionId: this.sessionId } }).catch(
          (error) => console.warn("Lucy heartbeat error", error),
        );
      }, 5_000);
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
    if (!this.lastPrompt || this.controlChannel?.readyState !== "open") return;
    const payload = this.lastPrompt;
    try {
      this.controlChannel.send(
        JSON.stringify({
          prompt: payload.prompt,
          enable_prompt_expansion: payload.enable_prompt_expansion ?? true,
          ...(payload.reference_image_url
            ? { reference_image_url: payload.reference_image_url }
            : {}),
        }),
      );
    } catch (error) {
      this.cb.onError(error);
    }
  }

  close() {
    this.closed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    if (this.connectTimeout) clearTimeout(this.connectTimeout);
    this.heartbeat = null;
    this.connectTimeout = null;
    try {
      this.controlChannel?.close();
    } catch {
      // ignore
    }
    this.controlChannel = null;
    if (this.pc) {
      try {
        this.pc.close();
      } catch {
        // ignore
      }
      this.pc = null;
    }
    this.sessionId = null;
  }
}
