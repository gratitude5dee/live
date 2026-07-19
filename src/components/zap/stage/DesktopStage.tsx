import SpecularButton from "@/components/reactbits/SpecularButton";
import { Link } from "@tanstack/react-router";
import type { StageViewProps } from "./types";
import type { TemplateKey } from "@/lib/zap/prompt-templates";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";

export default function DesktopStage(p: StageViewProps) {
  const statusColor =
    p.connState === "live"
      ? "bg-emerald-400"
      : p.connState === "failed"
        ? "bg-red-500"
        : "bg-amber-400";

  return (
    <div
      className="grid min-h-[100dvh] grid-rows-[auto_1fr_auto] bg-[#07070B] text-[#FAFAFA]"
      style={{ fontFamily: "'Geist', 'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4">
          <img src={wzrdLogo.url} alt="WZRD" className="h-8 w-auto opacity-90" />
          <div className="ml-2 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] backdrop-blur-xl">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
            <span className="uppercase tracking-[0.14em] text-white/60">{p.connState}</span>
            {p.transport && <span className="text-white/30">· {p.transport}</span>}
          </div>
          {p.perfMode && (
            <Chip tone="amber">Performance mode</Chip>
          )}
          {!p.facePresent && p.connState === "live" && (
            <Chip tone="amber">Step into frame</Chip>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/library"
            className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-xs text-white/70 transition hover:bg-white/[0.06]"
          >
            Library
          </Link>
          {p.remainingMs !== null && (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-xs tabular-nums text-white/70">
              {Math.floor(p.remainingMs / 1000 / 60)}:
              {String(Math.floor((p.remainingMs / 1000) % 60)).padStart(2, "0")}
            </span>
          )}
          {p.connState === "live" && (
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
          )}
          {p.download && (
            <a
              href={p.download.url}
              download={p.download.filename}
              className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/20"
            >
              ⬇ Download take
            </a>
          )}
          <button
            onClick={() => p.stopSession("manual")}
            className="rounded-full border border-red-400/40 bg-red-400/10 px-4 py-1.5 text-xs font-medium text-red-200 transition hover:bg-red-400/20"
          >
            Disconnect
          </button>
        </div>
      </header>

      {p.error && (
        <div className="mx-8 mb-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">
          {p.error}
        </div>
      )}

      {/* 3-zone cockpit */}
      <main className="grid min-h-0 grid-cols-[280px_minmax(0,1fr)_320px] gap-6 px-8 pb-4">
        {/* Left rail: presets */}
        <aside className="flex min-h-0 flex-col rounded-[2rem] border border-white/10 bg-white/[0.02] p-1.5">
          <div className="flex min-h-0 flex-col rounded-[calc(2rem-0.375rem)] bg-black/40 p-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.22em] text-white/40">
                Presets
              </span>
              {p.applied && (
                <button
                  onClick={p.savePreset}
                  className="text-[10px] uppercase tracking-widest text-white/40 hover:text-white/80"
                >
                  ＋ Save
                </button>
              )}
            </div>
            <div className="-mr-2 flex flex-1 flex-col gap-2 overflow-y-auto pr-2">
              {p.presets.map((preset, i) => (
                <PresetRow
                  key={preset.id}
                  preset={preset}
                  index={i}
                  refImage={p.refImage}
                  onApply={() => p.applyPreset(preset)}
                  onTemplate={(k, n) => p.openTemplate(k, n)}
                />
              ))}
            </div>
          </div>
        </aside>

        {/* Center: video */}
        <section className="flex min-h-0 items-center justify-center">
          <div className="relative flex h-full max-h-[calc(100dvh-260px)] items-center justify-center">
            <div className="relative aspect-[9/16] h-full rounded-[2rem] border border-white/10 bg-white/[0.03] p-1.5 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)]">
              <div className="relative h-full w-full overflow-hidden rounded-[calc(2rem-0.375rem)] bg-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
                <video
                  ref={p.attachOutputVideo}
                  className="h-full w-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                {p.connState !== "live" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 backdrop-blur-sm">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
                    <span className="text-[11px] uppercase tracking-[0.24em] text-white/60">
                      {p.connState === "connecting"
                        ? "Connecting to Lucy"
                        : p.connState === "requesting_camera"
                          ? "Requesting camera"
                          : p.connState}
                    </span>
                  </div>
                )}
                {p.applied && (
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <p className="line-clamp-2 text-xs text-emerald-200/90">
                      → {p.applied.text}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Right HUD panel */}
        <aside className="flex min-h-0 flex-col gap-4">
          <HudCard label="Camera">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] text-amber-300">
                  Step into frame
                </div>
              )}
            </div>
            {p.liveGesture.label && (
              <div className="mt-2 flex items-center justify-between text-[11px] text-white/60">
                <span>
                  ✋ {p.liveGesture.label}
                  <span className="ml-1 text-white/30">
                    {p.liveGesture.score.toFixed(2)}
                  </span>
                </span>
                {p.liveGesture.hold > 0 && (
                  <div className="ml-3 h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-cyan-300 transition-all"
                      style={{ width: `${p.liveGesture.hold * 100}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </HudCard>

          {p.qrDataUrl && (
            <HudCard label="Phone remote">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white p-1.5">
                  <img src={p.qrDataUrl} alt="Remote QR" className="h-24 w-24" />
                </div>
                <p className="text-[11px] leading-snug text-white/50">
                  Scan to drive this session from your phone.
                </p>
              </div>
            </HudCard>
          )}

          <HudCard label="Session">
            <dl className="grid grid-cols-2 gap-y-1.5 text-[11px]">
              <dt className="text-white/40">Transport</dt>
              <dd className="text-right text-white/80">{p.transport ?? "—"}</dd>
              <dt className="text-white/40">Reactive</dt>
              <dd className="text-right text-white/80">{p.reactiveOn ? "on" : "off"}</dd>
              <dt className="text-white/40">Pending upload</dt>
              <dd className="text-right text-white/80">{p.pendingUpload}</dd>
            </dl>
          </HudCard>
        </aside>
      </main>

      {/* Prompt dock */}
      <footer className="px-8 pb-6 pt-2">
        <div className="rounded-[1.75rem] border border-white/10 bg-white/[0.02] p-1.5 backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-2 rounded-[calc(1.75rem-0.375rem)] bg-black/40 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            <input
              value={p.prompt}
              onChange={(e) => p.setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && p.prompt.trim()) p.applyPrompt(p.prompt, "text");
              }}
              placeholder="Describe an edit… (e.g. change background to snowy mountain)"
              className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/25"
            />
            <label className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/60">
              <input
                type="checkbox"
                checked={p.enhance}
                onChange={(e) => p.setEnhance(e.target.checked)}
                className="accent-cyan-300"
              />
              ✨ Enhance
            </label>
            <label className="cursor-pointer rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.06]">
              🖼️ Ref
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) p.onRefUpload(f);
                }}
              />
            </label>
            {p.refImage && (
              <img
                src={p.refImage.dataUri}
                alt=""
                className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/10"
              />
            )}
            <button
              onClick={p.undo}
              disabled={!p.prevApplied}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70 transition hover:bg-white/[0.06] disabled:opacity-30"
            >
              ⌘Z Undo
            </button>
            <button
              onClick={p.clearPrompt}
              className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70 transition hover:bg-white/[0.06]"
            >
              Clear
            </button>
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
              Apply →
            </SpecularButton>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "amber" | "violet";
}) {
  const cls =
    tone === "amber"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
      : "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-200";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-widest ${cls}`}>
      {children}
    </span>
  );
}

function HudCard({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-1.5">
      <div className="rounded-[calc(1rem-0.125rem)] bg-black/40 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-white/40">
          {label}
        </div>
        {children}
      </div>
    </div>
  );
}

function PresetRow({
  preset,
  index,
  refImage,
  onApply,
  onTemplate,
}: {
  preset: StageViewProps["presets"][number];
  index: number;
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
      className={`group flex items-center gap-3 overflow-hidden rounded-2xl border p-1.5 text-left transition disabled:opacity-30 ${
        isTemplate
          ? "border-dashed border-fuchsia-400/40 hover:border-fuchsia-400/80"
          : "border-white/10 hover:border-cyan-300/50"
      } hover:bg-white/[0.03]`}
      title={`${preset.name}${index < 9 ? ` (${index + 1})` : ""}`}
    >
      {preset.thumbnail_url ? (
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
          <img
            src={preset.thumbnail_url}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        </div>
      ) : (
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.04] text-xl">
          {preset.emoji}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-white/90 truncate">{preset.name}</span>
          {isTemplate && <span className="text-[10px] text-fuchsia-300/80">📥</span>}
        </div>
        <div className="text-[10px] text-white/30">
          {isTemplate ? "drop an image" : index < 9 ? `⌘${index + 1}` : preset.emoji}
        </div>
      </div>
    </button>
  );
}
