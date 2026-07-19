import { useEffect, useState } from "react";
import Prism from "@/components/reactbits/Prism";
import ShinyText from "@/components/reactbits/ShinyText";
import wzrdLogo from "@/assets/wzrd-logo.png.asset.json";

interface LinkItem {
  label: string;
  href: string;
  external?: boolean;
}

const productLinks: LinkItem[] = [
  { label: "Go Live", href: "#top" },
  { label: "Presets", href: "#choose-reality" },
  { label: "Modes", href: "#modes" },
  { label: "Library", href: "/library" },
];

const companyLinks: LinkItem[] = [
  { label: "WZRD.tech", href: "https://wzrd.tech", external: true },
  { label: "Contact", href: "mailto:hello@wzrd.tech" },
  { label: "Twitter / X", href: "https://x.com/wzrdtech", external: true },
];

const legalLinks: LinkItem[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
];

function LinkCol({ title, links }: { title: string; links: LinkItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-white/40">
        <ShinyText text={title} color="#6b7280" shineColor="#ffffff" speed={7} spread={140} />
      </div>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noreferrer" : undefined}
              className="group inline-flex items-center gap-1.5 text-sm text-white/70 transition-colors hover:text-white"
            >
              <ShinyText text={l.label} color="#a1a7b3" shineColor="#ffffff" speed={6} spread={160} />
              {l.external && (
                <span aria-hidden className="text-white/30 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                  ↗
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SiteFooter() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  return (
    <footer className="relative isolate w-full overflow-hidden bg-black text-white">
      {/* Prism backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        {reduceMotion ? (
          <div
            className="h-full w-full"
            style={{
              background:
                "radial-gradient(ellipse at 50% 20%, rgba(34,211,238,0.25), transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(168,85,247,0.2), transparent 65%), #000",
            }}
          />
        ) : (
          <Prism
            animationType="3drotate"
            timeScale={0.35}
            scale={3.2}
            baseWidth={5.5}
            height={3.5}
            glow={1.1}
            noise={0.35}
            hueShift={-0.25}
            colorFrequency={1}
            bloom={1.1}
            suspendWhenOffscreen
          />
        )}
        {/* readability wash */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.8) 100%)",
          }}
        />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-14 px-6 pb-10 pt-20 md:pt-28">
        {/* Top row */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-12">
          {/* Brand */}
          <div className="md:col-span-5">
            <a href="#top" className="inline-flex items-center gap-3">
              <img
                src={wzrdLogo.url}
                alt="WZRD.tech"
                className="h-10 w-auto select-none drop-shadow-[0_0_18px_rgba(76,140,255,0.55)]"
                draggable={false}
              />
            </a>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/70">
              <ShinyText
                text={"Bend your reality. Realtime video, repainted every frame by Zaps! live by WZRD Tech, Inc."}
                color="#8a8f98"
                shineColor="#ffffff"
                speed={7}
                spread={160}
              />
            </p>
            <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-white/40">
              Powered by Lucy 2.5 · fal.ai
            </p>
          </div>

          {/* Nav columns */}
          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3 md:col-span-7">
            <LinkCol title="Product" links={productLinks} />
            <LinkCol title="Company" links={companyLinks} />
            <LinkCol title="Legal" links={legalLinks} />
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col items-start justify-between gap-3 border-t border-white/10 pt-6 text-xs text-white/50 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} WZRD.tech — All realities reserved.</span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            Live build
          </span>
        </div>
      </div>
    </footer>
  );
}
