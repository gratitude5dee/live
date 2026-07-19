import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { VideoTransport } from "@/lib/zap/fal-transport";
import { GestureEngine, type GestureAction } from "@/lib/zap/gesture-engine";
import { FaceEngine, type FaceAction } from "@/lib/zap/face-engine";
import { VisionBuffer } from "@/lib/zap/vision-buffer";
import { drawHandOverlay, drawFaceOverlay } from "@/lib/zap/overlay";
import { loadGestureRecognizer, loadFaceLandmarker } from "@/lib/zap/mediapipe";
import LandingHero from "@/components/zap/LandingHero";
import SpecularButton from "@/components/reactbits/SpecularButton";
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
          "Your webcam is the timeline. Edit the live feed with prompts, gestures, and reference images — Lucy 2.5 repaints every frame in under a second.",
      },
      { property: "og:title", content: "ZAP·LIVE — realtime video editor" },
      {
        property: "og:description",
        content:
          "Live-streaming video editor powered by Lucy 2.5. Prompts, gestures, presets — realtime.",
      },
    ],
  }),
  component: StagePage,
});

function StagePage() {
  const [authReady, setAuthReady] = useState(false);
  const [connState, setConnState] = useState<ConnectionState>("idle");
  const [sessionId, setSessionId] = useState<string | null>(null);
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



  const inputVideoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
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
    [applied, enhance, logPromptEvent],
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
    transportRef.current.send({ prompt: "", enable_prompt_expansion: false });
    await logPromptEvent("clear", "gesture", null);
  }, [applied, logPromptEvent]);

  const applyPreset = useCallback(
    async (preset: Preset, source: "preset" | "gesture" | "remote" = "preset") => {
      if (preset.requires_ref && !refImage) {
        toast.error(`${preset.name} needs a reference image`);
        return;
      }
      currentPresetIndex.current = presets.findIndex((p) => p.id === preset.id);
      await applyPrompt(preset.prompt, source, refImage);
    },
    [applyPrompt, refImage, presets],
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
        video: { width: 1280, height: 720, frameRate: 30 },
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

      // Start fal
      setConnState("connecting");
      const t = new VideoTransport(stream, {
        onOutputStream: (out) => {
          outputStreamRef.current = out;
          if (outputVideoRef.current) {
            outputVideoRef.current.srcObject = out;
            outputVideoRef.current.play().catch(() => {});
          }
          setConnState("live");
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
  }, [applyPrompt, applyPreset, clearPrompt, handleGesture, presets, undo]);

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
    async (blob: Blob, kind: "video" | "snapshot", durationMs?: number) => {
      const uid = userIdRef.current;
      const sid = sessionIdRef.current;
      if (!uid || !sid) return;
      const ext = kind === "video" ? "webm" : "png";
      const bucket = "takes";
      const filename = `take-${Date.now()}.${ext}`;
      const path = `${uid}/${sid}/${filename}`;

      // Immediate local download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

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

  const toggleRecord = useCallback(() => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    const s = outputStreamRef.current;
    if (!s) {
      toast.error("Live stream not ready");
      return;
    }
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm;codecs=vp8";
    const rec = new MediaRecorder(s, { mimeType });
    rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    rec.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      const dur = Math.round(performance.now() - recordStartRef.current);
      uploadTake(blob, "video", dur);
      setRecording(false);
    };
    recordStartRef.current = performance.now();
    rec.start(1000);
    recorderRef.current = rec;
    setRecording(true);
    // Auto-stop at 10 min
    setTimeout(() => {
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    }, 10 * 60 * 1000);
  }, [recording, uploadTake]);

  // Keep appliedRef in sync
  useEffect(() => {
    appliedRef.current = applied;
  }, [applied]);

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

  const statusColor =
    connState === "live"
      ? "bg-emerald-500"
      : connState === "failed"
        ? "bg-red-500"
        : "bg-amber-500";

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

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#FAFAFA]">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-[#2A2A35] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="font-bold tracking-wider text-[#22D3EE]">ZAP·LIVE</span>
          <span className="flex items-center gap-1.5 rounded-full bg-[#16161D] px-2.5 py-1 text-xs">
            <span className={`h-2 w-2 rounded-full ${statusColor}`} />
            {connState}
            {transport && <span className="text-[#9CA3AF]">· {transport}</span>}
          </span>
          {liveGesture.label && hudVisible && (
            <span className="rounded-full bg-[#16161D] px-2.5 py-1 text-xs text-[#E879F9]">
              {liveGesture.label} {liveGesture.score.toFixed(2)}
            </span>
          )}
          {reactiveOn && hudVisible && (
            <span className="rounded-full bg-[#E879F9]/20 px-2.5 py-1 text-xs text-[#E879F9]">
              Reactive Face
            </span>
          )}
          {perfMode && hudVisible && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-400">
              Performance mode
            </span>
          )}
          {!facePresent && connState === "live" && hudVisible && (
            <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs text-amber-400">
              Step into frame
            </span>
          )}
          {pendingUpload > 0 && (
            <span className="rounded-full bg-[#16161D] px-2.5 py-1 text-xs text-[#9CA3AF]">
              ↑ {pendingUpload}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/library"
            className="rounded-md bg-[#16161D] px-3 py-1.5 text-xs hover:bg-[#22222D]"
          >
            Library
          </Link>
          {connState === "live" && (
            <SpecularButton
              size="sm"
              radius={10}
              onClick={toggleRecord}
              tint={recording ? "#F87171" : "#F87171"}
              tintOpacity={recording ? 0.9 : 0.15}
              textColor={recording ? "#0a0a0f" : "#fca5a5"}
              lineColor="#fca5a5"
              baseColor="#7f1d1d"
            >
              {recording ? "■ Stop" : "⬤ Record"}
            </SpecularButton>
          )}
        </div>
      </header>

      {error && (
        <div className="border-b border-red-500/50 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Stage */}
      <main className="relative mx-auto max-w-6xl p-4">
        {(
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-[#2A2A35] bg-black">

            <video
              ref={attachOutputVideo}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {connState !== "live" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-[#9CA3AF]">
                {connState === "connecting"
                  ? "Connecting to Lucy…"
                  : connState === "requesting_camera"
                    ? "Requesting camera…"
                    : connState}
              </div>
            )}

            {/* PiP — kept mounted (inference reads from it); chrome hidden when HUD off */}
            <div
              className={`absolute right-3 top-3 h-36 w-64 overflow-hidden rounded-lg border border-[#2A2A35] bg-black shadow-lg transition-opacity ${hudVisible ? "opacity-100" : "pointer-events-none opacity-0"}`}
            >
              <video
                ref={attachInputVideo}
                className="h-full w-full -scale-x-100 object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas
                ref={overlayRef}
                className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
              />
              {!facePresent && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs text-amber-300">
                  Step into frame
                </div>
              )}
              {liveGesture.label && (
                <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-[#22D3EE]">
                  {liveGesture.label} · {liveGesture.score.toFixed(2)}
                </div>
              )}
              {liveGesture.hold > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 h-1 bg-[#FAFAFA]"
                  style={{ width: `${liveGesture.hold * 100}%` }}
                />
              )}
            </div>



            {qrDataUrl && (
              <div className="absolute bottom-3 right-3 rounded-lg bg-white p-1">
                <img src={qrDataUrl} alt="Remote QR" className="h-24 w-24" />
              </div>
            )}
          </div>
        )}

        {/* Preset rail */}
        {/* Preset rail */}
        {(

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {presets.map((p, i) => (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                disabled={p.requires_ref && !refImage}
                className="flex min-w-[80px] flex-col items-center gap-1 rounded-xl border border-[#2A2A35] bg-[#16161D] px-3 py-2 text-xs transition hover:border-[#22D3EE] disabled:opacity-40"
                title={`${p.name} (${i < 9 ? i + 1 : 0})`}
              >
                <span className="text-xl">{p.emoji}</span>
                <span className="text-[#9CA3AF]">{p.name}</span>
              </button>
            ))}
            {applied && (
              <button
                onClick={savePreset}
                className="min-w-[80px] rounded-xl border border-dashed border-[#2A2A35] px-3 py-2 text-xs text-[#9CA3AF] hover:border-[#E879F9]"
              >
                ＋ Save
              </button>
            )}
          </div>
        )}

        {/* Prompt dock */}
        {(
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#2A2A35] bg-[#16161D] p-3">
            <input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && prompt.trim())
                  applyPrompt(prompt, "text");
              }}
              placeholder="Describe an edit… (e.g. change background to snowy mountain)"
              className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-[#4a4a5a]"
            />
            <label className="flex items-center gap-1 text-xs text-[#9CA3AF]">
              <input
                type="checkbox"
                checked={enhance}
                onChange={(e) => setEnhance(e.target.checked)}
              />
              ✨ Enhance
            </label>
            <label className="cursor-pointer rounded-md bg-[#22222D] px-3 py-2 text-xs hover:bg-[#2A2A35]">
              🖼️ Ref
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onRefUpload(f);
                }}
              />
            </label>
            {refImage && (
              <img
                src={refImage.dataUri}
                alt=""
                className="h-8 w-8 rounded object-cover"
              />
            )}
            <SpecularButton
              size="sm"
              radius={10}
              onClick={() => prompt.trim() && applyPrompt(prompt, "text")}
              tint="#22D3EE"
              tintOpacity={0.18}
              textColor="#67e8f9"
              lineColor="#67e8f9"
              baseColor="#0e7490"
            >
              Apply
            </SpecularButton>
            <button
              onClick={undo}
              disabled={!prevApplied}
              className="rounded-md bg-[#22222D] px-3 py-2 text-xs hover:bg-[#2A2A35] disabled:opacity-40"
            >
              Undo
            </button>
            <button
              onClick={clearPrompt}
              className="rounded-md bg-[#22222D] px-3 py-2 text-xs hover:bg-[#2A2A35]"
            >
              Clear
            </button>
          </div>
        )}

        {applied && (
          <p className="mt-2 truncate text-xs text-[#4ADE80]">
            → {applied.text}
          </p>
        )}
      </main>
    </div>
  );
}
