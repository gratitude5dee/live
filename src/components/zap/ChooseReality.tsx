import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import OptionWheel from "@/components/reactbits/OptionWheel";
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

  const zap = () => {
    if (active) {
      try {
        sessionStorage.setItem(PENDING_KEY, String(active.id));
      } catch {}
    }
    onEnter();
  };

  if (!items.length) {
    return (
      <section id="presets" className="relative w-full bg-[#050505] py-32" />
    );
  }

  return (
    <section
      id="presets"
      className="relative w-full overflow-hidden bg-[#050505] py-24 md:py-32"
    >
      <div
        className="pointer-events-none absolute inset-x-0 -top-32 h-32"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(5,5,5,0.9), #050505)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 flex flex-col items-center text-center">
          <span className="mb-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] text-white/70 backdrop-blur">
            Presets
          </span>
          <h2 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl">
            Choose your{" "}
            <span className="bg-gradient-to-r from-[#67e8f9] via-[#c084fc] to-[#f472b6] bg-clip-text text-transparent">
              reality
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-sm text-white/50 md:text-base">
            Scroll, drag, or tap. Zap Live will drop you into the selected scene
            the moment Lucy connects.
          </p>
        </div>

        <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-2">
          {/* Wheel */}
          <div className="relative h-[520px] w-full">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10"
              style={{
                background:
                  "linear-gradient(to right, #050505 20%, transparent)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-24 z-10"
              style={{
                background:
                  "linear-gradient(to bottom, #050505, transparent)",
              }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-24 z-10"
              style={{
                background: "linear-gradient(to top, #050505, transparent)",
              }}
            />
            <OptionWheel
              items={items}
              defaultSelected={0}
              side="left"
              fontSize={2.6}
              spacing={1.5}
              curve={1.1}
              tilt={7}
              blur={1.6}
              fade={0.28}
              inset={40}
              smoothing={220}
              activeColor="#ffffff"
              textColor="#3f3f46"
              onChange={(i) => setIdx(i)}
            />
          </div>

          {/* Preview card */}
          <div className="flex justify-center">
            <div className="relative w-full max-w-sm">
              <div
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)]"
                style={{ aspectRatio: "9 / 16" }}
              >
                {active && (active as any).thumbnail_url && (
                  <img
                    src={(active as any).thumbnail_url}
                    alt={active.name}
                    className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                <div className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/70 text-2xl backdrop-blur ring-1 ring-white/15">
                  {active?.emoji ?? "✨"}
                </div>
                <div className="absolute inset-x-0 bottom-0 p-6">
                  <h3 className="text-2xl font-semibold tracking-tight text-white">
                    {active?.name}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm text-white/70">
                    {active?.prompt}
                  </p>
                  <button
                    onClick={zap}
                    disabled={disabled}
                    className="group mt-5 flex w-full items-center justify-between rounded-full border border-white/15 bg-white/95 px-5 py-3 text-sm font-semibold text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_10px_30px_rgba(0,0,0,0.35)] transition hover:bg-white disabled:opacity-50"
                  >
                    <span>{disabled ? "Loading…" : "Zap this reality"}</span>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-black text-white transition-transform group-hover:translate-x-0.5">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 14 14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 11L11 3" />
                        <path d="M5 3h6v6" />
                      </svg>
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
