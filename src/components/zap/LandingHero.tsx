import LiquidEther from "@/components/reactbits/LiquidEther";
import Strands from "@/components/reactbits/Strands";
import GlassSurface from "@/components/reactbits/GlassSurface";
import BubbleMenu from "@/components/reactbits/BubbleMenu";
import ChooseReality from "@/components/zap/ChooseReality";
import ModesSection from "@/components/zap/ModesSection";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";

interface LandingHeroProps {
  onEnter: () => void;
  disabled?: boolean;
}

export default function LandingHero({ onEnter, disabled }: LandingHeroProps) {
  const menuItems = [
    {
      label: "live",
      onClick: onEnter,
      ariaLabel: "Go Live",
      rotation: -8,
      hoverStyles: { bgColor: "#22d3ee", textColor: "#001018" },
    },
    {
      label: "presets",
      href: "#presets",
      ariaLabel: "Presets",
      rotation: 8,
      hoverStyles: { bgColor: "#a855f7", textColor: "#ffffff" },
    },
    {
      label: "library",
      href: "/library",
      ariaLabel: "Library",
      rotation: 8,
      hoverStyles: { bgColor: "#f472b6", textColor: "#1a0010" },
    },
    {
      label: "wzrd.tech",
      href: "https://wzrd.tech",
      ariaLabel: "WZRD.tech",
      rotation: -8,
      hoverStyles: { bgColor: "#000000", textColor: "#ffffff" },
    },
  ];

  return (
    <div className="relative w-full bg-[#050505] text-[#FAFAFA]">
      {/* Bubble menu — pinned top */}
      <BubbleMenu
        useFixedPosition
        logo={wzrdLogo.url}
        menuAriaLabel="Toggle navigation"
        items={menuItems}
        animationDuration={0.5}
        staggerDelay={0.1}
      />

      {/* HERO */}
      <div className="relative min-h-[100dvh] w-full overflow-hidden">
        {/* LiquidEther background */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <LiquidEther
            colors={["#22d3ee", "#a855f7", "#f472b6"]}
            mouseForce={22}
            cursorSize={120}
            resolution={0.5}
            autoDemo
            autoSpeed={0.55}
            autoIntensity={2.4}
            takeoverDuration={0.3}
            autoResumeDelay={2000}
            autoRampDuration={0.8}
          />
        </div>
        {/* Vignette */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, rgba(5,5,5,0.7) 75%, #050505 100%)",
          }}
        />

        <div className="relative mx-auto flex min-h-[100dvh] max-w-6xl flex-col items-center justify-center px-6 py-24">
          <span className="mb-8 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] text-white/70 backdrop-blur">
            ZAP · LIVE
          </span>

          {/* Strands centerpiece */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[820px] max-w-[95vw] -translate-x-1/2 -translate-y-[58%]">
            <Strands
              colors={["#22d3ee", "#a855f7", "#f43f5e", "#eab308"]}
              count={5}
              speed={0.55}
              intensity={0.75}
              glow={2.8}
              saturation={1.4}
              scale={1.3}
            />
          </div>

          {/* Hero copy */}
          <h1 className="relative z-10 max-w-4xl text-center text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            Your webcam
            <br />
            <span className="bg-gradient-to-r from-[#67e8f9] via-[#c084fc] to-[#f472b6] bg-clip-text text-transparent">
              is the timeline.
            </span>
          </h1>

          <p className="relative z-10 mt-6 max-w-xl text-center text-base text-white/60 md:text-lg">
            A realtime streaming video editor. Prompt, gesture, or reference —
            Lucy 2.5 repaints every frame in under a second.
          </p>

          {/* Glass CTA */}
          <div className="relative z-10 mt-12">
            <GlassSurface
              width={240}
              height={72}
              borderRadius={36}
              distortionScale={-140}
              blur={9}
              backgroundOpacity={0.08}
              saturation={1.2}
            >
              <button
                onClick={onEnter}
                disabled={disabled}
                className="group flex h-full w-full items-center justify-center gap-3 rounded-full px-6 text-base font-medium text-white disabled:opacity-50"
              >
                <span className="tracking-wide">
                  {disabled ? "Loading…" : "Zap Live"}
                </span>
                <span
                  aria-hidden
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-[1px] group-hover:bg-white/20"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 11L11 3" />
                    <path d="M5 3h6v6" />
                  </svg>
                </span>
              </button>
            </GlassSurface>
          </div>

          <p className="relative z-10 mt-6 text-xs text-white/40">
            Uses your camera. Runs entirely in your browser.
          </p>
        </div>
      </div>

      {/* Choose your reality */}
      <ChooseReality onEnter={onEnter} disabled={disabled} />

      {/* Modes — curved ring of edit modes */}
      <ModesSection />
    </div>
  );
}
