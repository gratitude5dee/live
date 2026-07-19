import SpecularButton from "@/components/reactbits/SpecularButton";
import type { StageViewProps } from "./types";
import type { TemplateKey } from "@/lib/zap/prompt-templates";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";
import { useEffect, useRef, useState } from "react";

function DepthVideo({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    const play = () => el.play().catch(() => {});
    el.addEventListener("loadedmetadata", play);
    play();
    return () => el.removeEventListener("loadedmetadata", play);
  }, [stream]);
  return (
    <video
      ref={ref}
      className="absolute inset-0 z-10 h-full w-full -scale-x-100 object-cover"
      autoPlay
      playsInline
      muted
    />
  );
}



export default function MobileStage(p: StageViewProps) {
  const [showQr, setShowQr] = useState(false);
  const [showPip, setShowPip] = useState(true);

  return (
    <div
      className="relative min-h-[100dvh] bg-black text-white"
      style={{
        fontFamily: "'Geist', 'Plus Jakarta Sans', system-ui, sans-serif",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Full-bleed video */}
      <div className="fixed inset-0 z-0 bg-black">
        <video
          ref={p.attachOutputVideo}
          className="h-full w-full object-cover"
          autoPlay
          playsInline
          muted
        />
        {p.connState !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            <span className="text-[10px] uppercase tracking-[0.24em] text-white/60">
              {p.connState === "connecting"
                ? "Connecting to Lucy"
                : p.connState === "requesting_camera"
                  ? "Requesting camera"
                  : p.connState}
            </span>
          </div>
        )}
      </div>

      {/* Top floating chips */}
      <header
        className="relative z-20 flex items-center justify-between px-4 pt-3"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <div className="flex items-center gap-2">
          <a
            href="https://wzrd.tech"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WZRD.tech"
            className="rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-xl"
          >
            <img src={wzrdLogo.url} alt="WZRD" className="h-4 w-auto" />
          </a>
          {p.perfMode && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/15 px-2 py-1 text-[9px] uppercase tracking-widest text-amber-200 backdrop-blur-xl">
              perf
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {p.remainingMs !== null && (
            <span className="rounded-full border border-white/10 bg-black/60 px-2.5 py-1 font-mono text-[11px] tabular-nums text-white/80 backdrop-blur-xl">
              {Math.floor(p.remainingMs / 1000 / 60)}:
              {String(Math.floor((p.remainingMs / 1000) % 60)).padStart(2, "0")}
            </span>
          )}
          <button
            onClick={p.flipCamera}
            disabled={p.flipping}
            aria-label={`Flip camera (currently ${p.facingMode === "user" ? "front" : "back"})`}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/80 backdrop-blur-xl active:scale-95 disabled:opacity-50"
          >
            {p.flipping ? (
              <span className="inline-block h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white/80" />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/>
                <path d="m13 5 3-3 3 3"/>
                <path d="M16 2v6"/>
                <path d="M13 19h7a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1"/>
                <path d="m11 19-3 3-3-3"/>
                <path d="M8 22v-6"/>
              </svg>
            )}
            <span>{p.facingMode === "user" ? "Front" : "Back"}</span>
          </button>
          {p.voiceAvailable && (
            <button
              onClick={p.toggleVoice}
              aria-label="Toggle Computah voice"
              className={`grid h-8 w-8 place-items-center rounded-full border backdrop-blur-xl active:scale-95 ${
                p.voiceState === "armed"
                  ? "border-emerald-300/50 bg-emerald-400/20 text-emerald-100"
                  : p.voiceState === "connecting"
                    ? "border-amber-300/40 bg-amber-300/20 text-amber-100"
                    : p.voiceState === "thinking"
                      ? "border-cyan-300/50 bg-cyan-400/20 text-cyan-100"
                      : p.voiceState === "error"
                        ? "border-red-400/50 bg-red-400/20 text-red-100"
                        : "border-white/10 bg-black/60 text-white/70"
              }`}
              title={
                p.voiceState === "off"
                  ? 'Turn on Computah voice — say "Computah" then your edit'
                  : "Turn off Computah"
              }
            >
              🎙
            </button>
          )}
          <button
            onClick={() => setShowQr((v) => !v)}
            aria-label="Show remote QR"
            className={`grid h-8 w-8 place-items-center rounded-full border border-white/10 backdrop-blur-xl active:scale-95 ${showQr ? "bg-cyan-400/20" : "bg-black/60"}`}
          >
            ⌘
          </button>
          <button
            onClick={() => p.stopSession("manual")}
            aria-label="Disconnect"
            className="grid h-8 w-8 place-items-center rounded-full border border-red-400/40 bg-red-400/20 text-sm backdrop-blur-xl active:scale-95"
          >
            ✕
          </button>
        </div>
      </header>

      {/* PiP mini feed (keep mounted so inference runs) */}
      <div
        className={`fixed left-3 z-20 h-32 w-24 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl transition ${
          showPip ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}
        onClick={() => setShowPip(false)}
      >
        <video
          ref={p.attachInputVideo}
          className={`h-full w-full -scale-x-100 object-cover ${
            p.depthOn && p.depthStream ? "invisible" : ""
          }`}
          autoPlay
          playsInline
          muted
        />
        {p.depthOn && p.depthStream && <DepthVideo stream={p.depthStream} />}
        <canvas
          ref={p.overlayRef as React.RefObject<HTMLCanvasElement>}
          className={`pointer-events-none absolute inset-0 z-20 h-full w-full -scale-x-100 ${
            p.depthOn ? "hidden" : ""
          }`}
        />
        {/* Source badge */}
        <div className="absolute left-1 top-1 z-30 rounded-full bg-black/70 px-1.5 py-0.5 text-[8px] uppercase tracking-widest backdrop-blur-xl">
          <span className={
            p.activeSource === "depth" ? "text-cyan-300"
            : p.activeSource === "composite" ? "text-fuchsia-300"
            : "text-emerald-300"
          }>●</span>
          <span className="ml-1 text-white/70">{p.activeSource}</span>
        </div>
        <div className="absolute right-1 top-1 z-30 flex flex-col gap-1">
          {p.landmarksAvailable && !p.depthOn && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                p.toggleBakeLandmarks();
              }}
              title="Bake landmarks into feed"
              className={`rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-widest backdrop-blur-xl ${
                p.bakeLandmarks ? "bg-fuchsia-400/30 text-fuchsia-100" : "bg-black/60 text-white/80"
              }`}
            >
              {p.bakeLandmarks ? "L·on" : "L"}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              p.toggleDepth();
            }}
            disabled={!p.depthAvailable || p.depthLoading}
            title={p.depthAvailable ? "Toggle depth" : "WebGPU required — try Chrome/Edge desktop"}
            className={`rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-widest backdrop-blur-xl disabled:opacity-40 ${
              p.depthOn ? "bg-cyan-400/30 text-cyan-100" : "bg-black/60 text-white/80"
            }`}
          >
            {p.depthLoading
              ? `${p.depthProgress}%`
              : p.depthOn
                ? "on"
                : p.depthAvailable
                  ? "D"
                  : "n/a"}
          </button>
        </div>
        {!p.facePresent && (
          <div className="absolute inset-x-0 bottom-0 bg-black/70 py-0.5 text-center text-[9px] text-amber-300">
            Step in
          </div>
        )}
      </div>
      {!showPip && (
        <button
          onClick={() => setShowPip(true)}
          className="fixed left-3 z-20 rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] backdrop-blur-xl"
          style={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}
        >
          Show cam
        </button>
      )}

      {/* Applied prompt caption */}
      {p.applied && (
        <div className="pointer-events-none fixed inset-x-0 z-10 flex justify-center px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 11rem)" }}
        >
          <div className="max-w-[85%] rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-center text-[11px] text-emerald-200 backdrop-blur-xl">
            → {p.applied.text}
          </div>
        </div>
      )}

      {/* Computah HUD */}
      {p.voiceState !== "off" && (
        <div
          className="pointer-events-none fixed inset-x-0 z-10 flex flex-col items-center gap-1 px-4"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 13.5rem)" }}
        >
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/80 backdrop-blur-xl">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                p.voiceState === "armed"
                  ? "animate-pulse bg-emerald-300"
                  : p.voiceState === "thinking"
                    ? "animate-pulse bg-cyan-300"
                    : p.voiceState === "connecting"
                      ? "animate-pulse bg-amber-300"
                      : "bg-red-400"
              }`}
            />
            <span>Computah · {p.voiceState}</span>
            {p.voiceAck && <span className="text-emerald-200">"{p.voiceAck}"</span>}
            {p.voiceIntentLabel && (
              <span className="text-cyan-200">{p.voiceIntentLabel}</span>
            )}
          </div>
          {p.voiceTranscript && (
            <div className="max-w-[85%] truncate rounded-full border border-white/10 bg-black/60 px-2.5 py-1 text-[10px] text-white/70 backdrop-blur-xl">
              "{p.voiceTranscript}"
            </div>
          )}
        </div>
      )}


      {/* QR sheet */}
      {showQr && p.qrDataUrl && (
        <div
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-xl"
          onClick={() => setShowQr(false)}
        >
          <div className="rounded-3xl border border-white/10 bg-black/80 p-6 text-center">
            <div className="rounded-2xl bg-white p-2">
              <img src={p.qrDataUrl} alt="Remote QR" className="h-56 w-56" />
            </div>
            <p className="mt-3 text-[11px] text-white/60">Scan to control from another device</p>
          </div>
        </div>
      )}

      {/* Bottom stack: preset rail + prompt dock */}
      <div
        className="fixed inset-x-0 bottom-0 z-20"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Recording / Download row */}
        <div className="flex items-center justify-between px-4 pb-2">
          {p.connState === "live" ? (
            <SpecularButton
              size="sm"
              radius={999}
              onClick={p.toggleRecord}
              tint="#F87171"
              tintOpacity={p.recording ? 0.85 : 0.15}
              textColor={p.recording ? "#0a0a0f" : "#fca5a5"}
              lineColor="#fca5a5"
              baseColor="#7f1d1d"
            >
              {p.recording ? "■ Stop" : "⬤ Record"}
            </SpecularButton>
          ) : <span />}
          {p.download && (
            <a
              href={p.download.url}
              download={p.download.filename}
              className="rounded-full border border-emerald-400/40 bg-emerald-400/20 px-4 py-1.5 text-[11px] font-medium text-emerald-100"
            >
              ⬇ Download
            </a>
          )}
        </div>

        {/* Preset rail */}
        <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-2 scrollbar-none">
          {p.presets.map((preset) => (
            <MobilePresetTile
              key={preset.id}
              preset={preset}
              refImage={p.refImage}
              onApply={() => p.applyPreset(preset)}
              onTemplate={(k, n) => p.openTemplate(k, n)}
            />
          ))}
        </div>

        {/* Prompt dock */}
        <div className="px-3 pb-3">
          <div className="rounded-3xl border border-white/10 bg-black/70 p-1.5 backdrop-blur-xl">
            <div className="flex items-center gap-2 rounded-[calc(1.5rem-0.375rem)] bg-white/[0.04] p-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
              <input
                value={p.prompt}
                onChange={(e) => p.setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && p.prompt.trim()) p.applyPrompt(p.prompt, "text");
                }}
                placeholder="Describe an edit…"
                className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-white/25"
              />
              <input
                id="ref-file-mobile"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) p.onRefUpload(f);
                  e.currentTarget.value = "";
                }}
              />
              {p.refImage ? (
                <div className="flex items-center gap-1">
                  <div className="relative">
                    <label
                      htmlFor="ref-file-mobile"
                      className={`block cursor-pointer overflow-hidden rounded-lg ring-1 ${
                        p.refImagePending
                          ? "ring-cyan-300/80 shadow-[0_0_0_2px_rgba(34,211,238,0.25)] animate-pulse"
                          : "ring-white/10"
                      }`}
                    >
                      <img
                        src={p.refImage.dataUri}
                        alt="reference"
                        className="h-8 w-8 object-cover"
                      />
                    </label>
                    <button
                      onClick={p.clearRefImage}
                      aria-label="Remove reference"
                      className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full border border-white/20 bg-black/80 text-[10px] leading-none text-white/80"
                    >
                      ×
                    </button>
                  </div>
                  {p.refImagePending && (
                    <button
                      onClick={p.applyRefImage}
                      className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2 py-1 text-[10px] font-medium text-cyan-100"
                    >
                      Apply
                    </button>
                  )}
                </div>
              ) : (
                <label
                  htmlFor="ref-file-mobile"
                  className="cursor-pointer rounded-full border border-white/10 px-2.5 py-1.5 text-[11px]"
                >
                  🖼️
                </label>
              )}
              <SpecularButton
                size="sm"
                radius={999}
                onClick={() => p.prompt.trim() && p.applyPrompt(p.prompt, "text")}
                tint="#22D3EE"
                tintOpacity={0.22}
                textColor="#a5f3fc"
                lineColor="#67e8f9"
                baseColor="#0e7490"
              >
                Send
              </SpecularButton>
            </div>
          </div>
        </div>
      </div>

      {p.error && (
        <div
          className="fixed inset-x-4 z-40 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-200 backdrop-blur-xl"
          style={{ top: "calc(env(safe-area-inset-top) + 3.5rem)" }}
        >
          {p.error}
        </div>
      )}
    </div>
  );
}

