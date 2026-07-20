import { mintOpenAIRealtimeSecret } from "@/lib/openai-token.functions";
import {
  buildFollowUpContext,
  COMPUTAH_INSTRUCTIONS,
  COMPUTAH_TOOLS,
  OPENAI_REALTIME_MODEL,
  matchesWake,
  pickAck,
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
 * Extract completed fields from a partial JSON arguments buffer streamed by
 * OpenAI Realtime. We watch for the three fields we care about; once all
 * three are present we can dispatch the tool call before the full JSON
 * finishes streaming, shaving 200-400ms off the voice→Lucy latency.
 */
function tryEarlyParse(buf: string): {
  edit_type?: string;
  lucy_prompt?: string;
  use_reference_image?: boolean;
} | null {
  // Match a complete quoted string value (allowing escaped quotes) for each
  // field. If any regex misses, we simply wait for more deltas.
  const editM = buf.match(/"edit_type"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const promptM = buf.match(/"lucy_prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const refM = buf.match(/"use_reference_image"\s*:\s*(true|false)/);
  if (!editM || !promptM || !refM) return null;
  const decode = (s: string) => {
    try {
      return JSON.parse(`"${s}"`) as string;
    } catch {
      return s;
    }
  };
  return {
    edit_type: decode(editM[1]),
    lucy_prompt: decode(promptM[1]),
    use_reference_image: refM[1] === "true",
  };
}

/**
 * VoiceAgent — thin wrapper around OpenAI Realtime WebRTC.
 *
 * Opens a mic-only PeerConnection to the OpenAI Realtime endpoint using
 * an ephemeral client secret minted by the server. Text-only session; no
 * remote audio track is negotiated (we don't want TTS overhead in the pipe).
 */
export class VoiceAgent {
  private cb: VoiceCallbacks;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private dispatchedCallIds = new Set<string>();
  private argsBufByCall = new Map<string, string>();
  private lastTranscript = "";
  private dispatchedInResponse = false;
  private model = OPENAI_REALTIME_MODEL;
  private lastAppliedPrompt: string | null = null;
  // Local VAD gate removed: muting the outbound mic ate the "Comp-" head
  // of the wake word, so Realtime never saw "computah". Keep the track hot
  // and let OpenAI's server-side turn detection handle silence. A proper
  // KWS (Porcupine/openWakeWord) can gate turn_detection later without
  // dropping audio frames.

  constructor(cb: VoiceCallbacks) {
    this.cb = cb;
  }

  async start(): Promise<void> {
    this.closed = false;
    this.cb.onState("connecting");
    try {
      const { ephemeralKey, model } = await mintOpenAIRealtimeSecret();
      this.model = model || OPENAI_REALTIME_MODEL;

      // Audio in — mic only, with echo cancellation.
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

      const pc = new RTCPeerConnection();
      this.pc = pc;
      const audioTrack = mic.getAudioTracks()[0];
      // Keep the mic hot — server-side turn detection handles silence.
      audioTrack.enabled = true;
      pc.addTrack(audioTrack, mic);
      // No pc.ontrack — text-only session; no remote audio pipeline.
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
        tool_choice: "required",
        output_modalities: ["text"],
        audio: {
          input: {
            // server_vad ends the turn as soon as the user stops speaking;
            // semantic_vad adds 200-500ms of "are they done" deliberation.
            turn_detection: {
              type: "server_vad",
              silence_duration_ms: 300,
              prefix_padding_ms: 200,
              threshold: 0.5,
            },
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

    if (type === "response.created") {
      this.dispatchedInResponse = false;
      return;
    }

    if (type === "conversation.item.input_audio_transcription.completed") {
      const text = String((msg as { transcript?: string }).transcript ?? "").trim();
      if (text) {
        this.lastTranscript = text;
        this.cb.onTranscript(text);
      }
      return;
    }

    // NOTE: response.audio_transcript.done is dead — output_modalities is
    // ["text"], so the model never speaks. Acks are now picked client-side.

    const dispatchFn = (name: string, callId: string, argsObj: unknown) => {
      if (!name || !callId) return;
      if (this.dispatchedCallIds.has(callId)) return;
      this.dispatchedCallIds.add(callId);
      this.dispatchedInResponse = true;
      if (name === "apply_video_edit" || name === "control_session") {
        this.resetIdle();
        // Flash a random ack word in the HUD on the same tick as the dispatch.
        this.cb.onAck(pickAck());
      }
      this.cb.onToolCall({ callId, name, args: argsObj ?? {} });
    };

    // EARLY DISPATCH: parse partial arguments as they stream.
    if (type === "response.function_call_arguments.delta") {
      const m = msg as { call_id?: string; delta?: string; name?: string };
      const callId = String(m.call_id ?? "");
      if (!callId) return;
      const prev = this.argsBufByCall.get(callId) ?? "";
      const next = prev + String(m.delta ?? "");
      this.argsBufByCall.set(callId, next);
      // wait_for_user has no fields — dispatch on .done, not delta.
      const parsed = tryEarlyParse(next);
      if (parsed) {
        dispatchFn("apply_video_edit", callId, parsed);
      }
      return;
    }

    if (type === "response.function_call_arguments.done") {
      const m = msg as { call_id?: string; name?: string; arguments?: string };
      const callId = String(m.call_id ?? "");
      const name = String(m.name ?? "");
      let args: unknown = {};
      try {
        args = m.arguments ? JSON.parse(m.arguments) : {};
      } catch {
        args = {};
      }
      dispatchFn(name, callId, args);
      this.argsBufByCall.delete(callId);
      return;
    }

    if (type === "response.output_item.done") {
      const item = (msg as { item?: Record<string, unknown> }).item;
      if (item && item.type === "function_call") {
        const callId = String(item.call_id ?? "");
        let args: unknown = {};
        try {
          args = item.arguments ? JSON.parse(String(item.arguments)) : {};
        } catch {
          args = {};
        }
        dispatchFn(String(item.name ?? ""), callId, args);
        this.argsBufByCall.delete(callId);
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
        const callId = String(it.call_id ?? "");
        let args: unknown = {};
        try {
          args = it.arguments ? JSON.parse(String(it.arguments)) : {};
        } catch {
          args = {};
        }
        dispatchFn(String(it.name ?? ""), callId, args);
        this.argsBufByCall.delete(callId);
      }
      // Safety net: if the response fired no apply_video_edit but the user's
      // transcript sounded like the wake word, surface it so the UI can toast
      // (or optionally forward as a raw prompt).
      if (
        !this.dispatchedInResponse &&
        this.lastTranscript &&
        matchesWake(this.lastTranscript)
      ) {
        this.cb.onToolCall({
          callId: `wake_miss_${Date.now()}`,
          name: "wake_word_missed",
          args: { transcript: this.lastTranscript },
        });
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
    // Synthetic client-side calls (wake_word_missed) have no server counterpart.
    if (callId.startsWith("wake_miss_")) return;
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

  /**
   * Push the currently visible edit into the model's context so a subsequent
   * relative command ("make it redder", "now bigger") merges with, rather
   * than fragments, the previous prompt. Fire-and-forget.
   */
  updateLastPrompt(prompt: string | null): void {
    this.lastAppliedPrompt = prompt && prompt.trim() ? prompt.trim() : null;
    this.send({
      type: "session.update",
      session: {
        type: "realtime",
        instructions:
          COMPUTAH_INSTRUCTIONS + buildFollowUpContext(this.lastAppliedPrompt),
      },
    });
  }


  close(): void {
    this.closed = true;
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.stopVad();
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
