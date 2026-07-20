import SpecularButton from "@/components/reactbits/SpecularButton";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import type { StageViewProps } from "./types";
import type { TemplateKey } from "@/lib/zap/prompt-templates";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";

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



export default function DesktopStage(p: StageViewProps) {
  const statusColor =
    p.connState === "live"
      ? "bg-emerald-400"
      : p.connState === "failed"
        ? "bg-red-500"
        : "bg-amber-400";

  return (
    <div
      className="relative min-h-[100dvh] w-screen overflow-hidden bg-[#07070B] text-[#FAFAFA]"
      style={{ fontFamily: "'Geist', 'Plus Jakarta Sans', system-ui, sans-serif" }}
    >
      {/* Full-bleed Lucy output */}
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
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
            <span className="text-[11px] uppercase tracking-[0.24em] text-white/60">
              {p.connState === "connecting"
                ? "Connecting to Lucy"
                : p.connState === "requesting_camera"
                  ? "Requesting camera"
                  : p.connState}
            </span>
          </div>
        )}
      </div>

      {/* Vignette / gradient overlay for HUD legibility */}
      <div className="pointer-events-none fixed inset-0 z-10 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.55)_100%)]" />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-10 h-40 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-t from-black/80 to-transparent" />

      {/* Top bar */}
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-4">
          <a
            href="https://wzrd.tech"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WZRD.tech"
          >
            <img src={wzrdLogo.url} alt="WZRD" className="h-8 w-auto opacity-90 transition hover:opacity-100" />
          </a>
          <div className="ml-2 flex items-center gap-2 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 text-[11px] backdrop-blur-xl">
            <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
            <span className="uppercase tracking-[0.14em] text-white/70">{p.connState}</span>
            {p.transport && <span className="text-white/40">· {p.transport}</span>}
          </div>
          {p.perfMode && <Chip tone="amber">Performance mode</Chip>}
          {!p.facePresent && p.connState === "live" && (
            <Chip tone="amber">Step into frame</Chip>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/library"
            className="rounded-full border border-white/10 bg-black/50 px-3.5 py-1.5 text-xs text-white/80 backdrop-blur-xl transition hover:bg-white/10"
          >
            Library
          </Link>
          {p.remainingMs !== null && (
            <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1.5 font-mono text-xs tabular-nums text-white/80 backdrop-blur-xl">
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
              className="rounded-full border border-emerald-400/40 bg-emerald-400/20 px-4 py-1.5 text-xs font-medium text-emerald-100 backdrop-blur-xl transition hover:bg-emerald-400/30"
            >
              ⬇ Download take
            </a>
          )}
          <button
            onClick={() => p.stopSession("manual")}
            className="rounded-full border border-red-400/40 bg-red-400/20 px-4 py-1.5 text-xs font-medium text-red-100 backdrop-blur-xl transition hover:bg-red-400/30"
          >
            Disconnect
          </button>
        </div>
      </header>

      {p.error && (
        <div className="fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-xl border border-red-500/40 bg-red-500/20 px-4 py-2 text-sm text-red-100 backdrop-blur-xl">
          {p.error}
        </div>
      )}

      {p.voiceState !== "off" && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-20 flex -translate-x-1/2 flex-col items-center gap-1">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[11px] uppercase tracking-widest text-white/80 backdrop-blur-xl">
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
              <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-cyan-200">
                {p.voiceIntentLabel}
              </span>
            )}
          </div>
          {p.voiceTranscript && (
            <div className="max-w-[60ch] truncate rounded-full border border-white/10 bg-black/60 px-3 py-1 text-[11px] text-white/70 backdrop-blur-xl">
              "{p.voiceTranscript}"
            </div>
          )}
        </div>
      )}


      {/* Left rail: presets */}
      <aside className="fixed left-6 top-24 bottom-32 z-20 flex w-[240px] flex-col rounded-[2rem] border border-white/10 bg-black/50 p-1.5 backdrop-blur-2xl">
        <div className="flex min-h-0 flex-1 flex-col rounded-[calc(2rem-0.375rem)] bg-black/40 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
          <div className="mb-2 flex items-center justify-between px-1">
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
          <div className="-mr-2 flex flex-1 flex-col gap-1 overflow-y-auto pr-2 pb-2">
            {(() => {
              type P = (typeof p.presets)[number] & { kind?: string; template_key?: string | null };
              const all = p.presets as P[];
              const templates = all.filter((x) => x.kind === "template" && x.template_key !== "character_swap");
              const swaps = all.filter((x) => x.template_key === "character_swap");
              const gestureFx = all.filter((x) => x.template_key === "gesture_fx");
              const looks = all.filter(
                (x) =>
                  x.kind !== "template" &&
                  x.template_key !== "character_swap" &&
                  x.template_key !== "gesture_fx",
              );
              const groups: { label: string; tone: string; items: P[] }[] = [
                { label: "Templates", tone: "text-fuchsia-300/50", items: templates },
                { label: "Character Swap", tone: "text-cyan-300/60", items: swaps },
                { label: "Gesture FX", tone: "text-amber-300/60", items: gestureFx },
                { label: "Looks", tone: "text-white/30", items: looks },
              ].filter((g) => g.items.length > 0);
              return (
                <>
                  {groups.map((g, gi) => (
                    <div key={g.label}>
                      <div className={`${gi === 0 ? "mt-1" : "mt-3"} mb-1 px-1 text-[9px] uppercase tracking-[0.22em] ${g.tone}`}>
                        {g.label}
                      </div>
                      {g.items.map((preset) => (
                        <PresetRow
                          key={preset.id}
                          preset={preset}
                          index={p.presets.indexOf(preset)}
                          refImage={p.refImage}
                          onApply={() => p.applyPreset(preset)}
                          onTemplate={(k, n) => p.openTemplate(k, n)}
                        />
                      ))}
                    </div>
                  ))}
                </>
              );
            })()}
          </div>
        </div>
      </aside>


      {/* Right HUD stack */}
      <aside className="fixed right-6 top-24 z-20 flex w-[300px] flex-col gap-3">
        <HudCard label="Camera">
          <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-black">
            <video
              ref={p.attachInputVideo}
              className={`h-full w-full -scale-x-100 object-cover ${
                p.depthOn && p.depthStream ? "invisible" : ""
              }`}
              autoPlay
              playsInline
              muted
            />
            {/* Depth preview — same feed sent to Lucy when Depth is on */}
            {p.depthOn && p.depthStream && (
              <DepthVideo stream={p.depthStream} />
            )}
            <canvas
              ref={p.overlayRef as React.RefObject<HTMLCanvasElement>}
              className={`pointer-events-none absolute inset-0 z-20 h-full w-full -scale-x-100 ${
                p.depthOn ? "hidden" : ""
              }`}
            />

            {/* Source badge — what Lucy is currently receiving */}
            <div className="absolute left-2 top-2 z-30 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white/70 backdrop-blur-xl">
              <span className={
                p.activeSource === "depth" ? "text-cyan-200"
                : p.activeSource === "composite" ? "text-fuchsia-200"
                : "text-emerald-200"
              }>●</span>{" "}
              {p.activeSource}
            </div>
            <div className="absolute right-2 top-2 z-30 flex gap-1.5">
              {p.landmarksAvailable && !p.depthOn && (
                <button
                  onClick={p.toggleBakeLandmarks}
                  title="Bake MediaPipe landmarks into the Lucy feed (softens quality)"
                  className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur-xl transition ${
                    p.bakeLandmarks
                      ? "border-fuchsia-300/60 bg-fuchsia-400/25 text-fuchsia-100"
                      : "border-white/15 bg-black/60 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {p.bakeLandmarks ? "Landmarks · on" : "Landmarks"}
                </button>
              )}
              <button
                onClick={p.toggleDepth}
                disabled={!p.depthAvailable || p.depthLoading}
                title={p.depthAvailable ? "Toggle WebGPU depth stream to Lucy" : "WebGPU required — open in Chrome/Edge desktop"}
                className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] backdrop-blur-xl transition disabled:opacity-40 ${
                  p.depthOn
                    ? "border-cyan-300/60 bg-cyan-400/25 text-cyan-100"
                    : "border-white/15 bg-black/60 text-white/70 hover:bg-white/10"
                }`}
              >
                {p.depthLoading
                  ? `Depth ${p.depthProgress}%`
                  : p.depthOn
                    ? "Depth · on"
                    : p.depthAvailable
                      ? "Depth"
                      : "Depth · n/a"}
              </button>
            </div>
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
                <img src={p.qrDataUrl} alt="Remote QR" className="h-20 w-20" />
              </div>
              <p className="text-[11px] leading-snug text-white/60">
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

      {p.applied && (
        <div className="pointer-events-none fixed inset-x-0 bottom-28 z-20 flex justify-center px-8">
          <p className="max-w-2xl rounded-full border border-white/10 bg-black/60 px-4 py-2 text-center text-xs text-emerald-200/90 backdrop-blur-xl line-clamp-2">
            → {p.applied.text}
          </p>
        </div>
      )}

      {/* Prompt dock */}
      <footer className="fixed inset-x-0 bottom-0 z-20 px-8 pb-6 pt-2">
        <div className="mx-auto max-w-4xl rounded-[1.75rem] border border-white/10 bg-black/60 p-1.5 backdrop-blur-2xl">
          <div className="flex flex-wrap items-center gap-2 rounded-[calc(1.75rem-0.375rem)] bg-black/40 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06)]">
            {p.voiceAvailable && (
              <button
                onClick={p.toggleVoice}
                title={
                  p.voiceState === "off"
                    ? 'Computah voice — say "Computah" then your edit'
                    : "Turn off Computah"
                }
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-medium backdrop-blur-xl transition ${
                  p.voiceState === "armed"
                    ? "border-emerald-300/50 bg-emerald-400/20 text-emerald-100 hover:bg-emerald-400/30"
                    : p.voiceState === "connecting"
                      ? "border-amber-300/40 bg-amber-300/20 text-amber-100"
                      : p.voiceState === "thinking"
                        ? "border-cyan-300/50 bg-cyan-400/20 text-cyan-100"
                        : p.voiceState === "error"
                          ? "border-red-400/50 bg-red-400/20 text-red-100"
                          : "border-white/10 bg-black/50 text-white/70 hover:bg-white/10"
                }`}
              >
                <span
                  className={
                    p.voiceState === "armed" || p.voiceState === "thinking" || p.voiceState === "connecting"
                      ? "inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                      : "inline-block h-1.5 w-1.5 rounded-full bg-current opacity-40"
                  }
                />
                🎙 Computah
              </button>
            )}
            <input
              value={p.prompt}
              onChange={(e) => p.setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && p.prompt.trim()) p.applyPrompt(p.prompt, "text");
              }}
              placeholder="Describe an edit… (e.g. change background to snowy mountain)"
              className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-white/25"
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
            <input
              id="ref-file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) p.onRefUpload(f);
                e.currentTarget.value = "";
              }}
            />
            {p.refImage ? (
              <div className="flex items-center gap-1.5">
                <div className="group relative">
                  <label
                    htmlFor="ref-file"
                    title="Click to replace reference image"
                    className={`block cursor-pointer overflow-hidden rounded-lg ring-1 transition ${
                      p.refImagePending
                        ? "ring-cyan-300/80 shadow-[0_0_0_2px_rgba(34,211,238,0.25)] animate-pulse"
                        : "ring-white/10 hover:ring-cyan-300/60"
                    }`}
                  >
                    <img
                      src={p.refImage.url ?? p.refImage.dataUri}
                      alt="reference"
                      className="h-8 w-8 object-cover"
                    />
                  </label>
                  <button
                    onClick={p.clearRefImage}
                    title="Remove reference image"
                    aria-label="Remove reference image"
                    className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full border border-white/20 bg-black/80 text-[10px] leading-none text-white/80 shadow-md transition hover:bg-red-500/80 hover:text-white"
                  >
                    ×
                  </button>
                </div>
                {p.refImagePending && (
                  <button
                    onClick={p.applyRefImage}
                    title="Send reference image + prompt to Lucy"
                    className="rounded-full border border-cyan-300/40 bg-cyan-300/10 px-2.5 py-1 text-[11px] font-medium text-cyan-100 transition hover:bg-cyan-300/20"
                  >
                    Apply
                  </button>
                )}
              </div>
            ) : (
              <label
                htmlFor="ref-file"
                className="cursor-pointer rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/70 hover:bg-white/[0.06]"
              >
                🖼️ Ref
              </label>
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
      className={`group flex h-11 w-full shrink-0 items-center gap-2.5 rounded-xl border pl-1 pr-2.5 text-left transition disabled:opacity-30 ${
        isTemplate
          ? "border-dashed border-fuchsia-400/40 hover:border-fuchsia-400/80 hover:bg-fuchsia-400/[0.04]"
          : "border-white/10 hover:border-cyan-300/40 hover:bg-white/[0.04]"
      }`}
      title={`${preset.name}${index < 9 ? ` (⌘${index + 1})` : ""}`}
    >
      {preset.thumbnail_url ? (
        <img
          src={preset.thumbnail_url}
          alt=""
          className="h-9 w-9 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-base leading-none">
          {preset.emoji}
        </div>
      )}
      <span className="min-w-0 flex-1 truncate text-[13px] leading-none text-white/85">
        {preset.name}
      </span>
      <span
        className={`shrink-0 text-[10px] tabular-nums ${
          isTemplate ? "text-fuchsia-300/70" : "text-white/30"
        }`}
      >
        {isTemplate ? "＋img" : index < 9 ? `⌘${index + 1}` : ""}
      </span>
    </button>
  );
}

