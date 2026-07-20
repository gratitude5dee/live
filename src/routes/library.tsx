import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { downloadZip } from "client-zip";
import { play as playSfx } from "@/lib/sfx";

import { supabase } from "@/integrations/supabase/client";
import type { TakeRow } from "@/lib/zap/types";
import LiquidEther from "@/components/reactbits/LiquidEther";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — Archive" },
      { name: "description", content: "Every take Zap has ever repainted." },
    ],
  }),
  component: LibraryPage,
});

type TakeWithUrl = TakeRow & { url?: string };
type Filter = "all" | "video" | "image";
type ViewMode = "feed" | "grid" | "list";
type Scope = "mine" | "global";


/* ---------- utils ---------- */
const MONO = "font-mono tracking-tight tabular-nums";
function fmtBytes(n?: number | null) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
function fmtDur(ms?: number | null) {
  if (!ms) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
function filenameFor(t: TakeRow) {
  const stamp = new Date(t.created_at).toISOString().replace(/[:.]/g, "-");
  return `zap-${stamp}.${t.kind === "video" ? "webm" : "png"}`;
}
const EASE = "cubic-bezier(0.32,0.72,0,1)";

/* ---------- icons (hairline) ---------- */
const IconPlay = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <path d="M6 4l14 8-14 8V4z" strokeLinejoin="round" />
  </svg>
);
const IconGrid = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="1.2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="1.2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="1.2" />
  </svg>
);
const IconList = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </svg>
);
const IconDownload = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <path d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconTrash = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconLink = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <path d="M10 14a4 4 0 005.66 0l3-3a4 4 0 10-5.66-5.66l-1 1M14 10a4 4 0 00-5.66 0l-3 3a4 4 0 105.66 5.66l1-1" strokeLinecap="round" />
  </svg>
);
const IconMute = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
    <path d="M17 9l4 6M21 9l-4 6" strokeLinecap="round" />
  </svg>
);
const IconSound = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <path d="M4 9v6h4l5 4V5L8 9H4z" strokeLinejoin="round" />
    <path d="M16 8a5 5 0 010 8M19 5a9 9 0 010 14" strokeLinecap="round" />
  </svg>
);
const IconArrowLeft = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className={p.className}>
    <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconCheck = (p: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={p.className}>
    <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* ---------- page ---------- */
function LibraryPage() {
  const [takes, setTakes] = useState<TakeWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<Scope>(() => {
    if (typeof window === "undefined") return "mine";
    return (localStorage.getItem("zap.library.scope") as Scope | null) ?? "mine";
  });
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "grid";
    const saved = localStorage.getItem("zap.library.view") as ViewMode | null;
    if (saved) return saved;
    return window.matchMedia("(max-width: 768px)").matches ? "feed" : "grid";
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const readOnly = scope === "global";

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("zap.library.view", view);
  }, [view]);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("zap.library.scope", scope);
    // Clear selection when switching scopes to avoid cross-scope actions.
    setSelected(new Set());
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) await supabase.auth.signInAnonymously();
      const { data: sess2 } = await supabase.auth.getSession();
      const uid = sess2.session?.user.id;

      let q = supabase
        .from("takes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(120);
      if (scope === "mine" && uid) q = q.eq("user_id", uid);
      const { data } = await q;
      if (cancelled) return;
      if (!data) {
        setTakes([]);
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
      if (cancelled) return;
      setTakes(withUrls);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope]);


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
  const totalBytes = useMemo(
    () => takes.reduce((sum, t) => sum + (t.size_bytes ?? 0), 0),
    [takes],
  );

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);
  const selectAll = useCallback(() => setSelected(new Set(filtered.map((t) => t.id))), [filtered]);
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
    playSfx("droplet");
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
      selectedTakes.map(async (t) => ({ name: filenameFor(t), input: await fetch(t.url!) })),
    );
    const blob = await downloadZip(entries).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zap-archive-${Date.now()}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    playSfx("success");
  }, [selectedTakes]);


  const deleteOne = useCallback(async (t: TakeWithUrl) => {
    if (!confirm("Delete this take?")) return;
    await supabase.storage.from("takes").remove([t.storage_path]);
    await supabase.from("takes").delete().eq("id", t.id);
    setTakes((prev) => prev.filter((x) => x.id !== t.id));
    setSelected((prev) => {
      const n = new Set(prev);
      n.delete(t.id);
      return n;
    });
  }, []);

  // esc clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && filtered.length) {
        e.preventDefault();
        selectAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clearSelection, selectAll, filtered.length]);

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#050505] text-white antialiased">
      {/* Ambient LiquidEther, dimmed & warm */}
      <div className="pointer-events-none fixed inset-0 -z-10" style={{ opacity: view === "feed" ? 0.15 : 0.35 }}>
        <LiquidEther
          colors={["#f5c26b", "#22d3ee", "#e879f9"]}
          mouseForce={12}
          cursorSize={90}
          resolution={0.45}
          autoDemo
          autoSpeed={0.3}
          autoIntensity={1.4}
        />
      </div>
      {/* Vignette + warm hero glow */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(circle at 12% 8%, rgba(245,194,107,0.10), transparent 45%), radial-gradient(ellipse at center, transparent 20%, rgba(5,5,5,0.85) 80%, #050505 100%)",
        }}
      />
      {/* Grain */}
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22160%22 height=%22160%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.6%22/></svg>")',
        }}
      />

      <FloatingNav />

      {view !== "feed" && (
        <>
          <LibraryHero
            count={counts.all}
            totalBytes={totalBytes}
            latest={takes[0]?.created_at}
            scope={scope}
          />
          <ControlBar
            filter={filter}
            setFilter={setFilter}
            counts={counts}
            view={view}
            setView={setView}
            scope={scope}
            setScope={setScope}
          />
        </>
      )}

      {view === "feed" && (
        <div className="fixed right-6 top-6 z-30 flex items-center gap-2">
          <ScopeSegmented scope={scope} onChange={setScope} />
          <ViewSegmented view={view} onChange={setView} />
        </div>
      )}

      <main className={view === "feed" ? "relative z-10" : "relative z-10 mx-auto w-full max-w-[1440px] px-6 pb-40 md:px-10"}>
        {loading && <SkeletonBento />}

        {!loading && filtered.length === 0 && <EmptyPlate scope={scope} />}

        {!loading && filtered.length > 0 && view === "grid" && (
          <BentoGrid takes={filtered} selected={selected} onToggle={toggleSelect} onDelete={deleteOne} readOnly={readOnly} />
        )}
        {!loading && filtered.length > 0 && view === "list" && (
          <LedgerList
            takes={filtered}
            selected={selected}
            onToggle={toggleSelect}
            onSelectAll={selectAll}
            onClearSelection={clearSelection}
            onDelete={deleteOne}
            readOnly={readOnly}
          />
        )}
        {!loading && filtered.length > 0 && view === "feed" && (
          <CinemaFeed takes={filtered} selected={selected} onToggle={toggleSelect} onDelete={deleteOne} readOnly={readOnly} />
        )}
      </main>

      {selected.size > 0 && (
        <CommandBar
          count={selected.size}
          onDownload={bulkDownloadSequential}
          onDownloadZip={bulkDownloadZip}
          onDelete={readOnly ? undefined : bulkDelete}
          onClear={clearSelection}
        />
      )}

    </div>
  );
}

