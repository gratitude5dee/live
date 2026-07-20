import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { VideoTransport } from "@/lib/zap/fal-transport";
import { GestureEngine, type GestureAction } from "@/lib/zap/gesture-engine";
import { FaceEngine, type FaceAction } from "@/lib/zap/face-engine";
import { VisionBuffer } from "@/lib/zap/vision-buffer";
import { drawHandOverlay, drawFaceOverlay } from "@/lib/zap/overlay";
import { CompositeStream } from "@/lib/zap/composite-stream";
import { DepthEngine, WebGPUUnsupportedError } from "@/lib/zap/depth-engine";
import { loadGestureRecognizer, loadFaceLandmarker, takeWarmedVision } from "@/lib/zap/mediapipe";
import { haptic } from "@/lib/zap/haptics";
import LandingHero from "@/components/zap/LandingHero";
import TemplateDialog, { type TemplateApplyPayload } from "@/components/zap/TemplateDialog";
import DesktopStage from "@/components/zap/stage/DesktopStage";
import MobileStage from "@/components/zap/stage/MobileStage";
import { useIsMobile } from "@/hooks/use-mobile";
import type { TemplateKey } from "@/lib/zap/prompt-templates";
import {
  REACTIVE_PROMPTS,
  type ConnectionState,
  type Preset,
  type PromptState,
  type RemoteMessage,
  type VoiceState,
} from "@/lib/zap/types";
import { VoiceAgent, isVoiceSupported, type VoiceToolCall } from "@/lib/zap/voice-agent";
import { isEditTypeId, editLabel, type EditTypeId } from "@/lib/zap/voice-intent";
import type {
  FaceLandmarker,
  GestureRecognizer,
  GestureRecognizerResult,
} from "@mediapipe/tasks-vision";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — realtime video editor" },
      {
        name: "description",
        content:
          "Your webcam is the timeline. Edit the live feed with prompts, gestures, and reference images — Zap LIve repaints every frame in under a second.",
      },
      { property: "og:title", content: "ZAP·LIVE — realtime video editor" },
      {
        property: "og:description",
        content:
          "Your webcam is the timeline. Edit the live feed with prompts, gestures, and reference images — Zap LIve repaints every frame in under a second.",
      },
    ],
  }),
  component: StagePage,
});

