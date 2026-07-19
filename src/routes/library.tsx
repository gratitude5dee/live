import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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

function LibraryPage() {
  const [takes, setTakes] = useState<TakeWithUrl[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

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

  const filtered = useMemo(() => {
    if (filter === "all") return takes;
    return takes.filter((t) => t.kind === filter);
  }, [takes, filter]);

  const counts = useMemo(
    () => ({
      all: takes.length,
      video: takes.filter((t) => t.kind === "video").length,
      image: takes.filter((t) => t.kind === "image").length,
    }),
    [takes],
  );

  return (
    <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#050505] text-[#FAFAFA]">
      {/* LiquidEther background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
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

      {/* Top bar */}
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
          <a
            href="https://wzrd.tech"
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-full border border-white/10 bg-black/40 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-white/80 backdrop-blur-xl transition hover:bg-white/10 sm:inline"
          >
            wzrd.tech ↗
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-start gap-3 px-6 pb-8 pt-4">
        <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-white/60 backdrop-blur-xl">
          Library
        </span>
        <h1 className="text-5xl font-semibold leading-none tracking-tight sm:text-6xl md:text-7xl">
          <ShinyText text="Your takes" speed={4} />
        </h1>
        <p className="max-w-xl text-sm text-white/60">
          Every session Zap has ever repainted. Signed links refresh hourly — download,
          share, or delete anything you don&apos;t want to keep.
        </p>

        {/* Filter pills */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
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
      </section>

      {/* Grid */}
      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-24">
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

        {!loading && filtered.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((t) => (
              <TakeCard
                key={t.id}
                take={t}
                onDelete={async () => {
                  if (!confirm("Delete this take?")) return;
                  await supabase.storage.from("takes").remove([t.storage_path]);
                  await supabase.from("takes").delete().eq("id", t.id);
                  setTakes((prev) => prev.filter((x) => x.id !== t.id));
                }}
              />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}

function TakeCard({
  take,
  onDelete,
}: {
  take: TakeWithUrl;
  onDelete: () => void;
}) {
  const filename = useMemo(() => {
    const stamp = new Date(take.created_at).toISOString().replace(/[:.]/g, "-");
    const ext = take.kind === "video" ? "webm" : "png";
    return `zap-${stamp}.${ext}`;
  }, [take]);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition hover:border-white/20 hover:bg-black/60">
      {/* Preview */}
      <div className="relative aspect-[9/16] w-full overflow-hidden bg-black">
        {take.url ? (
          take.kind === "video" ? (
            <video
              src={take.url}
              className="h-full w-full object-cover"
              controls
              preload="metadata"
              playsInline
            />
          ) : (
            <img
              src={take.url}
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
            take.kind === "video"
              ? "border-cyan-300/40 bg-cyan-400/20 text-cyan-100"
              : "border-fuchsia-300/40 bg-fuchsia-400/20 text-fuchsia-100"
          }`}
        >
          {take.kind}
        </span>
      </div>

      {/* Meta + actions */}
      <div className="flex items-center justify-between gap-2 border-t border-white/5 bg-black/40 px-3 py-2.5 text-[11px]">
        <span className="text-white/50">
          {new Date(take.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <div className="flex items-center gap-3">
          {take.url && (
            <a
              href={take.url}
              download={filename}
              className="text-white/80 transition hover:text-cyan-200"
              title="Download"
            >
              ⬇ Download
            </a>
          )}
          <button
            onClick={onDelete}
            className="text-white/50 transition hover:text-rose-300"
            title="Delete"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