/* ---------- Floating nav ---------- */
function FloatingNav() {
  return (
    <header className="sticky top-4 z-40 mx-auto mt-4 flex w-fit max-w-[calc(100vw-32px)] items-center gap-1 rounded-full border border-white/10 bg-black/50 p-1 pl-2 backdrop-blur-2xl shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
      <a
        href="https://wzrd.tech"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3"
        aria-label="WZRD.tech"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/5 ring-1 ring-white/10">
          <img src={wzrdLogo.url} alt="WZRD" className="h-4 w-4 opacity-90 transition group-hover:opacity-100" />
        </span>
        <span className={`${MONO} text-[10px] uppercase tracking-[0.28em] text-white/60 transition group-hover:text-white/80`}>wzrd.tech</span>
      </a>
      <span className="h-4 w-px bg-white/10" />
      <span className={`${MONO} px-3 text-[10px] uppercase tracking-[0.28em] text-white/90`}>Archive</span>
      <Link
        to="/"
        className="group ml-1 flex items-center gap-1.5 rounded-full bg-white/[0.04] py-1 pl-3 pr-1 text-[11px] uppercase tracking-[0.2em] text-white/85 ring-1 ring-white/10 transition-all duration-500 hover:bg-white/[0.08]"
        style={{ transitionTimingFunction: EASE }}
      >
        Stage
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white/10 ring-1 ring-white/15 transition-transform duration-500 group-hover:-translate-x-0.5" style={{ transitionTimingFunction: EASE }}>
          <IconArrowLeft className="h-3.5 w-3.5" />
        </span>
      </Link>
    </header>
  );
}

