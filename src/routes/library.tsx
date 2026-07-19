import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadZip } from "client-zip";
import { supabase } from "@/integrations/supabase/client";
import type { TakeRow } from "@/lib/zap/types";
import LiquidEther from "@/components/reactbits/LiquidEther";
import ShinyText from "@/components/reactbits/ShinyText";
import GlassSurface from "@/components/reactbits/GlassSurface";
import SiteFooter from "@/components/zap/SiteFooter";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — Library" },
      { name: "description", content: "Your recorded takes and snapshots." },
    ],
  }),
  component: LibraryPage,
});

type TakeWithUrl = TakeRow & { url?: string };
type Filter = "all" | "video" | "image";
type ViewMode = "feed" | "grid" | "list";

function fmtBytes(n?: number | null) {
  if (!n && n !== 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDur(ms?: number | null) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function filenameFor(t: TakeRow) {
  const stamp = new Date(t.created_at).toISOString().replace(/[:.]/g, "-");
  const ext = t.kind === "video" ? "webm" : "png";
  return `zap-${stamp}.${ext}`;
}

function LibraryPage() {
  const [takes, setTakes] = useState<TakeWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    const saved = localStorage.getItem("zap.library.view") as ViewMode | null;
    if (saved) return saved;
    return window.matchMedia("(max-width: 768px)").matches ? "feed" : "grid";
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("zap.library.view", view);
  }, [view]);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) await supabase.auth.signInAnonymously();
      const { data } = await supabase
        .from("takes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120);
      if (!data) {
        setLoading(false);
        return;
      }
      const withUrls = await Promise.all(
        data.map(async (t) => {
          const { data: signed } = await supabase.storage
            .from("takes")
            .createSignedUrl(t.storage_path, 3600);
          return { ...t, url: signed?.signedUrl };
        }),
      );
      setTakes(withUrls);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? takes : takes.filter((t) => t.kind === filter)),
    [takes, filter],
  );

  const counts = useMemo(
    () => ({
      all: takes.length,
      video: takes.filter((t) => t.kind === "video").length,
      image: takes.filter((t) => t.kind === "image").length,
    }),
    [takes],
  );

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(filtered.map((t) => t.id)));
  }, [filtered]);

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const selectedTakes = useMemo(
    () => takes.filter((t) => selected.has(t.id) && t.url),
    [takes, selected],
  );

  const bulkDelete = useCallback(async () => {
    if (!confirm(`Delete ${selected.size} take${selected.size > 1 ? "s" : ""}?`)) return;
    const ids = Array.from(selected);
    const paths = takes.filter((t) => selected.has(t.id)).map((t) => t.storage_path);
    await supabase.storage.from("takes").remove(paths);
    await supabase.from("takes").delete().in("id", ids);
    setTakes((prev) => prev.filter((t) => !selected.has(t.id)));
    clearSelection();
  }, [selected, takes, clearSelection]);

  const bulkDownloadSequential = useCallback(async () => {
    for (const t of selectedTakes) {
      const a = document.createElement("a");
      a.href = t.url!;
      a.download = filenameFor(t);
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 200));
    }
  }, [selectedTakes]);

  const bulkDownloadZip = useCallback(async () => {
    const entries = await Promise.all(
      selectedTakes.map(async (t) => ({
        name: filenameFor(t),
        input: await fetch(t.url!),
      })),
    );
    const blob = await downloadZip(entries).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zap-library-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [selectedTakes]);

  const deleteOne = useCallback(async (t: TakeWithUrl) => {
    if (!confirm("Delete this take?")) return;
    await supabase.storage.from("takes").remove([t.storage_path]);
    await supabase.from("takes").delete().eq("id", t.id);
    setTakes((prev) => prev.filter((x) => x.id !== t.id));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(t.id);
      return next;
    });
  }, []);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#050505] text-[#FAFAFA]">
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ opacity: view === "feed" ? 0.3 : 1 }}>
        <LiquidEther
          colors={["#22d3ee", "#a855f7", "#f472b6"]}
          mouseForce={16}
          cursorSize={100}
          resolution={0.5}
          autoDemo
          autoSpeed={0.4}
          autoIntensity={1.8}
          takeoverDuration={0.3}
          autoResumeDelay={2000}
        />
      </div>
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 15%, rgba(5,5,5,0.75) 75%, #050505 100%)",
        }}
      />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-6">
        <Link to="/" className="flex items-center gap-3">
          <img src={wzrdLogo.url} alt="WZRD" className="h-8 w-auto opacity-90" />
          <span className="hidden text-[11px] uppercase tracking-[0.24em] text-white/60 sm:inline">
            wzrd.tech
          </span>
        </Link>
        <nav className="flex items-center gap-2">
          <Link
            to="/"
            className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl transition hover:bg-white/10"
          >
            ← Stage
          </Link>
        </nav>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start gap-3 px-6 pb-6 pt-2">
        <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/60 backdrop-blur-xl">
          Library
        </span>
        <h1 className="text-5xl font-semibold leading-none tracking-tight sm:text-6xl md:text-7xl">
          <ShinyText text="Your takes" speed={4} />
        </h1>
        <p className="max-w-xl text-sm text-white/60">
          Scroll the feed like TikTok, browse as a grid, or select many and download them as a zip.
        </p>

        <div className="mt-4 flex w-full flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { k: "all" as const, label: "All" },
                { k: "video" as const, label: "Videos" },
                { k: "image" as const, label: "Snapshots" },
              ]
            ).map((f) => {
              const active = filter === f.k;
              return (
                <button
                  key={f.k}
                  onClick={() => setFilter(f.k)}
                  className={`rounded-full border px-4 py-1.5 text-[11px] uppercase tracking-[0.2em] backdrop-blur-xl transition ${
                    active
                      ? "border-cyan-300/60 bg-cyan-400/20 text-cyan-100"
                      : "border-white/10 bg-black/40 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {f.label}
                  <span className="ml-2 text-white/40">{counts[f.k]}</span>
                </button>
              );
            })}
          </div>
          <ViewToggle view={view} onChange={setView} />
        </div>
      </section>

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-32">
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-[9/16] w-full animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="mx-auto max-w-md py-16">
            <GlassSurface borderRadius={24} className="!h-auto !w-full">
              <div className="flex flex-col items-center gap-4 p-10 text-center">
                <div className="text-4xl">✨</div>
                <h2 className="text-2xl font-semibold">
                  <ShinyText text="No takes yet" speed={3} />
                </h2>
                <p className="text-sm text-white/60">
                  Go live once and Zap will auto-record your session in portrait 9:16.
                </p>
                <Link
                  to="/"
                  className="mt-2 rounded-full border border-cyan-300/40 bg-cyan-400/20 px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-cyan-100 backdrop-blur-xl transition hover:bg-cyan-400/30"
                >
                  ← Back to Stage
                </Link>
              </div>
            </GlassSurface>
          </div>
        )}

        {!loading && filtered.length > 0 && view === "grid" && (
          <GridView
            takes={filtered}
            selected={selected}
            onToggle={toggleSelect}
            onDelete={deleteOne}
          />
        )}
        {!loading && filtered.length > 0 && view === "list" && (
          <ListView
            takes={filtered}
            selected={selected}
            onToggle={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onDelete={deleteOne}
          />
        )}
        {!loading && filtered.length > 0 && view === "feed" && (
          <FeedView
            takes={filtered}
            selected={selected}
            onToggle={toggleSelect}
            onDelete={deleteOne}
          />
        )}
      </main>

      {selected.size > 0 && (
        <BulkBar
          count={selected.size}
          onDownload={bulkDownloadSequential}
          onDownloadZip={bulkDownloadZip}
          onDelete={bulkDelete}
          onClear={clearSelection}
        />
      )}

      {view !== "feed" && <SiteFooter />}
    </div>
  );
}

/* ---------------- View toggle ---------------- */

function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const btn = (v: ViewMode, label: string, icon: string) => (
    <button
      key={v}
      onClick={() => onChange(v)}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition ${
        view === v ? "bg-white/15 text-white" : "text-white/60 hover:text-white"
      }`}
      title={label}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
  return (
    <div className="flex overflow-hidden rounded-full border border-white/10 bg-black/40 backdrop-blur-xl">
      {btn("feed", "Feed", "▶")}
      {btn("grid", "Grid", "▦")}
      {btn("list", "List", "☰")}
    </div>
  );
}

/* ---------------- Select check ---------------- */

function SelectCheck({
  checked,
  onChange,
  className = "",
}: {
  checked: boolean;
  onChange: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onChange();
      }}
      className={`grid h-7 w-7 place-items-center rounded-full border backdrop-blur-xl transition ${
        checked
          ? "border-cyan-300 bg-cyan-400 text-black"
          : "border-white/40 bg-black/50 text-transparent hover:border-white"
      } ${className}`}
      aria-pressed={checked}
      aria-label={checked ? "Deselect" : "Select"}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3">
        <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/* ---------------- Grid view ---------------- */

function GridView({
  takes,
  selected,
  onToggle,
  onDelete,
}: {
  takes: TakeWithUrl[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onDelete: (t: TakeWithUrl) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {takes.map((t) => {
        const isSel = selected.has(t.id);
        return (
          <div
            key={t.id}
            className={`group relative overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-xl transition ${
              isSel
                ? "border-cyan-300/70 ring-2 ring-cyan-300/40"
                : "border-white/10 hover:border-white/20 hover:bg-black/60"
            }`}
          >
            <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
              {t.url ? (
                t.kind === "video" ? (
                  <video
                    src={t.url}
                    className="h-full w-full object-cover"
                    controls
                    preload="metadata"
                    playsInline
                  />
                ) : (
                  <img
                    src={t.url}
                    alt="snapshot"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-white/[0.04] to-transparent" />
              )}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-black/60 to-transparent" />
              <span
                className={`absolute left-2 top-2 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] backdrop-blur-xl ${
                  t.kind === "video"
                    ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-100"
                    : "border-fuchsia-300/40 bg-fuchsia-400/20 text-fuchsia-100"
                }`}
              >
                {t.kind}
              </span>
              <SelectCheck
                checked={isSel}
                onChange={() => onToggle(t.id)}
                className="absolute right-2 top-2"
              />
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/5 bg-black/40 px-3 py-2.5 text-[11px]">
              <span className="text-white/50">{fmtDate(t.created_at)}</span>
              <div className="flex items-center gap-3">
                {t.url && (
                  <a
                    href={t.url}
                    download={filenameFor(t)}
                    className="text-white/80 transition hover:text-cyan-200"
                    title="Download"
                  >
                    ⬇
                  </a>
                )}
                <button
                  onClick={() => onDelete(t)}
                  className="text-white/50 transition hover:text-rose-300"
                  title="Delete"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- List view ---------------- */

function ListView({
  takes,
  selected,
  onToggle,
  onSelectAll,
  onClearSelection,
  onDelete,
}: {
  takes: TakeWithUrl[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: (t: TakeWithUrl) => void;
}) {
  const allSel = takes.length > 0 && takes.every((t) => selected.has(t.id));
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl">
      <div className="grid grid-cols-[44px_84px_1fr_88px_120px_100px_100px] items-center gap-3 border-b border-white/10 bg-black/50 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/50">
        <SelectCheck checked={allSel} onChange={allSel ? onClearSelection : onSelectAll} />
        <span>Preview</span>
        <span>Name</span>
        <span>Kind</span>
        <span>Created</span>
        <span>Size</span>
        <span className="text-right">Actions</span>
      </div>
      {takes.map((t) => {
        const isSel = selected.has(t.id);
        return (
          <div
            key={t.id}
            className={`grid grid-cols-[44px_84px_1fr_88px_120px_100px_100px] items-center gap-3 border-b border-white/5 px-4 py-3 text-[12px] transition ${
              isSel ? "bg-cyan-400/5" : "hover:bg-white/[0.03]"
            }`}
          >
            <SelectCheck checked={isSel} onChange={() => onToggle(t.id)} />
            <div className="relative h-16 w-14 overflow-hidden rounded-md bg-black">
              {t.url ? (
                t.kind === "video" ? (
                  <video
                    src={t.url + "#t=0.1"}
                    className="h-full w-full object-cover"
                    preload="metadata"
                    muted
                    playsInline
                  />
                ) : (
                  <img src={t.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                )
              ) : null}
            </div>
            <div className="min-w-0 truncate font-mono text-white/80">{filenameFor(t)}</div>
            <span
              className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] ${
                t.kind === "video"
                  ? "border-cyan-300/40 bg-cyan-400/10 text-cyan-100"
                  : "border-fuchsia-300/40 bg-fuchsia-400/10 text-fuchsia-100"
              }`}
            >
              {t.kind}
              {t.kind === "video" && (
                <span className="ml-1 text-white/50">· {fmtDur(t.duration_ms)}</span>
              )}
            </span>
            <span className="text-white/60">{fmtDate(t.created_at)}</span>
            <span className="text-white/60">{fmtBytes(t.size_bytes)}</span>
            <div className="flex items-center justify-end gap-3">
              {t.url && (
                <a
                  href={t.url}
                  download={filenameFor(t)}
                  className="text-white/80 transition hover:text-cyan-200"
                  title="Download"
                >
                  ⬇
                </a>
              )}
              <button
                onClick={() => onDelete(t)}
                className="text-white/50 transition hover:text-rose-300"
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Feed view ---------------- */

function FeedView({
  takes,
  selected,
  onToggle,
  onDelete,
}: {
  takes: TakeWithUrl[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onDelete: (t: TakeWithUrl) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.id);
          const v = videoRefs.current.get(id);
          if (!v) continue;
          if (e.intersectionRatio > 0.6) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: [0, 0.6, 1], root: containerRef.current },
    );
    for (const el of Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>("[data-slide]") ?? [],
    )) {
      io.observe(el);
    }
    return () => io.disconnect();
  }, [takes]);

  useEffect(() => {
    videoRefs.current.forEach((v) => (v.muted = muted));
  }, [muted]);

  return (
    <div
      ref={containerRef}
      className="mx-auto h-[calc(100dvh-260px)] w-full max-w-md snap-y snap-mandatory overflow-y-auto rounded-3xl border border-white/10 bg-black/50 backdrop-blur-xl"
      style={{ scrollbarWidth: "none" }}
    >
      {takes.map((t) => {
        const isSel = selected.has(t.id);
        return (
          <div
            key={t.id}
            data-slide
            data-id={t.id}
            className="relative flex h-full min-h-full w-full snap-start snap-always items-center justify-center overflow-hidden"
            style={{ height: "calc(100dvh - 260px)" }}
          >
            <div className="absolute inset-0 bg-black">
              {t.url ? (
                t.kind === "video" ? (
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(t.id, el);
                      else videoRefs.current.delete(t.id);
                    }}
                    src={t.url}
                    className="h-full w-full object-cover"
                    loop
                    muted={muted}
                    playsInline
                    onClick={() => setMuted((m) => !m)}
                  />
                ) : (
                  <img
                    src={t.url}
                    alt=""
                    className="h-full w-full animate-[kenburns_20s_ease-in-out_infinite_alternate] object-cover"
                  />
                )
              ) : null}
            </div>

            <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="absolute left-4 top-4 flex items-center gap-2">
              <span
                className={`rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.2em] backdrop-blur-xl ${
                  t.kind === "video"
                    ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-100"
                    : "border-fuchsia-300/40 bg-fuchsia-400/20 text-fuchsia-100"
                }`}
              >
                {t.kind}
              </span>
              {t.kind === "video" && (
                <span className="rounded-full border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] text-white/80 backdrop-blur-xl">
                  {fmtDur(t.duration_ms)}
                </span>
              )}
            </div>

            <div className="absolute bottom-6 left-4 text-[12px] text-white/90">
              <div className="font-mono">{filenameFor(t)}</div>
              <div className="text-white/60">{fmtDate(t.created_at)} · {fmtBytes(t.size_bytes)}</div>
            </div>

            <div className="absolute right-3 top-1/2 flex -translate-y-1/2 flex-col items-center gap-4">
              <SelectCheck checked={isSel} onChange={() => onToggle(t.id)} />
              {t.url && (
                <a
                  href={t.url}
                  download={filenameFor(t)}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-xl transition hover:bg-white/10"
                  title="Download"
                >
                  ⬇
                </a>
              )}
              {t.kind === "video" && (
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-xl transition hover:bg-white/10"
                  title={muted ? "Unmute" : "Mute"}
                >
                  {muted ? "🔇" : "🔊"}
                </button>
              )}
              <button
                onClick={async () => {
                  if (t.url) {
                    await navigator.clipboard.writeText(t.url).catch(() => {});
                  }
                }}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur-xl transition hover:bg-white/10"
                title="Copy link"
              >
                ⧉
              </button>
              <button
                onClick={() => onDelete(t)}
                className="grid h-11 w-11 place-items-center rounded-full border border-rose-300/30 bg-black/50 text-rose-200 backdrop-blur-xl transition hover:bg-rose-400/20"
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        );
      })}
      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1) translate(0,0); }
          100% { transform: scale(1.15) translate(-2%, 2%); }
        }
      `}</style>
    </div>
  );
}

/* ---------------- Bulk action bar ---------------- */

function BulkBar({
  count,
  onDownload,
  onDownloadZip,
  onDelete,
  onClear,
}: {
  count: number;
  onDownload: () => void;
  onDownloadZip: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit max-w-[calc(100vw-24px)] items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-2 text-[12px] text-white shadow-2xl backdrop-blur-xl">
      <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-cyan-100">
        {count} selected
      </span>
      <button
        onClick={onDownload}
        className="rounded-full border border-white/15 px-3 py-1 transition hover:bg-white/10"
        title="Download each file"
      >
        ⬇ Download
      </button>
      <button
        onClick={onDownloadZip}
        className="rounded-full border border-cyan-300/40 bg-cyan-400/15 px-3 py-1 text-cyan-100 transition hover:bg-cyan-400/25"
        title="Download as ZIP"
      >
        ⬇ ZIP
      </button>
      <button
        onClick={onDelete}
        className="rounded-full border border-rose-300/40 bg-rose-500/15 px-3 py-1 text-rose-100 transition hover:bg-rose-500/25"
      >
        Delete
      </button>
      <button
        onClick={onClear}
        className="rounded-full px-3 py-1 text-white/60 transition hover:text-white"
      >
        Clear
      </button>
    </div>
  );
}
