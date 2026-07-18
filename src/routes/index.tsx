import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { supabase } from "@/integrations/supabase/client";
import { VideoTransport } from "@/lib/zap/fal-transport";
import { GestureEngine, type GestureAction } from "@/lib/zap/gesture-engine";
import { loadGestureRecognizer } from "@/lib/zap/mediapipe";
import type {
  ConnectionState,
  Preset,
  PromptState,
  RemoteMessage,
} from "@/lib/zap/types";
import type { GestureRecognizer } from "@mediapipe/tasks-vision";
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
  const [transport, setTransport] = useState<"webrtc" | "frame" | null>(null);
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

  const inputVideoRef = useRef<HTMLVideoElement>(null);
  const outputVideoRef = useRef<HTMLVideoElement>(null);
  const inputStreamRef = useRef<MediaStream | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const transportRef = useRef<VideoTransport | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const gestureRef = useRef<GestureRecognizer | null>(null);
  const engineRef = useRef<GestureEngine | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const startedAtRef = useRef<number>(0);
  const userIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const currentPresetIndex = useRef<number>(-1);
  const appliedRef = useRef<PromptState | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // --- Handle a fired gesture ---
  const handleGesture = useCallback(
    async (label: string, action: GestureAction) => {
      const sid = sessionIdRef.current;
      const uid = userIdRef.current;
      if (sid && uid) {
        await supabase.from("vision_events").insert({
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
        default:
          break;
      }
    },
    [prompt, applyPrompt, undo, clearPrompt, presets, refImage, applyPreset],
  );

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

      // Start MediaPipe (best-effort)
      try {
        const rec = await loadGestureRecognizer();
        gestureRef.current = rec;
        const engine = new GestureEngine();
        engine.onFire = (label, action) => {
          handleGesture(label, action);
        };
        engine.onLiveUpdate = (label, score, hold) =>
          setLiveGesture({ label, score, hold });
        engineRef.current = engine;
        runInferenceLoop();
      } catch (e) {
        console.warn("MediaPipe unavailable", e);
      }

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

      // Kick off with a no-op prompt so frame mode has something to send
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

  // --- MediaPipe inference loop ---
  const runInferenceLoop = useCallback(() => {
    let frame = 0;
    const loop = () => {
      if (!gestureRef.current || !inputVideoRef.current || !engineRef.current) {
        requestAnimationFrame(loop);
        return;
      }
      frame++;
      if (frame % 2 === 0 && inputVideoRef.current.readyState >= 2) {
        try {
          const result = gestureRef.current.recognizeForVideo(
            inputVideoRef.current,
            performance.now(),
          );
          engineRef.current.ingest(result);
        } catch (e) {
          console.warn("gesture inference error", e);
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
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

      const { error: upErr } = await supabase.storage
        .from(bucket)
        .upload(path, blob, { upsert: false });
      if (upErr) {
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

  // --- Cleanup ---
  useEffect(() => {
    const beforeUnload = async () => {
      if (sessionIdRef.current) {
        await supabase
          .from("sessions")
          .update({ ended_at: new Date().toISOString() })
          .eq("id", sessionIdRef.current);
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      transportRef.current?.close();
      recorderRef.current?.stop();
      gestureRef.current?.close();
      inputStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      beforeUnload();
    };
  }, []);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.code === "Space") {
        e.preventDefault();
        if (prompt.trim()) applyPrompt(prompt, "text");
      } else if (e.key === "r" || e.key === "R") {
        toggleRecord();
      } else if (e.key === "v" || e.key === "V") {
        undo();
      } else if (/^[0-9]$/.test(e.key)) {
        const idx = e.key === "0" ? 9 : parseInt(e.key, 10) - 1;
        const p = presets[idx];
        if (p) applyPreset(p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prompt, presets, applyPrompt, applyPreset, toggleRecord]);

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
          {liveGesture.label && (
            <span className="rounded-full bg-[#16161D] px-2.5 py-1 text-xs text-[#E879F9]">
              {liveGesture.label} {liveGesture.score.toFixed(2)}
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
            <button
              onClick={toggleRecord}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                recording
                  ? "bg-[#F87171] text-black"
                  : "bg-[#F87171]/20 text-[#F87171] hover:bg-[#F87171]/30"
              }`}
            >
              {recording ? "■ Stop" : "⬤ Record"}
            </button>
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
        {connState === "idle" && (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 rounded-2xl border border-[#2A2A35] bg-gradient-to-br from-[#16161D] to-[#0A0A0F] p-12 text-center">
            <h1 className="bg-gradient-to-r from-[#22D3EE] to-[#E879F9] bg-clip-text text-5xl font-bold text-transparent">
              Your webcam is the timeline.
            </h1>
            <p className="max-w-md text-[#9CA3AF]">
              Edit the live feed with prompts, presets, and hand gestures. Lucy 2.5
              repaints every frame in under a second.
            </p>
            <button
              onClick={startSession}
              disabled={!authReady}
              className="rounded-xl bg-[#22D3EE] px-6 py-3 font-semibold text-black transition hover:bg-[#67E8F9] disabled:opacity-50"
            >
              {authReady ? "Enable Camera" : "Loading…"}
            </button>
          </div>
        )}

        {connState !== "idle" && (
          <div className="relative aspect-video overflow-hidden rounded-2xl border border-[#2A2A35] bg-black">
            <video
              ref={outputVideoRef}
              className="h-full w-full object-cover"
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

            {/* PiP */}
            <div className="absolute right-3 top-3 h-36 w-64 overflow-hidden rounded-lg border border-[#2A2A35] bg-black shadow-lg">
              <video
                ref={inputVideoRef}
                className="h-full w-full -scale-x-100 object-cover"
                playsInline
                muted
              />
              {liveGesture.label && liveGesture.hold > 0 && (
                <div
                  className="absolute inset-x-0 bottom-0 h-1 bg-[#22D3EE]"
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
        {connState !== "idle" && (
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
        {connState !== "idle" && (
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
            <button
              onClick={() => prompt.trim() && applyPrompt(prompt, "text")}
              className="rounded-md bg-[#22D3EE] px-4 py-2 text-xs font-semibold text-black hover:bg-[#67E8F9]"
            >
              Apply
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