function StagePage() {
  const isMobile = useIsMobile();
  const [authReady, setAuthReady] = useState(false);
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [, setSessionId] = useState<string | null>(null);
  const [transport, setTransport] = useState<"webrtc" | null>(null);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [enhance, setEnhance] = useState(true);
  const [applied, setApplied] = useState<PromptState | null>(null);
  const [prevApplied, setPrevApplied] = useState<PromptState | null>(null);
  const [refImage, setRefImage] = useState<{ dataUri?: string; url?: string; path?: string } | null>(
    null,
  );
  const [recording, setRecording] = useState(false);
  const [liveGesture, setLiveGesture] = useState<{
    label: string | null;
    score: number;
    hold: number;
  }>({ label: null, score: 0, hold: 0 });
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reactiveOn, setReactiveOn] = useState(false);
  const [hudVisible, setHudVisible] = useState(true);
  const [facePresent, setFacePresent] = useState(true);
  const [perfMode, setPerfMode] = useState(false);
  const [pendingUpload, setPendingUpload] = useState(0);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [download, setDownload] = useState<{ url: string; filename: string } | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("off");
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [voiceAck, setVoiceAck] = useState<string>("");
  const [voiceIntent, setVoiceIntent] = useState<EditTypeId | null>(null);
  const voiceAgentRef = useRef<VoiceAgent | null>(null);
  const voiceAvailable = isVoiceSupported();
  const [templateDialog, setTemplateDialog] = useState<{
    key: TemplateKey;
    name: string;
  } | null>(null);
  const autoRecordRef = useRef(false);
  const startRecordingRef = useRef<((auto: boolean) => void) | null>(null);



  const inputVideoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  // Mirror for consumers that need reactive access (A/B wipe).
  const [inputStream, setInputStream] = useState<MediaStream | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const compositorRef = useRef<CompositeStream | null>(null);
  // Route MediaPipe baking based on the active preset's category:
  //  - character_swap → bake face landmarks (helps Lucy re-identify the subject)
  //  - gesture_fx     → bake hand landmarks (anchors hand-based VFX like Fire Hands)
  //  - other          → send a clean webcam frame
  const activePresetKindRef = useRef<"character_swap" | "gesture_fx" | "other">("other");
  const transportRef = useRef<VideoTransport | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const gestureRef = useRef<GestureRecognizer | null>(null);
  const faceRef = useRef<FaceLandmarker | null>(null);
  const engineRef = useRef<GestureEngine | null>(null);
  const faceEngineRef = useRef<FaceEngine | null>(null);
  const visionBufRef = useRef<VisionBuffer | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const startedAtRef = useRef<number>(0);
  const userIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const currentPresetIndex = useRef<number>(-1);
  const appliedRef = useRef<PromptState | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const facePresentRef = useRef(true);
  const reactiveOnRef = useRef(false);
  const revertTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGestureResultRef = useRef<GestureRecognizerResult | null>(null);
  const lastHoldRef = useRef<number>(0);
  const inferenceFrameRef = useRef<number | null>(null);
  const transportStateRef = useRef<"webrtc" | null>(null);
  const perfModeRef = useRef(false);
  const pendingUploadRef = useRef(0);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopScheduledRef = useRef(false);

  // --- Glass-to-glass latency tracking ---
  // `lastPromptSentAt` = wall-clock time of the last Lucy prompt send.
  // The output <video>'s `requestVideoFrameCallback` measures the delta
  // to the first painted frame after that stamp; EMA-smoothed (α=0.3).
  const lastPromptSentAtRef = useRef<number | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const recordLatencySample = useCallback((frameMs: number) => {
    const sent = lastPromptSentAtRef.current;
    if (sent === null) return;
    const dt = frameMs - sent;
    lastPromptSentAtRef.current = null;
    if (dt < 20 || dt > 5000) return; // ignore obvious noise
    setLatencyMs((prev) => (prev === null ? Math.round(dt) : Math.round(prev * 0.7 + dt * 0.3)));
  }, []);

  // --- Depth (WebGPU) state ---
  const [depthOn, setDepthOn] = useState(false);
  const [depthLoading, setDepthLoading] = useState(false);
  const [depthProgress, setDepthProgress] = useState(0);
  const [depthAvailable, setDepthAvailable] = useState(() => DepthEngine.webgpuAvailable());
  // Presence of navigator.gpu ≠ working adapter. Confirm before enabling
  // the toggle so iOS Safari (which now exposes navigator.gpu on some
  // builds) doesn't advertise a broken button.
  useEffect(() => {
    if (!DepthEngine.webgpuAvailable()) {
      setDepthAvailable(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
        const adapter = gpu ? await gpu.requestAdapter() : null;
        if (!cancelled) setDepthAvailable(!!adapter);
      } catch {
        if (!cancelled) setDepthAvailable(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [depthStream, setDepthStream] = useState<MediaStream | null>(null);
  const depthOnRef = useRef(false);
  const depthEngineRef = useRef<DepthEngine | null>(null);

  // Which stream is currently attached to Lucy's outbound WebRTC sender.
  // Surfaced in the camera PiP so users can confirm the pipeline at a glance.
  const [activeSource, setActiveSource] = useState<"raw" | "composite" | "depth">("raw");

  // Baked landmarks (compositor) is opt-in — sending the raw 1080p track keeps
  // Lucy's output sharp. Character-Swap / Gesture-FX presets can opt-in from
  // the camera PiP if they want landmarks composited into the outbound frame.
  const [bakeLandmarks, setBakeLandmarks] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem("zap:bakeLandmarks") === "1";
  });
  const bakeLandmarksRef = useRef(bakeLandmarks);
  useEffect(() => {
    bakeLandmarksRef.current = bakeLandmarks;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("zap:bakeLandmarks", bakeLandmarks ? "1" : "0");
    }
  }, [bakeLandmarks]);

  // Lazily build / dispose the compositor. On mobile Safari, the extra 30fps
  // canvas re-encode is expensive and softens the feed, so we only spin it
  // up when a Character-Swap or Gesture-FX preset actually needs baked
  // landmarks — every other preset (and freeform prompts) send the raw
  // MediaStreamTrack from getUserMedia straight to Lucy.
  const ensureCompositor = useCallback((): MediaStream | null => {
    if (compositorRef.current) return compositorRef.current.stream;
    const src = inputVideoRef.current;
    if (!src) return null;
    try {
      const compositor = new CompositeStream(
        src,
        (ctx) => {
          const kind = activePresetKindRef.current;
          if (kind === "character_swap") {
            drawFaceOverlay(ctx, faceEngineRef.current?.lastResult ?? null);
          } else if (kind === "gesture_fx") {
            drawHandOverlay(ctx, lastGestureResultRef.current, lastHoldRef.current);
          }
        },
        { fps: 30, targetAspect: 9 / 16, targetHeight: 1920 },
      );
      compositorRef.current = compositor;
      return compositor.stream;
    } catch (e) {
      console.warn("compositor init failed", e);
      return null;
    }
  }, []);

  const disposeCompositor = useCallback(() => {
    compositorRef.current?.stop();
    compositorRef.current = null;
  }, []);

  // Pick raw camera / compositor / depth for the outbound video track based on
  // active preset kind + depth toggle, and hot-swap via replaceTrack.
  const syncOutboundSource = useCallback(() => {
    const transport = transportRef.current;
    if (!transport) return;
    let src: MediaStream | null = null;
    let label: "raw" | "composite" | "depth" = "raw";
    if (depthOnRef.current && depthEngineRef.current) {
      src = depthEngineRef.current.stream;
      label = "depth";
      // Depth replaces baked landmarks — drop the compositor to save CPU.
      disposeCompositor();
    } else {
      const kind = activePresetKindRef.current;
      const wantsComposite =
        (kind === "character_swap" || kind === "gesture_fx") &&
        bakeLandmarksRef.current;
      if (wantsComposite) {
        src = ensureCompositor() ?? inputStreamRef.current;
        label = compositorRef.current ? "composite" : "raw";
      } else {
        // Clean camera path — tear down the compositor so we're not paying
        // for a canvas re-encode when nothing needs it.
        disposeCompositor();
        src = inputStreamRef.current;
        label = "raw";
      }
    }
    const track = src?.getVideoTracks()[0] ?? null;
    if (track) void transport.replaceVideoTrack(track, { kind: label === "depth" ? "detail" : "motion" });
    setActiveSource(label);
  }, [ensureCompositor, disposeCompositor]);

  const toggleBakeLandmarks = useCallback(() => {
    setBakeLandmarks((v) => !v);
    // syncOutboundSource reads bakeLandmarksRef, which the effect syncs after
    // state updates — defer the swap so the ref has the new value.
    queueMicrotask(() => syncOutboundSource());
  }, [syncOutboundSource]);

  const toggleDepth = useCallback(async () => {
    if (!depthAvailable) {
      toast.error("WebGPU not available — try Chrome or Edge on desktop");
      return;
    }
    if (depthOnRef.current) {
      depthOnRef.current = false;
      setDepthOn(false);
      depthEngineRef.current?.stop();
      depthEngineRef.current = null;
      setDepthStream(null);
      syncOutboundSource();
      return;
    }
    try {
      setDepthLoading(true);
      setDepthProgress(0);
      const engine = new DepthEngine();
      await engine.init((p) => {
        if (typeof p.progress === "number") setDepthProgress(Math.round(p.progress));
      });
      const src = inputVideoRef.current;
      if (src) engine.attach(src);
      // Wait for the first real depth frame before swapping the outbound
      // WebRTC track — otherwise Lucy receives a black canvas frame and
      // freezes on its last raw-camera output.
      try {
        await engine.waitForFirstFrame(5000);
      } catch (e) {
        console.warn("depth first-frame wait failed", e);
      }
      depthEngineRef.current = engine;
      depthOnRef.current = true;
      setDepthOn(true);
      setDepthStream(engine.stream);
      syncOutboundSource();
      toast.success("Depth stream engaged");
    } catch (err) {
      if (err instanceof WebGPUUnsupportedError) {
        toast.error("WebGPU not available");
      } else {
        toast.error("Depth model failed to load");
        console.error(err);
      }
    } finally {
      setDepthLoading(false);
    }
  }, [depthAvailable, syncOutboundSource]);





  // --- Anonymous auth on mount ---
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        userIdRef.current = data.session.user.id;
        setAuthReady(true);
        return;
      }
      const { data: signIn, error: err } = await supabase.auth.signInAnonymously();
      if (err) {
        setError(
          "Anonymous auth failed — enable 'Allow anonymous sign-ins' in Supabase Auth settings.",
        );
        return;
      }
      userIdRef.current = signIn.user?.id ?? null;
      setAuthReady(true);
    })();
  }, []);

  // --- Load presets ---
  useEffect(() => {
    if (!authReady) return;
    supabase
      .from("presets")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (data) setPresets(data);
      });
  }, [authReady]);

  const at_ms = () => Math.max(0, Math.round(performance.now() - startedAtRef.current));

  const logPromptEvent = useCallback(
    async (
      kind: "apply" | "undo" | "clear" | "preset" | "reactive",
      source: "text" | "gesture" | "face" | "preset" | "remote" | "voice",
      p: PromptState | null,
    ) => {
      const sid = sessionIdRef.current;
      const uid = userIdRef.current;
      if (!sid || !uid) return;
      await supabase.from("prompt_events").insert({
        session_id: sid,
        user_id: uid,
        kind,
        source,
        prompt: p?.text ?? null,
        ref_image_path: p?.refPath ?? null,
        at_ms: at_ms(),
      });
      channelRef.current?.send({
        type: "broadcast",
        event: "prompt",
        payload: { kind, source, prompt: p?.text, at_ms: at_ms() },
      });
    },
    [],
  );

  const applyPrompt = useCallback(
    async (
      text: string,
      source: "text" | "gesture" | "face" | "preset" | "remote" | "voice",
      ref?: { dataUri?: string; url?: string; path?: string } | null,
      opts?: { preset?: Preset },
    ) => {
      if (!transportRef.current) return;
      // Free-text / gesture / face / remote prompts should not bake MediaPipe
      // into Lucy's input — only preset apply paths can opt into that.
      if (source !== "preset") activePresetKindRef.current = "other";
      // Prefer a remote URL for ref_image — it's ~100 bytes vs ~400KB base64
      // over the WS on each apply/undo/reactive-revert.
      const refUrl = ref?.url;
      const refImageForLucy = refUrl ?? ref?.dataUri;
      const next: PromptState = {
        text,
        refImage: ref?.dataUri,
        refUrl,
        refPath: ref?.path,
      };
      // Voice and preset prompts are pre-templated (Computah / Lucy guide),
      // so skip Lucy's ~200-400ms server-side prompt expansion for those.
      // Preset rows carry an `expand` boolean (default false) for override.
      const expand =
        source === "voice"
          ? false
          : source === "preset"
            ? ((opts?.preset as { expand?: boolean } | undefined)?.expand ?? false)
            : enhance;
      // Fire Lucy FIRST (synchronous WS send), then update React state and
      // log — every ms we save here is a ms sooner Lucy starts repainting.
      lastPromptSentAtRef.current = performance.now();
      transportRef.current.send({
        prompt: text,
        enable_prompt_expansion: expand,
        reference_image_url: refImageForLucy,
      });
      syncOutboundSource();
      setPrevApplied(applied);
      setApplied(next);
      const kind = source === "preset" ? "preset" : "apply";
      void logPromptEvent(kind, source, next);
    },
    [applied, enhance, logPromptEvent, syncOutboundSource],
  );

  const undo = useCallback(async () => {
    if (!prevApplied || !transportRef.current) return;
    const swap = applied;
    setApplied(prevApplied);
    setPrevApplied(swap);
    transportRef.current.send({
      prompt: prevApplied.text,
      enable_prompt_expansion: enhance,
      reference_image_url: prevApplied.refUrl ?? prevApplied.refImage,
    });
    await logPromptEvent("undo", "gesture", prevApplied);
    toast("Reverted");
  }, [prevApplied, applied, enhance, logPromptEvent]);

  const clearPrompt = useCallback(async () => {
    if (!transportRef.current) return;
    setPrevApplied(applied);
    setApplied(null);
    activePresetKindRef.current = "other";
    syncOutboundSource();
    transportRef.current.send({ prompt: "", enable_prompt_expansion: false });
    await logPromptEvent("clear", "gesture", null);
  }, [applied, logPromptEvent, syncOutboundSource]);

  // Preset ref images live at public URLs — send Lucy the URL directly
  // (~100 bytes over the WS) instead of round-tripping through FileReader
  // for a 200-400KB base64 payload on every apply.
  const loadPresetRef = useCallback((url: string) => {
    return { url, path: url } as { url: string; path: string };
  }, []);

  const applyPreset = useCallback(
    async (preset: Preset, source: "preset" | "gesture" | "remote" = "preset") => {
      let ref: { dataUri?: string; url?: string; path?: string } | null = refImage;
      if (preset.ref_image_url) {
        ref = loadPresetRef(preset.ref_image_url);
        setRefImage(ref);
      } else if (preset.requires_ref && !refImage) {
        toast.error(`${preset.name} needs a reference image`);
        return;
      }
      currentPresetIndex.current = presets.findIndex((p) => p.id === preset.id);
      activePresetKindRef.current =
        preset.template_key === "character_swap"
          ? "character_swap"
          : preset.template_key === "gesture_fx"
          ? "gesture_fx"
          : "other";
      await applyPrompt(preset.prompt, source, ref, { preset });
    },
    [applyPrompt, refImage, presets, loadPresetRef],
  );

  const applyTemplate = useCallback(
    async (payload: TemplateApplyPayload) => {
      if (!transportRef.current) {
        toast.error("Not connected yet");
        return;
      }
      const uid = userIdRef.current;
      const sid = sessionIdRef.current;
      let path: string | undefined;
      let url: string | undefined;
      if (uid && sid) {
        const key = `${uid}/${sid}/tpl-${Date.now()}.jpg`;
        const { error: uErr } = await supabase.storage
          .from("refs")
          .upload(key, payload.file, { contentType: "image/jpeg", upsert: false });
        if (!uErr) {
          path = key;
          const { data: signed } = await supabase.storage
            .from("refs")
            .createSignedUrl(key, 3600);
          url = signed?.signedUrl;
        }
      }
      // dataUri kept as fallback in case the storage upload failed.
      const ref = { dataUri: url ? undefined : payload.dataUri, url, path };
      setRefImage(ref);
      // Templates (object add-in, try-on, object replace) rely on the ref
      // image, not on baked landmarks — send Lucy a clean camera frame.
      activePresetKindRef.current = "other";
      await applyPrompt(payload.prompt, "preset", ref);
      toast.success("Applied");
    },
    [applyPrompt],
  );




  // --- Reactive Face: fire a preset for 4s then auto-revert ---
  const triggerReactive = useCallback(
    async (action: FaceAction, label: string, score: number) => {
      const promptText = REACTIVE_PROMPTS[action];
      if (!promptText || !transportRef.current) return;
      // Log as face + reactive
      const sid = sessionIdRef.current;
      const uid = userIdRef.current;
      if (sid && uid) {
        visionBufRef.current?.push({
          session_id: sid,
          user_id: uid,
          kind: "face",
          label,
          score,
          action,
          at_ms: at_ms(),
        });
        channelRef.current?.send({
          type: "broadcast",
          event: "vision",
          payload: { kind: "face", label, action, at_ms: at_ms() },
        });
      }
      const prev = appliedRef.current;
      const next: PromptState = { text: promptText };
      setPrevApplied(prev);
      setApplied(next);
      transportRef.current.send({
        prompt: promptText,
        enable_prompt_expansion: true,
      });
      await logPromptEvent("reactive", "face", next);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);
      revertTimerRef.current = setTimeout(async () => {
        // auto-revert to prev applied state
        if (!transportRef.current) return;
        setApplied(prev);
        transportRef.current.send({
          prompt: prev?.text ?? "",
          enable_prompt_expansion: !!prev?.text,
          reference_image_url: prev?.refUrl ?? prev?.refImage,
        });
        await logPromptEvent("apply", "face", prev);
      }, 4000);
    },
    [logPromptEvent],
  );

  // --- Handle a fired gesture ---
  const handleGesture = useCallback(
    async (label: string, action: GestureAction) => {
      haptic("tick");
      const sid = sessionIdRef.current;
      const uid = userIdRef.current;
      if (sid && uid) {
        visionBufRef.current?.push({
          session_id: sid,
          user_id: uid,
          kind: "gesture",
          label,
          score: 0.9,
          action,
          at_ms: at_ms(),
        });
        channelRef.current?.send({
          type: "broadcast",
          event: "vision",
          payload: { kind: "gesture", label, action, at_ms: at_ms() },
        });
      }

      switch (action) {
        case "commit":
          if (prompt.trim()) applyPrompt(prompt, "gesture");
          break;
        case "undo":
          undo();
          break;
        case "next_preset": {
          const nextIdx = (currentPresetIndex.current + 1) % Math.max(1, presets.length);
          const next = presets[nextIdx];
          if (next && (!next.requires_ref || refImage)) applyPreset(next, "gesture");
          break;
        }
        case "clear":
          clearPrompt();
          break;
        case "snapshot":
          await snapshot();
          break;
        case "toggle_reactive": {
          const on = !reactiveOnRef.current;
          reactiveOnRef.current = on;
          setReactiveOn(on);
          if (faceEngineRef.current) faceEngineRef.current.enabled = on;
          toast(`Reactive face: ${on ? "on" : "off"}`);
          break;
        }
        case "toggle_hud":
          setHudVisible((v) => !v);
          break;
        default:
          break;
      }
    },
    [prompt, applyPrompt, undo, clearPrompt, presets, refImage, applyPreset],
  );

  // --- Teardown current session (manual disconnect or auto-timeout) ---
  const stopSession = useCallback(async (reason?: "manual" | "timeout") => {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    autoStopScheduledRef.current = false;
    setRemainingMs(null);
    activePresetKindRef.current = "other";

    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    if (revertTimerRef.current) {
      clearTimeout(revertTimerRef.current);
      revertTimerRef.current = null;
    }
    if (inferenceFrameRef.current !== null) {
      cancelAnimationFrame(inferenceFrameRef.current);
      inferenceFrameRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    try {
      transportRef.current?.close();
    } catch {
      // ignore
    }
    transportRef.current = null;
    try {
      gestureRef.current?.close();
    } catch {
      // ignore
    }
    gestureRef.current = null;
    try {
      faceRef.current?.close();
    } catch {
      // ignore
    }
    faceRef.current = null;
    visionBufRef.current?.stop();
    visionBufRef.current = null;
    inputStreamRef.current?.getTracks().forEach((t) => t.stop());
    inputStreamRef.current = null;
    setInputStream(null);
    compositorRef.current?.stop();
    compositorRef.current = null;
    depthEngineRef.current?.stop();
    depthEngineRef.current = null;
    depthOnRef.current = false;
    setDepthOn(false);
    setDepthStream(null);
    setActiveSource("raw");

    outputStreamRef.current = null;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const sid = sessionIdRef.current;
    if (sid) {
      await supabase
        .from("sessions")
        .update({
          ended_at: new Date().toISOString(),
          stats: {
            transport: transportStateRef.current,
            perf_mode: perfModeRef.current,
            ended_reason: reason ?? "manual",
          },
        })
        .eq("id", sid);
    }
    sessionIdRef.current = null;
    setSessionId(null);
    setTransport(null);
    transportStateRef.current = null;
    setApplied(null);
    setPrevApplied(null);
    setLiveGesture({ label: null, score: 0, hold: 0 });
    setConnState("idle");
    if (reason === "timeout") {
      toast("Session ended after 90s");
    }
  }, []);

  // --- Start camera + session + fal + realtime channel ---
  const startSession = useCallback(async () => {

    setConnState("requesting_camera");
    try {
      // iOS Safari downgrades resolution aggressively when width/height/
      // aspectRatio all conflict — request the phone's native portrait via
      // facingMode only and let the browser pick optimal dims. Desktop can
      // safely ask for 1080p landscape and we crop client-side.
      const mobileCapture = typeof window !== "undefined"
        && window.matchMedia("(max-width: 768px)").matches;
      const videoConstraints: MediaTrackConstraints = mobileCapture
        ? {
            facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          }
        : {
            facingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          };
      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });


      inputStreamRef.current = stream;
      setInputStream(stream);
      if (inputVideoRef.current) {
        inputVideoRef.current.srcObject = stream;
        inputVideoRef.current.play().catch(() => {});
      }
      setConnState("camera_ready");

      // Create session row
      const uid = userIdRef.current!;
      const { data: session, error: sErr } = await supabase
        .from("sessions")
        .insert({ user_id: uid })
        .select()
        .single();
      if (sErr) throw sErr;
      sessionIdRef.current = session.id;
      setSessionId(session.id);
      startedAtRef.current = performance.now();

      // Realtime channel
      const ch = supabase.channel(`sess:${session.id}`);
      ch.on("broadcast", { event: "remote" }, (payload) => {
        const msg = payload.payload as RemoteMessage;
        if (msg.type === "apply" && msg.prompt) {
          applyPrompt(msg.prompt, "remote");
        } else if (msg.type === "clear") {
          clearPrompt();
        } else if (msg.type === "undo") {
          undo();
        } else if (msg.type === "preset") {
          const p = presets.find((x) => x.id === msg.presetId);
          if (p) applyPreset(p, "remote");
        }
      });
      await ch.subscribe();
      channelRef.current = ch;

      // Vision buffer starts flushing regardless of MediaPipe availability
      const vb = new VisionBuffer();
      vb.start();
      visionBufRef.current = vb;

      // Start MediaPipe (best-effort). Prefer any pre-warmed instances
      // kicked off from the landing hero — those overlap the getUserMedia
      // permission prompt so they cost ~0ms on Enter.
      let warmed: { gesture?: import("@mediapipe/tasks-vision").GestureRecognizer; face?: import("@mediapipe/tasks-vision").FaceLandmarker } | null = null;
      try {
        const p = takeWarmedVision();
        if (p) warmed = await p;
      } catch (e) {
        console.warn("warm vision failed", e);
      }
      try {
        const rec = warmed?.gesture ?? (await loadGestureRecognizer());
        gestureRef.current = rec;
        const engine = new GestureEngine();
        engine.onFire = (label, action) => {
          handleGesture(label, action);
        };
        engine.onLiveUpdate = (label, score, hold) => {
          setLiveGesture({ label, score, hold });
          lastHoldRef.current = hold;
        };
        engineRef.current = engine;
      } catch (e) {
        console.warn("gesture recognizer unavailable", e);
      }

      try {
        const fl = warmed?.face ?? (await loadFaceLandmarker());
        faceRef.current = fl;
        const fe = new FaceEngine();
        fe.onReactive = (action, label, score) =>
          triggerReactive(action, label, score);
        fe.onFacePresence = (present) => {
          facePresentRef.current = present;
          setFacePresent(present);
          // Pause outbound frames on no-face; resume on face-back
          transportRef.current?.setOutboundPaused(!present);
        };
        faceEngineRef.current = fe;
      } catch (e) {
        console.warn("face landmarker unavailable", e);
      }

      runInferenceLoop();

      // Ensure the camera video has dimensions ready so a lazy compositor
      // (built later by syncOutboundSource) can start drawing immediately.
      const camEl = inputVideoRef.current;
      if (camEl && camEl.readyState < 2) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            camEl.removeEventListener("loadedmetadata", onReady);
            resolve();
          };
          camEl.addEventListener("loadedmetadata", onReady, { once: true });
          setTimeout(resolve, 800);
        });
      }
      // NOTE: the CompositeStream is intentionally NOT built here. It is
      // constructed on demand by syncOutboundSource() only when a
      // Character-Swap or Gesture-FX preset activates. Clean-camera presets
      // and freeform prompts send the raw MediaStreamTrack straight to Lucy.


      // Start fal — always begin with the raw camera track. If a preset kind
      // is active, syncOutboundSource() will swap in the compositor track
      // without renegotiating SDP.
      setConnState("connecting");
      const t = new VideoTransport(stream, {

        onOutputStream: (out) => {
          outputStreamRef.current = out;
          if (outputVideoRef.current) {
            outputVideoRef.current.srcObject = out;
            outputVideoRef.current.play().catch(() => {});
          }
          setConnState("live");
          // Auto-start recording in 9:16 as soon as Lucy is live
          setDownload((d) => {
            if (d) URL.revokeObjectURL(d.url);
            return null;
          });
          setTimeout(() => startRecordingRef.current?.(true), 50);
          if (!autoStopScheduledRef.current) {
            autoStopScheduledRef.current = true;
            const AUTO_STOP_MS = 90_000;
            const deadline = Date.now() + AUTO_STOP_MS;
            setRemainingMs(AUTO_STOP_MS);
            countdownIntervalRef.current = setInterval(() => {
              const left = Math.max(0, deadline - Date.now());
              setRemainingMs(left);
              if (left <= 0 && countdownIntervalRef.current) {
                clearInterval(countdownIntervalRef.current);
                countdownIntervalRef.current = null;
              }
            }, 250);
            autoStopTimerRef.current = setTimeout(() => {
              void stopSession("timeout");
            }, AUTO_STOP_MS);
          }
        },

        onTransportChosen: (mode) => {
          transportStateRef.current = mode;
          setTransport(mode);
          supabase
            .from("sessions")
            .update({ transport: mode })
            .eq("id", session.id)
            .then(() => {});
        },
        onStateChange: (s) => {
          if (s === "reconnecting") {
            setConnState("reconnecting");
            toast.loading("Reconnecting to Lucy…", { id: "lucy-reconnect" });
          } else if (s === "connected") {
            toast.dismiss("lucy-reconnect");
            // If we were mid-reconnect, restore the "live" pill.
            if (transportStateRef.current) setConnState("live");
          } else if (s === "failed") {
            toast.dismiss("lucy-reconnect");
            toast.error("Lost connection to Lucy");
            setConnState("failed");
          }
        },
        onError: (e) => {
          console.error("fal error", e);
          setError(String((e as Error)?.message ?? e));
        },
      });
      transportRef.current = t;
      await t.start();
      // If a preset was pre-selected before connect (e.g. from Choose Your
      // Reality), swap in the compositor track now that the sender exists.
      syncOutboundSource();

      // Queue initial state until Lucy's WebRTC control channel opens.
      t.send({ prompt: "", enable_prompt_expansion: false });

      // QR code for remote
      const remoteUrl = `${window.location.origin}/remote/${session.id}`;
      QRCode.toDataURL(remoteUrl, { margin: 1, width: 240 }).then(setQrDataUrl);

      // Heartbeat to remote (every 3s) with current prompt state
      const hb = setInterval(() => {
        channelRef.current?.send({
          type: "broadcast",
          event: "heartbeat",
          payload: { prompt: appliedRef.current?.text ?? null, at: Date.now() },
        });
      }, 3000);
      heartbeatRef.current = hb;
    } catch (e) {
      console.error(e);
      setError(String((e as Error)?.message ?? e));
      setConnState("failed");
    }
  }, [applyPrompt, applyPreset, clearPrompt, handleGesture, presets, undo, stopSession, syncOutboundSource]);

  // --- MediaPipe inference loop (wall-clock scheduled, both engines) ---
  // Frame-based cadence made gesture holds land at 200ms on a 120Hz iPhone
  // and 800ms on a throttled Android — different UX per device. Time-base
  // ~15Hz for each engine so REQUIRED_STREAK_MS in GestureEngine means the
  // same wall-clock duration everywhere.
  const runInferenceLoop = useCallback(() => {
    const GESTURE_INTERVAL_MS = 66;   // ~15Hz gesture inference
    const FACE_INTERVAL_MS = 66;      // ~15Hz face inference
    const PIP_INTERVAL_MS = 66;       // ~15Hz PiP repaint (mobile PiP is ~96px)
    let lastGesture = 0;
    let lastFace = 0;
    let lastPip = 0;
    let lastTimestamp = 0;
    let slowStreak = 0;
    let last = performance.now();
    let fatal = false;
    const loop = () => {
      if (fatal) return;
      if (!inputVideoRef.current) {
        inferenceFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (dt > 33) {
        slowStreak++;
        if (slowStreak > 60 && !perfModeRef.current) {
          perfModeRef.current = true;
          setPerfMode(true);
        }
      } else if (slowStreak > 0) {
        slowStreak = Math.max(0, slowStreak - 1);
      }

      const v = inputVideoRef.current;
      const videoReady = v.readyState >= 2 && v.videoWidth > 0;
      if (videoReady) {
        const nextTs = () => {
          const ts = Math.max(lastTimestamp + 1, Math.round(performance.now()));
          lastTimestamp = ts;
          return ts;
        };
        try {
          if (now - lastGesture >= GESTURE_INTERVAL_MS && gestureRef.current && engineRef.current) {
            lastGesture = now;
            const result = gestureRef.current.recognizeForVideo(v, nextTs());
            engineRef.current.ingest(result);
            lastGestureResultRef.current = result;
          }
          if (now - lastFace >= FACE_INTERVAL_MS && faceRef.current && faceEngineRef.current) {
            lastFace = now;
            const fr = faceRef.current.detectForVideo(v, nextTs());
            faceEngineRef.current.ingest(fr);
          }
        } catch (e) {
          const message = String((e as Error)?.message ?? e);
          console.warn("vision inference stopped", e);
          if (message.includes("memory access out of bounds")) fatal = true;
        }

        // Repaint PiP at CSS-box resolution, not the 1280×720 camera source.
        // Also skip entirely when the PiP element has no layout box (HUD
        // hidden, panel unmounted) — saves ~50× fill-rate on mobile.
        const oc = overlayRef.current;
        if (oc && now - lastPip >= PIP_INTERVAL_MS) {
          lastPip = now;
          const cssW = oc.clientWidth;
          const cssH = oc.clientHeight;
          if (cssW > 0 && cssH > 0) {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const targetW = Math.round(cssW * dpr);
            const targetH = Math.round(cssH * dpr);
            if (oc.width !== targetW) oc.width = targetW;
            if (oc.height !== targetH) oc.height = targetH;
            const ctx = oc.getContext("2d");
            if (ctx) {
              ctx.save();
              ctx.clearRect(0, 0, targetW, targetH);
              // Object-cover: scale to fill and center-crop
              const vw = v.videoWidth;
              const vh = v.videoHeight;
              const s = Math.max(targetW / vw, targetH / vh);
              const dw = vw * s;
              const dh = vh * s;
              ctx.drawImage(v, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
              ctx.restore();
              drawHandOverlay(ctx, lastGestureResultRef.current, lastHoldRef.current);
              drawFaceOverlay(ctx, faceEngineRef.current?.lastResult ?? null);
            }
          }
        }
      }
      inferenceFrameRef.current = requestAnimationFrame(loop);
    };
    if (inferenceFrameRef.current !== null) {
      cancelAnimationFrame(inferenceFrameRef.current);
    }
    inferenceFrameRef.current = requestAnimationFrame(loop);
  }, []);

  // --- Record / snapshot / upload ---
  const uploadTake = useCallback(
    async (
      blob: Blob,
      kind: "video" | "snapshot",
      durationMs?: number,
      opts?: { autoDownload?: boolean; ext?: string },
    ) => {
      const uid = userIdRef.current;
      const sid = sessionIdRef.current;
      if (!uid || !sid) return;
      const ext = opts?.ext ?? (kind === "video" ? "webm" : "png");
      const bucket = "takes";
      const filename = `take-${Date.now()}.${ext}`;
      const path = `${uid}/${sid}/${filename}`;

      const autoDownload = opts?.autoDownload ?? true;
      if (autoDownload) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      setPendingUpload((n) => n + 1);
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { upsert: false });
      if (upErr) {
        setPendingUpload((n) => Math.max(0, n - 1));
        toast.error(`Upload failed: ${upErr.message}. Local download OK.`);
        return;
      }
      await supabase.from("takes").insert({
        session_id: sid,
        user_id: uid,
        kind,
        storage_path: path,
        duration_ms: durationMs ?? null,
        size_bytes: blob.size,
      });
      setPendingUpload((n) => Math.max(0, n - 1));
      toast.success(`${kind === "video" ? "Take" : "Snapshot"} saved`);
    },
    [],
  );

  const snapshot = useCallback(async () => {
    const s = outputStreamRef.current;
    if (!s) return;
    const track = s.getVideoTracks()[0];
    if (!track) return;
    // Fallback: draw current video frame
    const video = outputVideoRef.current;
    if (!video) return;
    const c = document.createElement("canvas");
    c.width = video.videoWidth || 1280;
    c.height = video.videoHeight || 720;
    c.getContext("2d")!.drawImage(video, 0, 0);
    c.toBlob((blob) => {
      if (blob) uploadTake(blob, "snapshot");
    }, "image/png");
  }, [uploadTake]);

  const startRecording = useCallback((auto: boolean) => {
    if (recorderRef.current?.state === "recording") return;
    const s = outputStreamRef.current;
    if (!s) {
      if (!auto) toast.error("Live stream not ready");
      return;
    }
    // Safari MediaRecorder does NOT support video/webm — check in this order
    // so iOS lands on mp4 and every other browser lands on VP9/VP8.
    const candidates = [
      "video/mp4;codecs=avc1.64001f,mp4a.40.2",
      "video/mp4",
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType = candidates.find((m) => MediaRecorder.isTypeSupported(m));
    if (!mimeType) {
      if (!auto) toast.error("Recording unsupported on this browser");
      return;
    }
    chunksRef.current = [];
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(s, { mimeType });
    } catch (e) {
      console.warn("MediaRecorder init failed", e);
      try {
        rec = new MediaRecorder(s);
      } catch (e2) {
        console.warn("MediaRecorder fallback failed", e2);
        if (!auto) toast.error("Recording unavailable");
        return;
      }
    }
    const activeMime = rec.mimeType || mimeType;
    const ext = activeMime.includes("mp4") ? "mp4" : "webm";
    autoRecordRef.current = auto;
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: activeMime });
      const dur = Math.round(performance.now() - recordStartRef.current);
      const wasAuto = autoRecordRef.current;
      const filename = `zap-live-${Date.now()}.${ext}`;
      if (wasAuto) {
        const url = URL.createObjectURL(blob);
        setDownload({ url, filename });
      }
      uploadTake(blob, "video", dur, { autoDownload: !wasAuto, ext });
      setRecording(false);
    };
    recordStartRef.current = performance.now();
    try {
      rec.start(1000);
    } catch (e) {
      console.warn("MediaRecorder start failed", e);
      if (!auto) toast.error("Recording failed to start");
      return;
    }
    recorderRef.current = rec;
    setRecording(true);
    // Auto-stop at 10 min for manual records
    if (!auto) {
      setTimeout(() => {
        if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      }, 10 * 60 * 1000);
    }
  }, [uploadTake]);

  useEffect(() => {
    startRecordingRef.current = startRecording;
  }, [startRecording]);

  const toggleRecord = useCallback(() => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    startRecording(false);
  }, [recording, startRecording]);

  // Keep appliedRef in sync
  useEffect(() => {
    appliedRef.current = applied;
  }, [applied]);

  // Auto-apply a preset selected from the landing "Choose your reality" wheel
  useEffect(() => {
    if (connState !== "live" || !presets.length) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem("zaplive.pendingPresetId");
    } catch {
      pending = null;
    }
    if (!pending) return;
    const p = presets.find((x) => String(x.id) === pending);
    try {
      sessionStorage.removeItem("zaplive.pendingPresetId");
    } catch {}
    if (p) applyPreset(p, "preset");
  }, [connState, presets, applyPreset]);

  useEffect(() => {
    pendingUploadRef.current = pendingUpload;
  }, [pendingUpload]);

  // Callback refs: attach srcObject the instant the <video> mounts (or remounts).
  const attachInputVideo = useCallback((el: HTMLVideoElement | null) => {
    inputVideoRef.current = el;
    const s = inputStreamRef.current;
    if (el && s && el.srcObject !== s) {
      el.srcObject = s;
      el.play().catch(() => {});
    }
  }, []);

  const attachOutputVideo = useCallback((el: HTMLVideoElement | null) => {
    outputVideoRef.current = el;
    const s = outputStreamRef.current;
    if (el && s && el.srcObject !== s) {
      el.srcObject = s;
      el.play().catch(() => {});
    }
  }, []);

  // --- Cleanup, tab-hidden pause, un-uploaded warning ---
  useEffect(() => {
    const endSession = async () => {
      if (!sessionIdRef.current) return;
      await supabase
        .from("sessions")
        .update({
          ended_at: new Date().toISOString(),
          stats: {
            transport: transportStateRef.current,
            perf_mode: perfModeRef.current,
          },
        })
        .eq("id", sessionIdRef.current);
    };

    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const onVisibility = () => {
      if (document.hidden) {
        hideTimer = setTimeout(() => {
          transportRef.current?.setOutboundPaused(true);
        }, 60_000);
      } else {
        if (hideTimer) clearTimeout(hideTimer);
        hideTimer = null;
        transportRef.current?.setOutboundPaused(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingUploadRef.current > 0 || recorderRef.current?.state === "recording") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      if (hideTimer) clearTimeout(hideTimer);
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (revertTimerRef.current) clearTimeout(revertTimerRef.current);

      if (inferenceFrameRef.current !== null) {
        cancelAnimationFrame(inferenceFrameRef.current);
        inferenceFrameRef.current = null;
      }
      transportRef.current?.close();
      recorderRef.current?.stop();
      gestureRef.current?.close();
      faceRef.current?.close();
      visionBufRef.current?.stop();
      compositorRef.current?.stop();
      inputStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      endSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (prompt.trim()) applyPrompt(prompt, "text");
      } else if (e.key === "r" || e.key === "R") {
        toggleRecord();
      } else if (e.key === "z" || e.key === "Z") {
        undo();
      } else if (e.key === "v" || e.key === "V") {
        setHudVisible((v) => !v); // toggle PiP+HUD chrome
      } else if (e.key === "h" || e.key === "H") {
        setHudVisible((v) => !v);
      } else if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === "0" ? 9 : parseInt(e.key, 10) - 1;
        const p = presets[idx];
        if (p) applyPreset(p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt, presets, applyPrompt, applyPreset, toggleRecord, undo]);

  // --- Ref image upload ---
  const onRefUpload = async (file: File) => {
    const img = new Image();
    const dataUri = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(file);
    });
    img.src = dataUri;
    await new Promise((res) => (img.onload = res));
    if (img.width < 512 || img.height < 512) {
      toast.error("Reference must be at least 512×512");
      return;
    }
    // downscale to 1024
    const c = document.createElement("canvas");
    const scale = Math.min(1, 1024 / Math.max(img.width, img.height));
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const smallDataUri = c.toDataURL("image/jpeg", 0.85);

    // Upload to storage and resolve a signed URL so we can send Lucy a
    // ~100-byte URL over the WS instead of a 200-400KB base64 payload.
    const uid = userIdRef.current!;
    const sid = sessionIdRef.current!;
    const path = `${uid}/${sid}/ref-${Date.now()}.jpg`;
    const blob = await (await fetch(smallDataUri)).blob();
    const { error: uErr } = await supabase.storage.from("refs").upload(path, blob);
    if (uErr) toast.error(uErr.message);
    let url: string | undefined;
    if (!uErr) {
      const { data: signed } = await supabase.storage
        .from("refs")
        .createSignedUrl(path, 3600);
      url = signed?.signedUrl;
    }
    // dataUri kept only when storage upload failed.
    setRefImage({
      dataUri: url ? undefined : smallDataUri,
      url,
      path: uErr ? undefined : path,
    });
    toast.success("Reference set");
  };

  const clearRefImage = useCallback(() => {
    setRefImage(null);
    // If a prompt is currently applied with a ref, re-apply it without one
    // so Lucy immediately drops the reference from the live feed.
    const cur = appliedRef.current;
    if ((cur?.refImage || cur?.refUrl) && transportRef.current) {
      transportRef.current.send({
        prompt: cur.text,
        enable_prompt_expansion: enhance,
      });
      const next: PromptState = { text: cur.text };
      setApplied(next);
    }
    toast("Reference cleared");
  }, [enhance]);

  const applyRefImage = useCallback(() => {
    if (!transportRef.current) {
      toast.error("Not connected yet");
      return;
    }
    if (!refImage) {
      toast.error("Upload a reference first");
      return;
    }
    const text = prompt.trim() || appliedRef.current?.text || "";
    if (!text) {
      toast.error("Type a prompt first");
      return;
    }
    void applyPrompt(text, "text", refImage);
    toast.success("Applied with reference");
  }, [refImage, prompt, applyPrompt]);

  // --- Computah voice control ---
  const handleVoiceToolCall = useCallback(
    async (call: VoiceToolCall) => {
      const agent = voiceAgentRef.current;
      const t0 = performance.now();
      if (call.name === "wait_for_user") {
        agent?.sendToolOutput(call.callId, { status: "ok" }, { respond: false });
        return;
      }
      if (call.name === "wake_word_missed") {
        // Safety net: Whisper heard the wake word but the model didn't route it.
        const t = (call.args as { transcript?: string })?.transcript ?? "";
        toast(`Heard "${t.slice(0, 60)}" — say it again`);
        return;
      }
      if (call.name !== "apply_video_edit") {
        agent?.sendToolOutput(
          call.callId,
          { status: "unknown_tool" },
          { respond: false },
        );
        return;
      }
      const args = (call.args ?? {}) as {
        edit_type?: unknown;
        lucy_prompt?: unknown;
        use_reference_image?: unknown;
      };
      const editType = isEditTypeId(args.edit_type) ? args.edit_type : null;
      const lucyPrompt =
        typeof args.lucy_prompt === "string" ? args.lucy_prompt.trim() : "";
      const useRef = args.use_reference_image === true;
      if (!editType || !lucyPrompt) {
        agent?.sendToolOutput(
          call.callId,
          { status: "invalid_args" },
          { respond: false },
        );
        return;
      }
      setVoiceIntent(editType);
      setVoiceState("thinking");
      try {
        const ref = useRef ? refImage : null;
        activePresetKindRef.current = "other";
        await applyPrompt(lucyPrompt, "voice", ref);
        agent?.sendToolOutput(
          call.callId,
          { status: "applied" },
          { respond: false },
        );
        setVoiceState("armed");
        // Log to voice_events
        const uid = userIdRef.current;
        const sid = sessionIdRef.current;
        if (uid && sid) {
          void supabase.from("voice_events").insert({
            session_id: sid,
            user_id: uid,
            transcript: voiceTranscript || null,
            wake_detected: true,
            edit_type: editType,
            lucy_prompt: lucyPrompt,
            ack_word: voiceAck || null,
            latency_ms: Math.round(performance.now() - t0),
            at_ms: at_ms(),
          });
        }
      } catch (e) {
        console.warn("voice apply failed", e);
        agent?.sendToolOutput(
          call.callId,
          { status: "error" },
          { respond: false },
        );
        setVoiceState("armed");
      }
    },
    [applyPrompt, refImage, voiceAck, voiceTranscript],
  );

  const toggleVoice = useCallback(async () => {
    if (voiceAgentRef.current) {
      voiceAgentRef.current.close();
      voiceAgentRef.current = null;
      setVoiceState("off");
      setVoiceTranscript("");
      setVoiceAck("");
      setVoiceIntent(null);
      return;
    }
    if (!voiceAvailable) {
      toast.error("Voice control needs a browser with microphone + WebRTC.");
      return;
    }
    const agent = new VoiceAgent({
      onState: setVoiceState,
      onTranscript: (t) => setVoiceTranscript(t),
      onAck: (w) => setVoiceAck(w),
      onToolCall: handleVoiceToolCall,
      onError: (e) => {
        console.warn("voice agent error", e);
        toast.error("Computah voice error");
      },
      onIdleDisarm: () => {
        toast("Computah listening off (idle)");
        voiceAgentRef.current = null;
      },
    });
    voiceAgentRef.current = agent;
    try {
      await agent.start();
      toast('Say "Computah" then your edit');
    } catch {
      voiceAgentRef.current = null;
    }
  }, [voiceAvailable, handleVoiceToolCall]);

  // Ensure the mic is released on unmount
  useEffect(() => {
    return () => {
      voiceAgentRef.current?.close();
      voiceAgentRef.current = null;
    };
  }, []);




  const savePreset = async () => {
    if (!applied?.text) return;
    const name = window.prompt("Preset name?");
    if (!name) return;
    const uid = userIdRef.current!;
    const { data } = await supabase
      .from("presets")
      .insert({
        user_id: uid,
        name,
        emoji: "⭐",
        prompt: applied.text,
        requires_ref: !!applied.refImage,
        sort_order: 200,
      })
      .select()
      .single();
    if (data) setPresets((prev) => [...prev, data]);
  };

  const flippingRef = useRef(false);
  const flipCamera = useCallback(() => {
    if (flippingRef.current) return;
    if (!inputStreamRef.current) return;
    flippingRef.current = true;
    setFlipping(true);
    const next: "user" | "environment" = facingMode === "user" ? "environment" : "user";
    void (async () => {
      const mobileCapture = typeof window !== "undefined"
        && window.matchMedia("(max-width: 768px)").matches;
      const videoConstraints: MediaTrackConstraints = mobileCapture
        ? { facingMode: next, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }
        : { facingMode: next, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } };
      let newStream: MediaStream | null = null;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false,
        });
      } catch (e) {
        console.warn("flipCamera getUserMedia failed", e);
        toast.error(next === "environment" ? "No back camera available" : "Front camera unavailable");
        flippingRef.current = false;
        setFlipping(false);
        return;
      }
      // Swap in the new stream, then stop the old tracks.
      const old = inputStreamRef.current;
      inputStreamRef.current = newStream;
      setInputStream(newStream);
      if (inputVideoRef.current) {
        inputVideoRef.current.srcObject = newStream;
        inputVideoRef.current.play().catch(() => {});
      }
      old?.getTracks().forEach((t) => t.stop());
      setFacingMode(next);
      // If depth is running, restart it against the new video source so its
      // internal canvas gets a fresh first frame before we swap Lucy over.
      if (depthOnRef.current && depthEngineRef.current && inputVideoRef.current) {
        try {
          depthEngineRef.current.attach(inputVideoRef.current);
          await depthEngineRef.current.waitForFirstFrame(3000);
        } catch (e) {
          console.warn("depth re-attach failed", e);
        }
      }
      // Compositor reads from the <video> element directly, so it picks up
      // the new stream automatically — just resync the outbound track.
      syncOutboundSource();
      flippingRef.current = false;
      setFlipping(false);
    })();
  }, [facingMode, syncOutboundSource]);

  if (connState === "idle") {
    return (
      <>
        <LandingHero
          onEnter={() => {
            if (authReady) startSession();
          }}
          disabled={!authReady}
        />
        {error && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200 backdrop-blur">
            {error}
          </div>
        )}
      </>
    );
  }

  const viewProps = {
    connState,
    transport,
    error,
    perfMode,
    facePresent,
    reactiveOn,
    pendingUpload,
    remainingMs,
    recording,
    hudVisible,
    setHudVisible,
    attachInputVideo,
    attachOutputVideo,
    overlayRef,
    qrDataUrl,
    inputStream,
    latencyMs,
    onOutputFrame: recordLatencySample,
    prompt,
    setPrompt,
    enhance,
    setEnhance,
    applied,
    prevApplied,
    refImage,
    liveGesture,
    applyPrompt: (text: string, source: "text") => void applyPrompt(text, source, refImage),
    undo: () => void undo(),
    clearPrompt: () => void clearPrompt(),
    toggleRecord,
    stopSession: (r?: "manual" | "timeout") => void stopSession(r),
    onRefUpload,
    clearRefImage,
    applyRefImage: () => void applyRefImage(),
    refImagePending: !!refImage && (refImage.url ?? refImage.dataUri) !== (applied?.refUrl ?? applied?.refImage),
    bakeLandmarks,
    toggleBakeLandmarks,
    landmarksAvailable:
      activePresetKindRef.current === "character_swap" ||
      activePresetKindRef.current === "gesture_fx",
    savePreset,
    flipCamera,
    flipping,
    facingMode,
    presets,
    applyPreset: (p: Preset) => void applyPreset(p),
    openTemplate: (key: TemplateKey, name: string) => setTemplateDialog({ key, name }),
    download,
    depthOn,
    depthLoading,
    depthAvailable,
    depthProgress,
    toggleDepth,
    depthStream,
    activeSource,
    voiceState,
    voiceTranscript,
    voiceAck,
    voiceIntent,
    voiceIntentLabel: voiceIntent ? editLabel(voiceIntent) : null,
    voiceAvailable,
    toggleVoice: () => void toggleVoice(),
  };

  return (
    <>
      {isMobile ? <MobileStage {...viewProps} /> : <DesktopStage {...viewProps} />}
      {templateDialog && (
        <TemplateDialog
          open={!!templateDialog}
          templateKey={templateDialog.key}
          name={templateDialog.name}
          onClose={() => setTemplateDialog(null)}
          onApply={applyTemplate}
        />
      )}
    </>
  );
}

