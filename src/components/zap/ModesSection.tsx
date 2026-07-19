import { useState } from "react";
import PixelCard from "@/components/reactbits/PixelCard";

type ModeVariant = "blue" | "pink" | "yellow" | "default";

const MODES: Array<{
  text: string;
  description: string;
  image: string;
  variant: ModeVariant;
}> = [
  {
    text: "Object Add-In",
    description:
      "Drop in props, gear, or accessories. Lucy paints them into every frame with matched lighting and grain.",
    image:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=70",
    variant: "blue",
  },
  {
    text: "Character Switch",
    description:
      "Replace the person on camera with a reference identity — face, hair, wardrobe — while your motion drives the take.",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=70",
    variant: "pink",
  },
  {
    text: "Background Swap",
    description:
      "Teleport into any set. Stadiums, studios, neon streets. Foreground stays locked, everything behind you rewrites.",
    image:
      "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=70",
    variant: "default",
  },
  {
    text: "Style Transfer",
    description:
      "Recolor the entire frame into a look — film stock, painting, anime, cyberpunk — without losing your performance.",
    image:
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1200&q=70",
    variant: "yellow",
  },
  {
    text: "Weather Shift",
    description:
      "Add rain, snow, fog, or golden hour. Environmental effects propagate through the scene in realtime.",
    image:
      "https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=1200&q=70",
    variant: "blue",
  },
  {
    text: "Lighting Mood",
    description:
      "Repaint the light. Warm sunset, cold moonlight, harsh stadium, soft studio — same face, new atmosphere.",
    image:
      "https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?auto=format&fit=crop&w=1200&q=70",
    variant: "pink",
  },
];

export default function ModesSection() {
  const [active, setActive] = useState(0);
  const current = MODES[active];

  return (
    <section
      id="modes"
      className="relative w-full overflow-hidden bg-[#050505] pb-32 pt-24 md:pb-40 md:pt-32"
    >
      {/* top fade */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-24"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(5,5,5,0.9), #050505)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 flex flex-col items-center text-center md:mb-20">
          <span className="mb-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] text-white/70 backdrop-blur">
            02 — Modes
          </span>
          <h2 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl">
            Every reality has a{" "}
            <span className="bg-gradient-to-r from-[#67e8f9] via-[#c084fc] to-[#f472b6] bg-clip-text text-transparent">
              lever.
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-sm text-white/50 md:text-base">
            Six ways Lucy rewrites your feed. Hover any card to preview the
            texture — click to pin it as the active mode.
          </p>
        </div>

        {/* Grid of Double-Bezel PixelCards */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODES.map((m, i) => {
            const isActive = i === active;
            return (
              <button
                key={m.text}
                type="button"
                onClick={() => setActive(i)}
                className={`group relative block rounded-[2rem] p-1.5 text-left transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] ${
                  isActive
                    ? "bg-white/[0.07] ring-1 ring-white/25"
                    : "bg-white/[0.03] ring-1 ring-white/10 hover:bg-white/[0.05] hover:ring-white/20"
                }`}
                style={{
                  boxShadow: isActive
                    ? "0 20px 60px -30px rgba(192, 132, 252, 0.4)"
                    : undefined,
                }}
                aria-pressed={isActive}
              >
                <div
                  className="relative aspect-[4/5] w-full overflow-hidden bg-[#0a0a0a]"
                  style={{ borderRadius: "calc(2rem - 0.375rem)" }}
                >
                  {/* PixelCard fills the surface; canvas sits behind image */}
                  <PixelCard
                    variant={m.variant}
                    className="pixel-card--fill absolute inset-0"
                  >
                    <span className="sr-only">{m.text}</span>
                  </PixelCard>

                  {/* Image on top of pixel canvas, dims on hover to reveal shimmer */}
                  <img
                    src={m.image}
                    alt={m.text}
                    loading="lazy"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-[1.04] group-hover:opacity-40"
                    style={{ opacity: 0.92 }}
                  />

                  {/* Bottom scrim */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#050505] via-[#050505]/70 to-transparent" />

                  {/* Label block */}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5">
                    <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.32em] text-white/50">
                      0{i + 1} / 0{MODES.length}
                    </div>
                    <div className="text-lg font-semibold tracking-tight text-white md:text-xl">
                      {m.text}
                    </div>
                  </div>

                  {/* Active dot */}
                  {isActive && (
                    <span className="absolute right-4 top-4 h-2 w-2 rounded-full bg-[#c084fc] shadow-[0_0_12px_rgba(192,132,252,0.9)]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Caption row */}
        <div className="mx-auto mt-14 max-w-3xl text-center">
          <div
            key={active}
            className="animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)]"
          >
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.32em] text-white/40">
              Active mode
            </div>
            <h3 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
              {current.text}
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
              {current.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