/* ---------- Hero ---------- */
function LibraryHero({
  count,
  totalBytes,
  latest,
  scope,
}: {
  count: number;
  totalBytes: number;
  latest?: string;
  scope: Scope;
}) {
  const isGlobal = scope === "global";
  return (
    <section className="relative mx-auto w-full max-w-[1440px] px-6 pb-8 pt-16 md:px-10 md:pb-14 md:pt-24">
      <div className={`${MONO} mb-6 text-[10px] uppercase tracking-[0.34em] text-white/45`}>
        [ 001 / {isGlobal ? "GLOBAL FEED" : "ARCHIVE"} ]
      </div>
      <div className="flex flex-col items-start justify-between gap-8 md:flex-row md:items-end">
        <h1
          className="font-semibold leading-[0.88] tracking-[-0.045em] text-white"
          style={{ fontSize: "clamp(3.5rem, 10vw, 8rem)", textWrap: "balance" as unknown as undefined }}
        >
          {isGlobal ? "Everyone's" : "Your"}
          <br />
          <span className="italic text-white/90">takes.</span>
        </h1>
        <div className="flex flex-col items-start gap-3 md:items-end">
          <div className={`${MONO} flex items-center gap-4 text-[11px] uppercase tracking-[0.24em] text-white/70`}>
            <span>{String(count).padStart(3, "0")} <span className="text-white/40">takes</span></span>
            <span className="h-3 w-px bg-white/15" />
            <span>{fmtBytes(totalBytes)} <span className="text-white/40">stored</span></span>
            {latest && (
              <>
                <span className="hidden h-3 w-px bg-white/15 sm:block" />
                <span className="hidden sm:inline">
                  <span className="text-white/40">last </span>
                  {timeAgo(latest)}
                </span>
              </>
            )}
          </div>
          <p className="max-w-[42ch] text-right text-[13px] leading-relaxed text-white/50">
            {isGlobal
              ? "A public reel of every session Zap has ever repainted. Scroll, browse, or export a zip."
              : "Every session Zap ever repainted. Scroll it like a cinema deck, browse the wall, or pull a ledger and export a zip."}
          </p>
        </div>
      </div>
    </section>
  );
}


