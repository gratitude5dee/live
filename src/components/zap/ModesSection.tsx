import { useCallback, useState } from "react";
import InfiniteMenu, { type InfiniteMenuItem } from "@/components/reactbits/InfiniteMenu";
import ShinyText from "@/components/reactbits/ShinyText";

const MODES: InfiniteMenuItem[] = [
  {
    title: "Object Add-In",
    description:
      "Drop in props, gear, or accessories. Lucy paints them into every frame with matched lighting and grain.",
    image:
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=900&q=70",
    link: "#presets",
  },
  {
    title: "Character Switch",
    description:
      "Replace the person on camera with a reference identity while your motion drives the take.",
    image:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=900&q=70",
    link: "#presets",
  },
  {
    title: "Background Swap",
    description:
      "Teleport into any set. Stadiums, studios, neon streets. Foreground stays locked.",
    image:
      "https://images.unsplash.com/photo-1508614589041-895b88991e3e?auto=format&fit=crop&w=900&q=70",
    link: "#presets",
  },
  {
    title: "Style Transfer",
    description:
      "Recolor the entire frame into a look — film stock, painting, anime, cyberpunk.",
    image:
      "https://images.unsplash.com/photo-1519692933481-e162a57d6721?auto=format&fit=crop&w=900&q=70",
    link: "#presets",
  },
  {
    title: "Weather Shift",
    description:
      "Add rain, snow, fog, or golden hour. Environmental effects propagate through the scene in realtime.",
    image:
      "https://images.unsplash.com/photo-1500673922987-e212871fec22?auto=format&fit=crop&w=900&q=70",
    link: "#presets",
  },
  {
    title: "Lighting Mood",
    description:
      "Repaint the light. Warm sunset, cold moonlight, harsh stadium, soft studio.",
    image:
      "https://images.unsplash.com/photo-1470813740244-df37b8c1edcb?auto=format&fit=crop&w=900&q=70",
    link: "#presets",
  },
];

export default function ModesSection() {
  const [active, setActive] = useState<InfiniteMenuItem>(MODES[0]);
  const onActive = useCallback((it: InfiniteMenuItem) => {
    setActive(it);
    void import("@/lib/sfx").then(({ play }) => play("sparkle"));
  }, []);


  return (
    <section
      id="modes"
      className="relative w-full overflow-hidden bg-[#050505] pb-24 pt-20 md:pb-40 md:pt-32"
    >
      <div
        className="pointer-events-none absolute inset-x-0 -top-24 h-24"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(5,5,5,0.9), #050505)",
        }}
      />

      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-10 flex flex-col items-center text-center md:mb-16">
          <span className="mb-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] text-white/70 backdrop-blur">
            02 — Modes
          </span>
          <h2 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
            <ShinyText
              text="Every reality has a lever."
              color="#7c8291"
              shineColor="#ffffff"
              speed={5}
              spread={140}
            />
          </h2>
          <p className="mt-4 max-w-xl text-sm md:text-base">
            <ShinyText
              text="Drag the sphere. Every disc is a way Lucy can rewrite your feed in realtime."
              color="#6b7280"
              shineColor="#e5e7eb"
              speed={6}
              spread={160}
            />
          </p>
        </div>

        <div className="relative mx-auto h-[440px] w-full sm:h-[560px] lg:h-[680px]">
          <InfiniteMenu items={MODES} scale={1.0} onActiveItem={onActive} />
        </div>

        <div className="mx-auto mt-10 max-w-2xl text-center md:mt-14">
          <div key={active.title} className="animate-[fade-in_0.5s_cubic-bezier(0.32,0.72,0,1)]">
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.32em] text-white/40">
              Active mode
            </div>
            <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">
              <ShinyText
                text={active.title ?? ""}
                color="#a3a8b3"
                shineColor="#ffffff"
                speed={4}
                spread={130}
              />
            </h3>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/60 md:text-base">
              {active.description}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
