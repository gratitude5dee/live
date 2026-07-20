import { useEffect, useState } from "react";
import SiteFooter from "@/components/zap/SiteFooter";
import LiquidEther from "@/components/reactbits/LiquidEther";
import Strands from "@/components/reactbits/Strands";
import GlassSurface from "@/components/reactbits/GlassSurface";
import BubbleMenu from "@/components/reactbits/BubbleMenu";
import ASCIIText from "@/components/reactbits/ASCIIText";
import GhostCursor from "@/components/reactbits/GhostCursor";
import ShinyText from "@/components/reactbits/ShinyText";
import ChooseReality from "@/components/zap/ChooseReality";
import ModesSection from "@/components/zap/ModesSection";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";
import { warmVision } from "@/lib/zap/mediapipe";

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

  // Detect touch devices to disable the heavy ghost cursor trail on mobile
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Warm-start MediaPipe on landing mount (idle) so the WASM + two ~10MB
  // model downloads finish while the user is reading the hero, not
  // serialized behind getUserMedia + Lucy signaling on Enter.
  useEffect(() => {
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    const kick = () => { void warmVision().catch(() => {}); };
    if (idle) idle(kick);
    else setTimeout(kick, 400);
  }, []);

  // Also kick on first pointer-down on Enter — cheap insurance against
  // the idle callback getting deferred on low-power devices.
  const armWarm = () => { void warmVision().catch(() => {}); };


  return (
    <div className="relative w-full bg-[#050505] text-[#FAFAFA]">
      {/* Ghost cursor trail — desktop only */}
      {!isTouch && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0"
          style={{ zIndex: 40 }}
        >
          <GhostCursor
            color="#B497CF"
            brightness={1}
            edgeIntensity={0}
            trailLength={50}
            inertia={0.5}
            grainIntensity={0.05}
            bloomStrength={0.1}
            bloomRadius={1.0}
            bloomThreshold={0.025}
            fadeDelayMs={1000}
            fadeDurationMs={1500}
            mixBlendMode="screen"
            zIndex={40}
          />
        </div>
      )}
      {/* HERO + NAV wrapper — shared background spans behind nav */}
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

        {/* Bubble menu — pinned top, overlaid on background */}
        <BubbleMenu
          useFixedPosition
          logo={wzrdLogo.url}
          logoHref="https://wzrd.tech"
          menuAriaLabel="Toggle navigation"
          items={menuItems}
          animationDuration={0.5}
          staggerDelay={0.1}
        />

        <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col items-center justify-center px-6 py-20 md:py-24">
          {/* Strands centerpiece */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[560px] max-w-[95vw] -translate-x-1/2 -translate-y-[58%] md:h-[520px] md:w-[820px]">
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

          {/* Hero — ASCII wordmark */}
          <h1 className="sr-only">Zap Live — realtime video editor</h1>
          <div className="relative z-10 h-[200px] w-full max-w-4xl sm:h-[260px] md:h-[380px]">
            <ASCIIText text="Zap!" enableWaves asciiFontSize={8} planeBaseHeight={8} />
          </div>

          {/* Glass CTA — directly beneath the wordmark */}
          <div className="relative z-10 mt-6 md:mt-8">
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
                onPointerDown={armWarm}
                disabled={disabled}
                data-cuelume-press="press"
                data-cuelume-release="release"
                className="group flex h-full w-full items-center justify-center gap-3 rounded-full px-6 text-base font-medium text-white disabled:opacity-50"
              >

                <span className="tracking-wide">
                  {disabled ? "Loading…" : "Computah! Activate"}
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

          <span className="relative z-10 mt-4 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.28em] backdrop-blur">
            <ShinyText text="ZAP · LIVE" color="#8a8f98" shineColor="#ffffff" speed={5} spread={140} />
          </span>

          <p className="relative z-10 mt-6 max-w-xl whitespace-pre-line px-2 text-center text-sm sm:text-base md:text-lg">
            <ShinyText
              text={"Create your reality in realtime with Zap!\nBuilt for streamers, digital shop sellers, and wizards looking to\nbend their reality."}
              color="#7c8291"
              shineColor="#ffffff"
              speed={6}
              spread={150}
            />
          </p>

          <p className="relative z-10 mt-6 text-xs text-white/40">
            Uses your camera. Runs entirely in your browser.
          </p>

        </div>
      </div>

      {/* Choose your reality */}
      <div id="choose-reality">
        <ChooseReality onEnter={onEnter} disabled={disabled} />
      </div>

      {/* Modes — curved ring of edit modes */}
      <div id="modes">
        <ModesSection />
      </div>

      {/* Footer */}
      <SiteFooter />
    </div>
  );
}
