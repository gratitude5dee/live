import { useState } from "react";
import CircularGallery from "@/components/reactbits/CircularGallery";

const MODES = [
  {
    text: "Object Add-In",
    description:
      "Drop in props, gear, or accessories. Lucy paints them into every frame with matched lighting and grain.",
    image:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1200&q=70",
  },
  {
    text: "Character Switch",
    description:
      "Replace the person on camera with a reference identity — face, hair, wardrobe — while your motion drives the take.",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=70",
  },
  {
    text: "Background Swap",
    description:
      "Teleport into any set. Stadiums, studios, neon streets. Foreground stays locked, everything behind you rewrites.",
    image:
      "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=1200&q=70",
  },
  {
    text: "Style Transfer",
    description:
      "Recolor the entire frame into a look — film stock, painting, anime, cyberpunk — without losing your performance.",
    image:
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=1200&q=70",
  },
  {
    text: "Weather Shift",
    description:
      "Add rain, snow, fog, or golden hour. Environmental effects propagate through the scene in realtime.",
    image:
      "https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=1200&q=70",
  },
  {
    text: "Lighting Mood",
    description:
      "Repaint the light. Warm sunset, cold moonlight, harsh stadium, soft studio — same face, new atmosphere.",
    image:
      "https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?auto=format&fit=crop&w=1200&q=70",
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
      {/* section-top fade so it flows out of ChooseReality */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-24"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(5,5,5,0.9), #050505)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 flex flex-col items-center text-center md:mb-16">
          <span className="mb-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] text-white/70 backdrop-blur">
            Modes
          </span>
          <h2 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-white md:text-6xl">
            Every reality has a{" "}
            <span className="bg-gradient-to-r from-[#67e8f9] via-[#c084fc] to-[#f472b6] bg-clip-text text-transparent">
              lever.
            </span>
          </h2>
          <p className="mt-4 max-w-xl text-sm text-white/50 md:text-base">
            Six ways Lucy rewrites your feed. Scroll or drag the ring — pick a
            mode, then let a preset carry it.
          </p>
        </div>
      </div>

      {/* Full-bleed gallery */}
      <div className="relative h-[560px] w-full md:h-[640px]">
        <CircularGallery
          items={MODES.map((m) => ({ image: m.image, text: m.text }))}
          bend={3}
          borderRadius={0.06}
          textColor="#ffffff"
          scrollEase={0.02}
          font="bold 30px Geist"
          fontUrl="https://fonts.googleapis.com/css2?family=Geist:wght@500;700&display=swap"
          onActiveChange={setActive}
        />
        {/* Edge fades */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#050505] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#050505] to-transparent" />
      </div>

      {/* Caption row */}
      <div className="mx-auto mt-10 max-w-3xl px-6 text-center">
        <div
          key={active}
          className="animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)]"
        >
          <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.32em] text-white/40">
            0{active + 1} / 0{MODES.length}
          </div>
          <h3 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {current.text}
          </h3>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
            {current.description}
          </p>
        </div>
      </div>
    </section>
  );
}
