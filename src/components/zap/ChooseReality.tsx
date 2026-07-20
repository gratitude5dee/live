import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import OptionWheel from "@/components/reactbits/OptionWheel";
import ShinyText from "@/components/reactbits/ShinyText";
import type { Preset } from "@/lib/zap/types";

interface ChooseRealityProps {
  onEnter: () => void;
  disabled?: boolean;
}

const PENDING_KEY = "zaplive.pendingPresetId";

export default function ChooseReality({ onEnter, disabled }: ChooseRealityProps) {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [idx, setIdx] = useState(0);
  

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("presets")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => {
        if (cancelled || !data) return;
        const withThumbs = data.filter((p) => (p as any).thumbnail_url);
        setPresets(withThumbs.length ? (withThumbs as Preset[]) : (data as Preset[]));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo(() => presets.map((p) => p.name), [presets]);
  const active = presets[idx];

  // Preload neighbor thumbnails
  useEffect(() => {
    if (!presets.length) return;
    [idx - 1, idx + 1].forEach((i) => {
      const p = presets[(i + presets.length) % presets.length];
      const url = (p as any)?.thumbnail_url;
      if (url) {
        const img = new Image();
        img.src = url;
      }
    });
  }, [idx, presets]);

  const zap = () => {
    if (active) {
      try {
        sessionStorage.setItem(PENDING_KEY, String(active.id));
      } catch {}
    }
    onEnter();
  };

  const shuffle = () => {
    if (!presets.length) return;
    let next = Math.floor(Math.random() * presets.length);
    if (next === idx) next = (next + 1) % presets.length;
    setIdx(next);
  };

  if (!items.length) {
    return <section id="presets" className="relative w-full bg-[#050505] py-32" />;
  }

  return (
    <section
      id="presets"
      className="relative w-full overflow-hidden bg-[#050505] py-28 md:py-40"
    >
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-24"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(5,5,5,0.9), #050505)",
        }}
      />

      {/* Ambient glow tied to selection */}
      <div
        key={active?.id}
        className="pointer-events-none absolute right-[8%] top-1/2 -z-0 h-[680px] w-[680px] -translate-y-1/2 rounded-full opacity-40 blur-[120px]"
        style={{
          background:
            "radial-gradient(circle, rgba(103,232,249,0.35), rgba(192,132,252,0.15) 40%, transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-10">
        {/* Section header */}
        <div className="mb-12 flex flex-col items-center text-center md:mb-20">
          <span className="mb-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] backdrop-blur">
            <ShinyText text="01 — REALITIES" color="#8a8f98" shineColor="#ffffff" speed={5} spread={140} />
          </span>
          <h2 className="max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight sm:text-5xl md:text-7xl">
            <ShinyText text="Choose your reality." color="#7c8291" shineColor="#ffffff" speed={5} spread={140} />
          </h2>
          <p className="mt-5 max-w-xl text-sm md:text-base">
            <ShinyText
              text="Scroll, drag, or tap. Zap Live drops you into the selected scene the moment Lucy connects."
              color="#6b7280"
              shineColor="#e5e7eb"
              speed={6}
              spread={160}
            />
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-20">
          {/* Wheel column — with safe gutter to clear top-left BubbleMenu */}
          <div className="relative mx-auto h-[420px] w-full max-w-[560px] sm:h-[520px] lg:h-[560px] lg:pl-24">
            {/* top / bottom fade mask */}
            <div
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"
              style={{
                background:
                  "linear-gradient(to bottom, #050505, transparent)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24"
              style={{
                background:
                  "linear-gradient(to top, #050505, transparent)",
              }}
            />
            <OptionWheel
              items={items}
              defaultSelected={0}
              side="left"
              fontSize={2.6}
              spacing={1.5}
              curve={1.1}
              tilt={8}
              blur={1.2}
              fade={0.28}
              inset={40}
              smoothing={220}
              loop
              activeColor="#ffffff"
              textColor="#3f3f46"
              onChange={(i) => setIdx(i)}
            />
          </div>

          {/* Preview column — nested double-bezel */}
          <div className="flex justify-center lg:justify-end">
            <div className="w-full max-w-[min(340px,80vw)] sm:max-w-sm">
              {/* Outer aluminum shell */}
              <div className="rounded-[2.5rem] bg-white/[0.03] p-2 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.95)] ring-1 ring-white/10">
                {/* Inner glass */}
                <div className="rounded-[calc(2.5rem-0.5rem)] bg-white/[0.02] p-1.5 ring-1 ring-white/5">
                  {/* Media */}
                  <div
                    className="relative overflow-hidden rounded-[calc(2.5rem-0.875rem)] bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    style={{ aspectRatio: "9 / 16" }}
                  >
                    {active && (active as any).thumbnail_url && (
                      <img
                        key={(active as any).thumbnail_url}
                        src={(active as any).thumbnail_url}
                        alt={active.name}
                        className="absolute inset-0 h-full w-full animate-[fade-in_0.6s_cubic-bezier(0.32,0.72,0,1)] object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

                    <div className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl ring-1 ring-white/15 backdrop-blur">
                      {active?.emoji ?? "✨"}
                    </div>

                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <h3 className="truncate text-2xl font-semibold tracking-tight text-white">
                        {active?.name}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-sm text-white/70">
                        {active?.prompt}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* CTA row — button-in-button + shuffle */}
              <div className="mt-5 flex items-center gap-3">
                <button
                  onClick={zap}
                  disabled={disabled}
                  data-cuelume-press="press"
                  className="group flex flex-1 items-center justify-between rounded-full bg-white px-5 py-3 text-sm font-semibold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_30px_rgba(0,0,0,0.35)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white active:scale-[0.98] disabled:opacity-50"
                >
                  <span>{disabled ? "Loading…" : "Zap this reality"}</span>
                  <span className="ml-3 flex h-8 w-8 items-center justify-center rounded-full bg-black text-white transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-[1px]">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 11L11 3" />
                      <path d="M5 3h6v6" />
                    </svg>
                  </span>
                </button>
                <button
                  onClick={shuffle}
                  aria-label="Shuffle preset"
                  data-cuelume-toggle="toggle"
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/80 backdrop-blur transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/10 hover:text-white active:scale-[0.95]"
                >

                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 5h3l8 10h3" />
                    <path d="M3 15h3l2-2.5" />
                    <path d="M12 7.5L14 5h3" />
                    <path d="M15 2l3 3-3 3" />
                    <path d="M15 12l3 3-3 3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
