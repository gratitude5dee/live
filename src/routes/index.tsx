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
import { loadGestureRecognizer, loadFaceLandmarker } from "@/lib/zap/mediapipe";
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
} from "@/lib/zap/types";
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
  const [refImage, setRefImage] = useState<{ dataUri: string; path?: string } | null>(
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

  // --- Depth (WebGPU) state ---
  const [depthOn, setDepthOn] = useState(false);
  const [depthLoading, setDepthLoading] = useState(false);
  const [depthProgress, setDepthProgress] = useState(0);
  const [depthAvailable] = useState(() => DepthEngine.webgpuAvailable());
  const depthOnRef = useRef(false);
  const depthEngineRef = useRef<DepthEngine | null>(null);

  // Pick raw camera / compositor / depth for the outbound video track based on
  // active preset kind + depth toggle, and hot-swap via replaceTrack.
  const syncOutboundSource = useCallback(() => {
    const transport = transportRef.current;
    if (!transport) return;
    let src: MediaStream | null = null;
    if (depthOnRef.current && depthEngineRef.current) {
      src = depthEngineRef.current.stream;
    } else {
      const kind = activePresetKindRef.current;
      const useComposite = kind === "character_swap" || kind === "gesture_fx";
      src = useComposite
        ? compositorRef.current?.stream ?? inputStreamRef.current
        : inputStreamRef.current;
    }
    const track = src?.getVideoTracks()[0] ?? null;
    if (track) void transport.replaceVideoTrack(track);
  }, []);

  const toggleDepth = useCallback(async () => {
    if (!depthAvailable) {
      toast.error("WebGPU not available in this browser");
      return;
    }
    if (depthOnRef.current) {
      depthOnRef.current = false;
      setDepthOn(false);
      depthEngineRef.current?.stop();
      depthEngineRef.current = null;
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
      depthEngineRef.current = engine;
      depthOnRef.current = true;
      setDepthOn(true);
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
      source: "text" | "gesture" | "face" | "preset" | "remote",
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
      source: "text" | "gesture" | "face" | "preset" | "remote",
      ref?: { dataUri: string; path?: string } | null,
    ) => {
      if (!transportRef.current) return;
      // Free-text / gesture / face / remote prompts should not bake MediaPipe
      // into Lucy's input — only preset apply paths can opt into that.
      if (source !== "preset") activePresetKindRef.current = "other";
      syncOutboundSource();
      const next: PromptState = {
        text,
        refImage: ref?.dataUri,
        refPath: ref?.path,
      };
      setPrevApplied(applied);
      setApplied(next);
      transportRef.current.send({
        prompt: text,
        enable_prompt_expansion: enhance,
        reference_image_url: next.refImage,
      });
      const kind = source === "preset" ? "preset" : "apply";
      await logPromptEvent(kind, source, next);
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
      reference_image_url: prevApplied.refImage,
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

  const presetRefCache = useRef<Map<string, { dataUri: string; path: string }>>(new Map());

  const loadPresetRef = useCallback(async (url: string) => {
    const cached = presetRefCache.current.get(url);
    if (cached) return cached;
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUri: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    const entry = { dataUri, path: url };
    presetRefCache.current.set(url, entry);
    return entry;
  }, []);

  const applyPreset = useCallback(
    async (preset: Preset, source: "preset" | "gesture" | "remote" = "preset") => {
      let ref = refImage;
      if (preset.ref_image_url) {
        try {
          ref = await loadPresetRef(preset.ref_image_url);
          setRefImage(ref);
        } catch {
          toast.error(`Couldn't load reference for ${preset.name}`);
          return;
        }
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
      await applyPrompt(preset.prompt, source, ref);
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
      if (uid && sid) {
        const key = `${uid}/${sid}/tpl-${Date.now()}.jpg`;
        const { error: uErr } = await supabase.storage
          .from("refs")
          .upload(key, payload.file, { contentType: "image/jpeg", upsert: false });
        if (!uErr) path = key;
      }
      const ref = { dataUri: payload.dataUri, path };
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
          reference_image_url: prev?.refImage,
        });
        await logPromptEvent("apply", "face", prev);
      }, 4000);
    },
    [logPromptEvent],
  );

  // --- Handle a fired gesture ---
  const handleGesture = useCallback(
    async (label: string, action: GestureAction) => {
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
    compositorRef.current?.stop();
    compositorRef.current = null;
    depthEngineRef.current?.stop();
    depthEngineRef.current = null;
    depthOnRef.current = false;
    setDepthOn(false);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
          frameRate: { ideal: 30 },
          facingMode,
        },
        audio: false,
      });

      inputStreamRef.current = stream;
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

      // Start MediaPipe (best-effort)
      try {
        const rec = await loadGestureRecognizer();
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
        const fl = await loadFaceLandmarker();
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

      // Build the compositor eagerly so we can hot-swap to it the moment a
      // Character Swap / Gesture FX preset activates. By default we send the
      // raw camera track to Lucy for maximum quality (no canvas re-encode).
      try {
        const src = inputVideoRef.current;
        if (src) {
          // Ensure the source video has dimensions before we start reading it.
          if (src.readyState < 2) {
            await new Promise<void>((resolve) => {
              const onReady = () => {
                src.removeEventListener("loadedmetadata", onReady);
                resolve();
              };
              src.addEventListener("loadedmetadata", onReady, { once: true });
              // Safety timeout — never block session start on this.
              setTimeout(resolve, 800);
            });
          }
          const compositor = new CompositeStream(
            src,
            (ctx, _w, _h) => {
              // Only bake landmarks when the active preset opts in.
              // The on-screen PiP still shows both overlays for user feedback.
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
        }
      } catch (e) {
        console.warn("compositor unavailable — clean camera only", e);
      }

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

  // --- MediaPipe inference loop (single rAF, both engines, adaptive rate) ---
  const runInferenceLoop = useCallback(() => {
    let frame = 0;
    let slowStreak = 0;
    let everyN = 2;
    let last = performance.now();
    let lastTimestamp = 0;
    let fatal = false;
    const loop = () => {
      if (fatal) return;
      if (!inputVideoRef.current) {
        inferenceFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      frame++;
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (dt > 33) {
        slowStreak++;
        if (slowStreak > 60 && everyN === 2) {
          everyN = 3;
          perfModeRef.current = true;
          setPerfMode(true);
        }
      } else if (slowStreak > 0) {
        slowStreak = Math.max(0, slowStreak - 1);
      }

      if (
        frame % everyN === 0 &&
        inputVideoRef.current.readyState >= 2 &&
        inputVideoRef.current.videoWidth > 0
      ) {
        const ts = Math.max(lastTimestamp + 1, Math.round(performance.now()));
        lastTimestamp = ts;
        // MediaPipe tasks share WASM resources. Alternate them rather than
        // invoking two task graphs against the same video frame back-to-back.
        const runGesture = frame % (everyN * 2) === 0;
        try {
          if (runGesture && gestureRef.current && engineRef.current) {
            const result = gestureRef.current.recognizeForVideo(
              inputVideoRef.current,
              ts,
            );
            engineRef.current.ingest(result);
            lastGestureResultRef.current = result;
          } else if (!runGesture && faceRef.current && faceEngineRef.current) {
            const fr = faceRef.current.detectForVideo(inputVideoRef.current, ts);
            faceEngineRef.current.ingest(fr);
          }
        } catch (e) {
          const message = String((e as Error)?.message ?? e);
          console.warn("vision inference stopped", e);
          if (message.includes("memory access out of bounds")) fatal = true;
        }

        // Paint the camera into canvas as a compositing-safe PiP, then overlay
        // the hand visualization. Some browsers render live video as a black
        // hardware layer even while canvas/MediaPipe can read its frames.
        const oc = overlayRef.current;
        if (oc) {
          const v = inputVideoRef.current;
          const w = v.videoWidth || 640;
          const h = v.videoHeight || 360;
          if (oc.width !== w) oc.width = w;
          if (oc.height !== h) oc.height = h;
          const ctx = oc.getContext("2d");
          if (ctx) {
            ctx.save();
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(v, 0, 0, w, h);
            ctx.restore();
            drawHandOverlay(ctx, lastGestureResultRef.current, lastHoldRef.current);
            drawFaceOverlay(ctx, faceEngineRef.current?.lastResult ?? null);
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
      opts?: { autoDownload?: boolean },
    ) => {
      const uid = userIdRef.current;
      const sid = sessionIdRef.current;
      if (!uid || !sid) return;
      const ext = kind === "video" ? "webm" : "png";
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
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm;codecs=vp8";
    const rec = new MediaRecorder(s, { mimeType });
    autoRecordRef.current = auto;
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const dur = Math.round(performance.now() - recordStartRef.current);
      const wasAuto = autoRecordRef.current;
      const filename = `zap-live-${Date.now()}.webm`;
      if (wasAuto) {
        const url = URL.createObjectURL(blob);
        setDownload({ url, filename });
      }
      uploadTake(blob, "video", dur, { autoDownload: !wasAuto });
      setRecording(false);
    };
    recordStartRef.current = performance.now();
    rec.start(1000);
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

    // Upload to storage
    const uid = userIdRef.current!;
    const sid = sessionIdRef.current!;
    const path = `${uid}/${sid}/ref-${Date.now()}.jpg`;
    const blob = await (await fetch(smallDataUri)).blob();
    const { error: uErr } = await supabase.storage.from("refs").upload(path, blob);
    if (uErr) toast.error(uErr.message);
    setRefImage({ dataUri: smallDataUri, path: uErr ? undefined : path });
    toast.success("Reference set");
  };

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

  const flipCamera = useCallback(() => {
    setFacingMode((m) => (m === "user" ? "environment" : "user"));
    // Restart the stream on the next tick; teardown then start fresh session.
    void (async () => {
      await stopSession("manual");
      // small delay so refs clear
      setTimeout(() => startSession(), 200);
    })();
  }, [startSession, stopSession]);

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
    prompt,
    setPrompt,
    enhance,
    setEnhance,
    applied,
    prevApplied,
    refImage,
    liveGesture,
    applyPrompt: (text: string, source: "text") => void applyPrompt(text, source),
    undo: () => void undo(),
    clearPrompt: () => void clearPrompt(),
    toggleRecord,
    stopSession: (r?: "manual" | "timeout") => void stopSession(r),
    onRefUpload,
    savePreset,
    flipCamera,
    presets,
    applyPreset: (p: Preset) => void applyPreset(p),
    openTemplate: (key: TemplateKey, name: string) => setTemplateDialog({ key, name }),
    download,
    depthOn,
    depthLoading,
    depthAvailable,
    depthProgress,
    toggleDepth,
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