function MobilePresetTile({
  preset,
  refImage,
  onApply,
  onTemplate,
}: {
  preset: StageViewProps["presets"][number];
  refImage: StageViewProps["refImage"];
  onApply: () => void;
  onTemplate: (k: TemplateKey, n: string) => void;
}) {
  const kind = (preset as unknown as { kind?: string }).kind ?? "preset";
  const templateKey = (preset as unknown as { template_key?: TemplateKey }).template_key;
  const isTemplate = kind === "template" && !!templateKey;
  const disabled = !isTemplate && preset.requires_ref && !preset.ref_image_url && !refImage;

  return (
    <button
      onClick={() => (isTemplate && templateKey ? onTemplate(templateKey, preset.name) : onApply())}
      disabled={disabled}
      className={`relative flex h-16 w-16 shrink-0 snap-start flex-col items-center justify-center overflow-hidden rounded-2xl border backdrop-blur-xl transition disabled:opacity-30 active:scale-95 ${
        isTemplate
          ? "border-dashed border-fuchsia-400/60 bg-black/60"
          : "border-white/10 bg-black/60"
      }`}
      title={preset.name}
    >
      {preset.thumbnail_url ? (
        <img src={preset.thumbnail_url} alt={preset.name} className="absolute inset-0 h-full w-full object-cover opacity-80" />
      ) : null}
      <span className="relative z-10 rounded-full bg-black/60 px-1.5 text-lg leading-none">
        {preset.emoji}
      </span>
      <span className="relative z-10 mt-0.5 max-w-[3.5rem] truncate text-[9px] text-white/80">
        {preset.name}
      </span>
    </button>
  );
}