/* ---------- Control bar (scope + filter tabs + view segmented) ---------- */
function ControlBar({
  filter,
  setFilter,
  counts,
  view,
  setView,
  scope,
  setScope,
}: {
  filter: Filter;
  setFilter: (f: Filter) => void;
  counts: { all: number; video: number; image: number };
  view: ViewMode;
  setView: (v: ViewMode) => void;
  scope: Scope;
  setScope: (s: Scope) => void;
}) {
  const tabs: { k: Filter; label: string }[] = [
    { k: "all", label: "All" },
    { k: "video", label: "Video" },
    { k: "image", label: "Snapshot" },
  ];
  return (
    <div className="sticky top-[76px] z-30 mx-auto w-full max-w-[1440px] px-6 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.07] py-4 backdrop-blur-md">
        <div className="flex items-end gap-4">
          <ScopeSegmented scope={scope} onChange={setScope} />
          <span className="mb-2 hidden h-4 w-px bg-white/10 sm:block" />
          <div className="flex items-end gap-6">
            {tabs.map((t) => {
              const active = filter === t.k;
              return (
                <button
                  key={t.k}
                  onClick={() => setFilter(t.k)}
                  className="group relative pb-2 text-[13px] font-medium transition-colors duration-300"
                  style={{ transitionTimingFunction: EASE }}
                >
                  <span className={active ? "text-white" : "text-white/45 group-hover:text-white/75"}>
                    {t.label}
                  </span>
                  <sup className={`${MONO} ml-1 text-[9px] ${active ? "text-white/50" : "text-white/25"}`}>
                    {counts[t.k]}
                  </sup>
                  <span
                    className={`absolute inset-x-0 -bottom-px h-px origin-left bg-white transition-transform duration-500 ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                    style={{ transitionTimingFunction: EASE }}
                  />
                </button>
              );
            })}
          </div>
        </div>
        <ViewSegmented view={view} onChange={setView} />
      </div>
    </div>
  );
}

function ScopeSegmented({ scope, onChange }: { scope: Scope; onChange: (s: Scope) => void }) {
  const items: { s: Scope; label: string }[] = [
    { s: "mine", label: "Yours" },
    { s: "global", label: "Global" },
  ];
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur-xl">
      <div className="flex items-center gap-0.5">
        {items.map(({ s, label }) => {
          const active = scope === s;
          return (
            <button
              key={s}
              onClick={() => onChange(s)}
              className={`relative rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] transition-all duration-500 ${
                active ? "bg-white text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" : "text-white/60 hover:text-white"
              }`}
              style={{ transitionTimingFunction: EASE }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}


function ViewSegmented({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const items: { v: ViewMode; label: string; icon: React.FC<{ className?: string }> }[] = [
    { v: "feed", label: "Feed", icon: IconPlay },
    { v: "grid", label: "Grid", icon: IconGrid },
    { v: "list", label: "List", icon: IconList },
  ];
  return (
    <div className="rounded-full border border-white/10 bg-white/[0.03] p-1 backdrop-blur-xl">
      <div className="flex items-center gap-0.5">
        {items.map(({ v, label, icon: Icon }) => {
          const active = view === v;
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              className={`group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] transition-all duration-500 ${
                active ? "bg-white text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]" : "text-white/60 hover:text-white"
              }`}
              style={{ transitionTimingFunction: EASE }}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- Select check (double-bezel) ---------- */
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
      className={`grid h-8 w-8 place-items-center rounded-full p-[3px] transition-all duration-400 ${
        checked
          ? "bg-[#f5c26b]/25 ring-1 ring-[#f5c26b]/50"
          : "bg-black/50 ring-1 ring-white/15 hover:bg-black/70 hover:ring-white/30"
      } ${className}`}
      style={{ transitionTimingFunction: EASE }}
      aria-pressed={checked}
    >
      <span
        className={`grid h-full w-full place-items-center rounded-full transition-all duration-400 ${
          checked ? "bg-[#f5c26b] text-black" : "bg-white/5 text-transparent"
        }`}
        style={{ transitionTimingFunction: EASE }}
      >
        <IconCheck className="h-3.5 w-3.5" />
      </span>
    </button>
  );
}

/* ---------- Bento grid ---------- */
function BentoGrid({
  takes,
  selected,
  onToggle,
  onDelete,
  readOnly,
}: {
  takes: TakeWithUrl[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onDelete: (t: TakeWithUrl) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="mt-8 grid auto-rows-[220px] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:auto-rows-[240px]">
      {takes.map((t, i) => {
        // Every 7th tile is a hero (2x2). First tile also hero.
        const isHero = i === 0 || i % 7 === 3;
        return (
          <BentoCard
            key={t.id}
            take={t}
            index={i}
            hero={isHero}
            selected={selected.has(t.id)}
            onToggle={() => onToggle(t.id)}
            onDelete={() => onDelete(t)}
            readOnly={readOnly}
          />
        );
      })}
    </div>
  );
}

function BentoCard({
  take,
  index,
  hero,
  selected,
  onToggle,
  onDelete,
  readOnly,
}: {
  take: TakeWithUrl;
  index: number;
  hero: boolean;
  selected: boolean;
  onToggle: () => void;
  onDelete: () => void;
  readOnly?: boolean;
}) {

  const [hover, setHover] = useState(false);
  const spanCls = hero ? "col-span-2 row-span-2" : "col-span-1 row-span-1";
  return (
    <div
      className={`group relative ${spanCls} rounded-[1.75rem] p-[5px] transition-all duration-500 ${
        selected
          ? "bg-[#f5c26b]/15 ring-1 ring-[#f5c26b]/50"
          : "bg-white/[0.03] ring-1 ring-white/[0.08] hover:bg-white/[0.06] hover:ring-white/15"
      }`}
      style={{ transitionTimingFunction: EASE, transform: hover ? "translateY(-2px)" : "translateY(0)" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-[calc(1.75rem-5px)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
      >
        {take.url ? (
          take.kind === "video" ? (
            <video
              src={take.url}
              className="h-full w-full object-cover"
              controls={hover}
              preload="metadata"
              playsInline
              muted
              onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
              onMouseLeave={(e) => {
                e.currentTarget.pause();
                e.currentTarget.currentTime = 0.1;
              }}
            />
          ) : (
            <img src={take.url} alt="" className="h-full w-full object-cover" loading="lazy" />
          )
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-white/[0.04] to-transparent" />
        )}

        {/* top gradient + meta */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent" />
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span
            className={`${MONO} inline-flex items-center gap-1.5 rounded-sm bg-black/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.22em] text-white/80 ring-1 ring-white/10`}
          >
            <span className={`h-2 w-0.5 ${take.kind === "video" ? "bg-[#22d3ee]" : "bg-[#e879f9]"}`} />
            {take.kind}
            {take.kind === "video" && take.duration_ms && (
              <span className="text-white/45">· {fmtDur(take.duration_ms)}</span>
            )}
          </span>
        </div>
        <span className={`${MONO} absolute right-14 top-4 text-[10px] tracking-[0.2em] text-white/40`}>
          {String(index + 1).padStart(3, "0")}
        </span>
        <SelectCheck checked={selected} onChange={onToggle} className="absolute right-3 top-3" />

        {/* bottom meta strip — always visible on hero, lift on hover elsewhere */}
        <div
          className={`absolute inset-x-2 bottom-2 flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/60 px-3 py-2 text-[11px] backdrop-blur-xl transition-all duration-500 ${
            hero ? "opacity-100" : "translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100"
          }`}
          style={{ transitionTimingFunction: EASE }}
        >
          <div className="min-w-0 flex-1">
            <div className={`${MONO} truncate text-[10px] text-white/70`}>{filenameFor(take)}</div>
            <div className={`${MONO} text-[9px] uppercase tracking-[0.22em] text-white/40`}>
              {fmtDate(take.created_at)} · {fmtBytes(take.size_bytes)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {take.url && (
              <a
                href={take.url}
                download={filenameFor(take)}
                className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-white/80 ring-1 ring-white/10 transition-all duration-300 hover:bg-white hover:text-black"
                style={{ transitionTimingFunction: EASE }}
                title="Download"
              >
                <IconDownload className="h-3.5 w-3.5" />
              </a>
            )}
            {!readOnly && (
              <button
                onClick={onDelete}
                className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-white/60 ring-1 ring-white/10 transition-all duration-300 hover:bg-rose-500/20 hover:text-rose-200 hover:ring-rose-400/30"
                style={{ transitionTimingFunction: EASE }}
                title="Delete"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- Ledger list ---------- */
function LedgerList({
  takes,
  selected,
  onToggle,
  onSelectAll,
  onClearSelection,
  onDelete,
  readOnly,
}: {
  takes: TakeWithUrl[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: (t: TakeWithUrl) => void;
  readOnly?: boolean;
}) {

  const allSel = takes.length > 0 && takes.every((t) => selected.has(t.id));
  return (
    <div className="mt-8 overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-black/40 backdrop-blur-xl">
      <div
        className={`${MONO} grid grid-cols-[48px_44px_72px_1fr_100px_130px_90px_90px_100px] items-center gap-3 border-b border-white/[0.08] bg-white/[0.02] px-5 py-3 text-[10px] uppercase tracking-[0.26em] text-white/40`}
      >
        <span>Idx</span>
        <SelectCheck checked={allSel} onChange={allSel ? onClearSelection : onSelectAll} />
        <span>Preview</span>
        <span>Name</span>
        <span>Kind</span>
        <span>Created</span>
        <span>Dur</span>
        <span>Size</span>
        <span className="text-right">—</span>
      </div>
      {takes.map((t, i) => {
        const isSel = selected.has(t.id);
        return (
          <div
            key={t.id}
            className={`group relative grid grid-cols-[48px_44px_72px_1fr_100px_130px_90px_90px_100px] items-center gap-3 border-b border-white/[0.05] px-5 py-3 text-[12px] transition-all duration-300 ${
              isSel ? "bg-[#f5c26b]/[0.05]" : "hover:bg-white/[0.025]"
            }`}
            style={{ transitionTimingFunction: EASE }}
          >
            <span
              className={`pointer-events-none absolute left-0 top-1/2 h-8 w-[2px] -translate-y-1/2 origin-center bg-[#f5c26b] transition-transform duration-500 ${
                isSel ? "scale-y-100" : "scale-y-0 group-hover:scale-y-100"
              }`}
              style={{ transitionTimingFunction: EASE }}
            />
            <span className={`${MONO} text-[10px] text-white/40`}>{String(i + 1).padStart(3, "0")}</span>
            <SelectCheck checked={isSel} onChange={() => onToggle(t.id)} />
            <div className="relative h-14 w-12 overflow-hidden rounded-md bg-black ring-1 ring-white/10">
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
            <div className={`${MONO} min-w-0 truncate text-[11px] text-white/85`}>{filenameFor(t)}</div>
            <span className={`${MONO} inline-flex w-fit items-center gap-1.5 text-[10px] uppercase tracking-[0.22em] text-white/70`}>
              <span className={`h-3 w-0.5 ${t.kind === "video" ? "bg-[#22d3ee]" : "bg-[#e879f9]"}`} />
              {t.kind}
            </span>
            <span className={`${MONO} text-[11px] text-white/60`}>{fmtDate(t.created_at)}</span>
            <span className={`${MONO} text-[11px] text-white/60`}>{fmtDur(t.duration_ms)}</span>
            <span className={`${MONO} text-[11px] text-white/60`}>{fmtBytes(t.size_bytes)}</span>
            <div className="flex items-center justify-end gap-1">
              {t.url && (
                <a
                  href={t.url}
                  download={filenameFor(t)}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/70 ring-1 ring-transparent transition-all duration-300 hover:bg-white/10 hover:text-white hover:ring-white/15"
                  style={{ transitionTimingFunction: EASE }}
                  title="Download"
                >
                  <IconDownload className="h-3.5 w-3.5" />
                </a>
              )}
              {!readOnly && (
                <button
                  onClick={() => onDelete(t)}
                  className="grid h-8 w-8 place-items-center rounded-full text-white/50 ring-1 ring-transparent transition-all duration-300 hover:bg-rose-500/15 hover:text-rose-200 hover:ring-rose-400/25"
                  style={{ transitionTimingFunction: EASE }}
                  title="Delete"
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              )}

            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Cinema feed ---------- */
function CinemaFeed({
  takes,
  selected,
  onToggle,
  onDelete,
  readOnly,
}: {
  takes: TakeWithUrl[];
  selected: Set<number>;
  onToggle: (id: number) => void;
  onDelete: (t: TakeWithUrl) => void;
  readOnly?: boolean;
}) {

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const [muted, setMuted] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = Number((e.target as HTMLElement).dataset.id);
          const idx = Number((e.target as HTMLElement).dataset.idx);
          const v = videoRefs.current.get(id);
          if (e.intersectionRatio > 0.6) {
            v?.play().catch(() => {});
            setActiveIdx(idx);
          } else {
            v?.pause();
          }
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

  const active = takes[activeIdx];

  return (
    <div className="fixed inset-0 z-10 bg-[#050505]">
      {/* Ambient blurred backdrop of active take */}
      <div key={active?.id} className="pointer-events-none absolute inset-0 overflow-hidden">
        {active?.url && active.kind === "video" && (
          <video
            src={active.url}
            className="h-full w-full object-cover opacity-40"
            style={{ filter: "blur(80px) saturate(1.6)", transform: "scale(1.4)" }}
            autoPlay
            muted
            loop
            playsInline
          />
        )}
        {active?.url && active.kind === "image" && (
          <img
            src={active.url}
            alt=""
            className="h-full w-full object-cover opacity-40"
            style={{ filter: "blur(80px) saturate(1.6)", transform: "scale(1.4)" }}
          />
        )}
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Left slide indicator */}
      <div className="pointer-events-none absolute left-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-2 md:flex">
        {takes.slice(0, 12).map((_, i) => (
          <span
            key={i}
            className={`h-6 w-[2px] rounded-full transition-all duration-500 ${
              i === activeIdx ? "bg-[#f5c26b]" : "bg-white/20"
            }`}
            style={{ transitionTimingFunction: EASE }}
          />
        ))}
        {takes.length > 12 && (
          <span className={`${MONO} mt-1 text-[9px] tracking-[0.2em] text-white/40`}>+{takes.length - 12}</span>
        )}
      </div>

      {/* Deck */}
      <div
        ref={containerRef}
        className="relative z-20 mx-auto h-full w-full max-w-[440px] snap-y snap-mandatory overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        {takes.map((t, i) => {
          const isSel = selected.has(t.id);
          return (
            <div
              key={t.id}
              data-slide
              data-id={t.id}
              data-idx={i}
              className="relative flex h-full min-h-full w-full snap-start snap-always items-center justify-center overflow-hidden"
              style={{ height: "100dvh" }}
            >
              <div className="absolute inset-y-8 inset-x-2 overflow-hidden rounded-[1.75rem] bg-black shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)] ring-1 ring-white/10 md:inset-x-4">
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
                      className="h-full w-full animate-[kenburns_22s_ease-in-out_infinite_alternate] object-cover"
                    />
                  )
                ) : null}

                {/* index + kind top-left */}
                <div className="absolute left-4 top-4 flex flex-col gap-2">
                  <span className={`${MONO} text-[10px] tracking-[0.28em] text-white/50`}>
                    {String(i + 1).padStart(3, "0")} / {String(takes.length).padStart(3, "0")}
                  </span>
                  <span className={`${MONO} inline-flex w-fit items-center gap-1.5 rounded-sm bg-black/60 px-2 py-0.5 text-[9px] uppercase tracking-[0.24em] text-white/80 ring-1 ring-white/10`}>
                    <span className={`h-2 w-0.5 ${t.kind === "video" ? "bg-[#22d3ee]" : "bg-[#e879f9]"}`} />
                    {t.kind}
                    {t.kind === "video" && t.duration_ms && (
                      <span className="text-white/50">· {fmtDur(t.duration_ms)}</span>
                    )}
                  </span>
                </div>

                {/* bottom meta */}
                <div className="absolute inset-x-4 bottom-6">
                  <div className="h-[2px] w-8 bg-[#f5c26b]" />
                  <div className={`${MONO} mt-2 truncate text-[11px] text-white/90`}>{filenameFor(t)}</div>
                  <div className={`${MONO} text-[10px] uppercase tracking-[0.22em] text-white/50`}>
                    {fmtDate(t.created_at)} · {fmtBytes(t.size_bytes)}
                  </div>
                </div>
              </div>

              {/* right rail */}
              <div className="absolute right-3 top-1/2 z-10 flex -translate-y-1/2 flex-col items-center gap-2 md:right-6">
                <SelectCheck checked={isSel} onChange={() => onToggle(t.id)} />
                {t.url && (
                  <a
                    href={t.url}
                    download={filenameFor(t)}
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white/85 ring-1 ring-white/15 backdrop-blur-xl transition-all duration-400 hover:bg-white hover:text-black"
                    style={{ transitionTimingFunction: EASE }}
                    title="Download"
                  >
                    <IconDownload className="h-4 w-4" />
                  </a>
                )}
                {t.kind === "video" && (
                  <button
                    onClick={() => setMuted((m) => !m)}
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white/85 ring-1 ring-white/15 backdrop-blur-xl transition-all duration-400 hover:bg-white/10"
                    style={{ transitionTimingFunction: EASE }}
                    title={muted ? "Unmute" : "Mute"}
                  >
                    {muted ? <IconMute className="h-4 w-4" /> : <IconSound className="h-4 w-4" />}
                  </button>
                )}
                <button
                  onClick={async () => {
                    if (t.url) await navigator.clipboard.writeText(t.url).catch(() => {});
                  }}
                  className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-white/85 ring-1 ring-white/15 backdrop-blur-xl transition-all duration-400 hover:bg-white/10"
                  style={{ transitionTimingFunction: EASE }}
                  title="Copy link"
                >
                  <IconLink className="h-4 w-4" />
                </button>
                {!readOnly && (
                  <button
                    onClick={() => onDelete(t)}
                    className="grid h-11 w-11 place-items-center rounded-full bg-black/60 text-rose-200 ring-1 ring-rose-400/25 backdrop-blur-xl transition-all duration-400 hover:bg-rose-500/20"
                    style={{ transitionTimingFunction: EASE }}
                    title="Delete"
                  >
                    <IconTrash className="h-4 w-4" />
                  </button>
                )}

              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1) translate(0,0); }
          100% { transform: scale(1.15) translate(-2%, 2%); }
        }
      `}</style>
    </div>
  );
}

/* ---------- Command bar ---------- */
function CommandBar({
  count,
  onDownload,
  onDownloadZip,
  onDelete,
  onClear,
}: {
  count: number;
  onDownload: () => void;
  onDownloadZip: () => void;
  onDelete?: () => void;
  onClear: () => void;
}) {

  return (
    <div
      className="fixed inset-x-0 bottom-6 z-50 mx-auto flex w-fit max-w-[calc(100vw-24px)] items-center gap-1 rounded-full border border-white/12 bg-black/75 p-1.5 pl-3 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)] backdrop-blur-2xl"
      style={{ animation: `slideUp 400ms ${EASE} both` }}
    >
      <span className={`${MONO} flex items-center gap-2 pr-2 text-[11px] uppercase tracking-[0.22em] text-white/85`}>
        <span className="grid h-6 min-w-6 place-items-center rounded-full bg-[#f5c26b] px-1.5 text-[10px] font-semibold text-black">
          {count}
        </span>
        selected
      </span>
      <span className="h-5 w-px bg-white/10" />
      <button
        onClick={onDownload}
        className="group flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-white/85 ring-1 ring-white/10 transition-all duration-400 hover:bg-white/10"
        style={{ transitionTimingFunction: EASE }}
      >
        <IconDownload className="h-3.5 w-3.5" />
        Each
      </button>
      <button
        onClick={onDownloadZip}
        className="group flex items-center gap-1.5 rounded-full bg-white py-1.5 pl-3 pr-1.5 text-[11px] uppercase tracking-[0.2em] text-black transition-all duration-400 active:scale-[0.97]"
        style={{ transitionTimingFunction: EASE }}
      >
        Zip
        <span className="grid h-6 w-6 place-items-center rounded-full bg-black text-white transition-transform duration-400 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]" style={{ transitionTimingFunction: EASE }}>
          <IconDownload className="h-3 w-3" />
        </span>
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] text-rose-200 ring-1 ring-rose-400/25 transition-all duration-400 hover:bg-rose-500/20"
        style={{ transitionTimingFunction: EASE }}
      >
        <IconTrash className="h-3.5 w-3.5" />
        Delete
      </button>
      <button
        onClick={onClear}
        className={`${MONO} rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-white/50 transition hover:text-white`}
        title="Esc"
      >
        Esc
      </button>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyPlate() {
  return (
    <div className="relative mx-auto mt-16 max-w-3xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.02] p-16 text-center">
      <div
        className={`${MONO} pointer-events-none absolute inset-0 grid place-items-center text-[22vw] font-semibold leading-none text-white/[0.04]`}
      >
        000
      </div>
      <div className="relative z-10 flex flex-col items-center gap-4">
        <span className={`${MONO} text-[10px] uppercase tracking-[0.34em] text-white/40`}>
          [ ARCHIVE ]
        </span>
        <h2 className="text-3xl font-semibold tracking-[-0.02em] md:text-5xl">The archive is empty.</h2>
        <p className="max-w-md text-sm text-white/55">
          Go live once and Zap will auto-record your session in portrait 9:16. It'll land here the
          moment it uploads.
        </p>
        <Link
          to="/"
          className="group mt-4 flex items-center gap-1.5 rounded-full bg-white py-2 pl-5 pr-2 text-[11px] uppercase tracking-[0.24em] text-black transition-all duration-400 active:scale-[0.98]"
          style={{ transitionTimingFunction: EASE }}
        >
          Go to stage
          <span
            className="grid h-8 w-8 place-items-center rounded-full bg-black text-white transition-transform duration-400 group-hover:translate-x-0.5 group-hover:-translate-y-[1px]"
            style={{ transitionTimingFunction: EASE }}
          >
            <IconArrowLeft className="h-3.5 w-3.5 rotate-180" />
          </span>
        </Link>
      </div>
    </div>
  );
}

/* ---------- Skeleton ---------- */
function SkeletonBento() {
  return (
    <div className="mt-8 grid auto-rows-[220px] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4 lg:grid-cols-6 lg:auto-rows-[240px]">
      {Array.from({ length: 8 }).map((_, i) => {
        const hero = i === 0;
        return (
          <div
            key={i}
            className={`relative overflow-hidden rounded-[1.75rem] bg-white/[0.03] ring-1 ring-white/[0.06] ${
              hero ? "col-span-2 row-span-2" : "col-span-1 row-span-1"
            }`}
          >
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
                animation: "shimmer 2s linear infinite",
              }}
            />
            <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
          </div>
        );
      })}
    </div>
  );
}
