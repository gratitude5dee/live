import { mintOpenAIRealtimeSecret } from "@/lib/openai-token.functions";
import {
  COMPUTAH_INSTRUCTIONS,
  COMPUTAH_TOOLS,
  OPENAI_REALTIME_MODEL,
} from "./voice-intent";

export type VoiceState = "off" | "connecting" | "armed" | "thinking" | "error";

export type VoiceToolCall = {
  callId: string;
  name: string;
  args: unknown;
};

type VoiceCallbacks = {
  onState: (s: VoiceState) => void;
  onTranscript: (text: string) => void;
  onToolCall: (call: VoiceToolCall) => void;
  onAck: (word: string) => void;
  onError: (e: unknown) => void;
  onIdleDisarm: () => void;
};

const IDLE_MS = 3 * 60_000;

/**
 * VoiceAgent — thin wrapper around OpenAI Realtime WebRTC.
 *
 * Opens a mic-only PeerConnection to the OpenAI Realtime endpoint using
 * an ephemeral client secret minted by the server. Voice output is played
 * through a hidden autoplay <audio> element.
 */
export class VoiceAgent {
  private cb: VoiceCallbacks;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private model = OPENAI_REALTIME_MODEL;

  constructor(cb: VoiceCallbacks) {
    this.cb = cb;
  }

  async start(): Promise<void> {
    this.closed = false;
    this.cb.onState("connecting");
    try {
      const { ephemeralKey, model } = await mintOpenAIRealtimeSecret();
      this.model = model || OPENAI_REALTIME_MODEL;

      // Audio in — mic only, with echo cancellation because Computah's own
      // voice plays out of the same device speakers.
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (this.closed) {
        mic.getTracks().forEach((t) => t.stop());
        return;
      }
      this.mic = mic;

      // Audio out — hidden <audio> element attached to body.
      const audioEl = document.createElement("audio");
      audioEl.autoplay = true;
      audioEl.setAttribute("playsinline", "");
      audioEl.style.display = "none";
      document.body.appendChild(audioEl);
      this.audioEl = audioEl;

      const pc = new RTCPeerConnection();
      this.pc = pc;
      pc.addTrack(mic.getAudioTracks()[0], mic);
      pc.ontrack = (ev) => {
        if (this.audioEl) this.audioEl.srcObject = ev.streams[0];
      };
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          if (!this.closed) this.cb.onError(new Error(`pc_${pc.connectionState}`));
        }
      };

      const dc = pc.createDataChannel("oai-events");
      this.dc = dc;
      dc.onopen = () => this.configureSession();
      dc.onmessage = (ev) => this.handleEvent(ev.data);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(this.model)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            "Content-Type": "application/sdp",
          },
          body: offer.sdp ?? "",
        },
      );
      if (!sdpRes.ok) {
        const text = await sdpRes.text();
        throw new Error(`openai_sdp_${sdpRes.status}: ${text.slice(0, 200)}`);
      }
      const answer = { type: "answer" as const, sdp: await sdpRes.text() };
      await pc.setRemoteDescription(answer);

      this.resetIdle();
      this.cb.onState("armed");
    } catch (e) {
      this.cb.onError(e);
      this.cb.onState("error");
      this.close();
      throw e;
    }
  }

  private configureSession() {
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        model: this.model,
        instructions: COMPUTAH_INSTRUCTIONS,
        tools: COMPUTAH_TOOLS,
        tool_choice: "auto",
        output_modalities: ["text"],
        audio: {
          input: {
            turn_detection: { type: "semantic_vad" },
            transcription: { model: "gpt-4o-mini-transcribe" },
          },
        },
      },
    });
  }

  private handleEvent(raw: unknown) {
    if (typeof raw !== "string") return;
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const type = String(msg.type ?? "");

    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = String((msg as { transcript?: string }).transcript ?? "").trim();
      if (text) this.cb.onTranscript(text);
      return;
    }

    if (
      type === "response.output_audio_transcript.done" ||
      type === "response.audio_transcript.done"
    ) {
      const text = String((msg as { transcript?: string }).transcript ?? "").trim();
      if (text) {
        const word = text.split(/\s+/)[0].replace(/[.!?,]$/, "");
        if (word) this.cb.onAck(word);
      }
      return;
    }

    if (type === "response.done") {
      const response = (msg as { response?: { output?: unknown[] } }).response;
      const output = Array.isArray(response?.output) ? response!.output : [];
      for (const item of output) {
        if (!item || typeof item !== "object") continue;
        const it = item as Record<string, unknown>;
        if (it.type !== "function_call") continue;
        const name = String(it.name ?? "");
        const callId = String(it.call_id ?? "");
        let args: unknown = {};
        try {
          args = it.arguments ? JSON.parse(String(it.arguments)) : {};
        } catch {
          args = {};
        }
        if (name === "apply_video_edit") this.resetIdle();
        this.cb.onToolCall({ callId, name, args });
      }
      return;
    }

    if (type === "error") {
      this.cb.onError(msg);
    }
  }

  /** Reply to a function call. Set respond=true to let Computah speak again. */
  sendToolOutput(
    callId: string,
    payload: unknown,
    opts: { respond: boolean },
  ) {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output: JSON.stringify(payload),
      },
    });
    if (opts.respond) this.send({ type: "response.create" });
  }

  private send(payload: unknown) {
    const dc = this.dc;
    if (!dc || dc.readyState !== "open") return;
    try {
      dc.send(JSON.stringify(payload));
    } catch (e) {
      console.warn("voice-agent send failed", e);
    }
  }

  private resetIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.closed) return;
      this.cb.onIdleDisarm();
      this.close();
    }, IDLE_MS);
  }

  close(): void {
    this.closed = true;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    try {
      this.dc?.close();
    } catch {
      /* ignore */
    }
    this.dc = null;
    try {
      this.pc?.getSenders().forEach((s) => s.track?.stop());
      this.pc?.close();
    } catch {
      /* ignore */
    }
    this.pc = null;
    this.mic?.getTracks().forEach((t) => t.stop());
    this.mic = null;
    if (this.audioEl) {
      try {
        this.audioEl.srcObject = null;
        this.audioEl.remove();
      } catch {
        /* ignore */
      }
      this.audioEl = null;
    }
    this.cb.onState("off");
  }
}

export function isVoiceSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    typeof RTCPeerConnection !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}
