import {
  useState,
  useRef,
  useEffect,
  type CSSProperties,
  type ReactNode,
} from "react";
import { gsap } from "gsap";
import "./BubbleMenu.css";
import { useSfxEnabled, play } from "@/lib/sfx";


export interface BubbleMenuItem {
  label: string;
  href?: string;
  onClick?: () => void;
  ariaLabel?: string;
  rotation?: number;
  hoverStyles?: { bgColor?: string; textColor?: string };
}

export interface BubbleMenuProps {
  logo?: ReactNode | string;
  logoHref?: string;
  onMenuClick?: (open: boolean) => void;
  className?: string;
  style?: CSSProperties;
  menuAriaLabel?: string;
  useFixedPosition?: boolean;
  items?: BubbleMenuItem[];
  animationEase?: string;
  animationDuration?: number;
  staggerDelay?: number;
}

const DEFAULT_ITEMS: BubbleMenuItem[] = [
  { label: "home", href: "#", rotation: -8 },
  { label: "about", href: "#", rotation: 8 },
];

export default function BubbleMenu({
  logo,
  logoHref,
  onMenuClick,
  className,
  style,
  menuAriaLabel = "Toggle menu",
  useFixedPosition = false,
  items,
  animationEase = "back.out(1.5)",
  animationDuration = 0.5,
  staggerDelay = 0.12,
}: BubbleMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const bubblesRef = useRef<(HTMLElement | null)[]>([]);
  const labelRefs = useRef<(HTMLElement | null)[]>([]);

  const menuItems = items?.length ? items : DEFAULT_ITEMS;
  const containerClassName = [
    "bubble-menu",
    useFixedPosition ? "fixed" : "absolute",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const handleToggle = () => {
    const next = !isMenuOpen;
    if (next) setShowOverlay(true);
    setIsMenuOpen(next);
    onMenuClick?.(next);
  };

  useEffect(() => {
    const overlay = overlayRef.current;
    const bubbles = bubblesRef.current.filter(Boolean) as HTMLElement[];
    const labels = labelRefs.current.filter(Boolean) as HTMLElement[];
    if (!overlay || !bubbles.length) return;

    if (isMenuOpen) {
      gsap.set(overlay, { display: "flex" });
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.set(bubbles, { scale: 0, transformOrigin: "50% 50%" });
      gsap.set(labels, { y: 24, autoAlpha: 0 });
      bubbles.forEach((bubble, i) => {
        const delay = i * staggerDelay + gsap.utils.random(-0.05, 0.05);
        const tl = gsap.timeline({ delay });
        tl.to(bubble, {
          scale: 1,
          duration: animationDuration,
          ease: animationEase,
        });
        if (labels[i]) {
          tl.to(
            labels[i],
            {
              y: 0,
              autoAlpha: 1,
              duration: animationDuration,
              ease: "power3.out",
            },
            `-=${animationDuration * 0.9}`,
          );
        }
      });
    } else if (showOverlay) {
      gsap.killTweensOf([...bubbles, ...labels]);
      gsap.to(labels, { y: 24, autoAlpha: 0, duration: 0.2, ease: "power3.in" });
      gsap.to(bubbles, {
        scale: 0,
        duration: 0.2,
        ease: "power3.in",
        onComplete: () => {
          gsap.set(overlay, { display: "none" });
          setShowOverlay(false);
        },
      });
    }
  }, [isMenuOpen, showOverlay, animationEase, animationDuration, staggerDelay]);

  useEffect(() => {
    const onResize = () => {
      if (!isMenuOpen) return;
      const isDesktop = window.innerWidth >= 900;
      bubblesRef.current.forEach((el, i) => {
        const item = menuItems[i];
        if (el && item) {
          const rot = isDesktop ? item.rotation ?? 0 : 0;
          gsap.set(el, { rotation: rot });
        }
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isMenuOpen, menuItems]);

  return (
    <>
      <nav className={containerClassName} style={style} aria-label="Main">
        <div className="bubble logo-bubble" aria-label="Logo">
          {logoHref ? (
            <a
              href={logoHref}
              target="_blank"
              rel="noopener noreferrer"
              className="logo-content"
              aria-label="WZRD.tech"
            >
              {typeof logo === "string" ? (
                <img src={logo} alt="WZRD" className="bubble-logo" />
              ) : (
                logo
              )}
            </a>
          ) : (
            <span className="logo-content">
              {typeof logo === "string" ? (
                <img src={logo} alt="Logo" className="bubble-logo" />
              ) : (
                logo
              )}
            </span>
          )}
        </div>
        <SfxToggleBubble />
        <button
          type="button"
          className={`bubble toggle-bubble menu-btn ${isMenuOpen ? "open" : ""}`}
          onClick={handleToggle}
          aria-label={menuAriaLabel}
          aria-pressed={isMenuOpen}
          data-cuelume-press
        >
          <span className="menu-line" />
          <span className="menu-line" />
        </button>
      </nav>


      {showOverlay && (
        <div
          ref={overlayRef}
          className={`bubble-menu-items ${useFixedPosition ? "fixed" : "absolute"}`}
          aria-hidden={!isMenuOpen}
        >
          <ul className="pill-list" role="menu">
            {menuItems.map((item, idx) => {
              const styleVars = {
                ["--item-rot" as string]: `${item.rotation ?? 0}deg`,
                ["--hover-bg" as string]: item.hoverStyles?.bgColor ?? "#f3f4f6",
                ["--hover-color" as string]:
                  item.hoverStyles?.textColor ?? "#111",
              } as CSSProperties;

              const inner = (
                <span
                  className="pill-label"
                  ref={(el) => {
                    labelRefs.current[idx] = el;
                  }}
                >
                  {item.label}
                </span>
              );

              return (
                <li key={`${item.label}-${idx}`} className="pill-col" role="none">
                  {item.href ? (
                    <a
                      role="menuitem"
                      href={item.href}
                      aria-label={item.ariaLabel ?? item.label}
                      className="pill-link"
                      style={styleVars}
                      ref={(el) => {
                        bubblesRef.current[idx] = el;
                      }}
                      onClick={(e) => {
                        if (item.onClick) {
                          e.preventDefault();
                          item.onClick();
                        }
                      }}
                    >
                      {inner}
                    </a>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      aria-label={item.ariaLabel ?? item.label}
                      className="pill-link"
                      style={styleVars}
                      ref={(el) => {
                        bubblesRef.current[idx] = el;
                      }}
                      onClick={() => item.onClick?.()}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );
}

function SfxToggleBubble() {
  const [enabled, setEnabled] = useSfxEnabled();
  return (
    <button
      type="button"
      className="bubble toggle-bubble sfx-btn"
      onClick={() => {
        const next = !enabled;
        setEnabled(next);
        if (next) play("toggle");
      }}
      aria-label={enabled ? "Mute sound effects" : "Enable sound effects"}
      aria-pressed={enabled}
      title="Sound FX"
    >
      {enabled ? (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <line x1="22" y1="9" x2="16" y2="15" />
          <line x1="16" y1="9" x2="22" y2="15" />
        </svg>
      )}
    </button>
  );
}

