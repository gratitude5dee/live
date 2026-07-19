import SpecularButton from "@/components/reactbits/SpecularButton";
import type { StageViewProps } from "./types";
import type { TemplateKey } from "@/lib/zap/prompt-templates";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";
import { useState } from "react";

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
          <div className="rounded-full border border-white/10 bg-black/60 px-2.5 py-1 backdrop-blur-xl">
            <img src={wzrdLogo.url} alt="WZRD" className="h-4 w-auto" />
          </div>
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
            aria-label="Flip camera"
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/60 text-sm backdrop-blur-xl active:scale-95"
          >
            ⇋
          </button>
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
        className={`fixed left-3 z-20 h-28 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl transition ${
          showPip ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ top: "calc(env(safe-area-inset-top) + 4rem)" }}
        onClick={() => setShowPip(false)}
      >
        <video
          ref={p.attachInputVideo}
          className="h-full w-full -scale-x-100 object-cover"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={p.overlayRef as React.RefObject<HTMLCanvasElement>}
          className="pointer-events-none absolute inset-0 h-full w-full -scale-x-100"
        />
        {!p.facePresent && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-center text-[9px] text-amber-300">
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
              <label className="cursor-pointer rounded-full border border-white/10 px-2.5 py-1.5 text-[11px]">
                🖼️
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) p.onRefUpload(f);
                  }}
                />
              </label>
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
