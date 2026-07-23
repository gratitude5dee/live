import { useEffect, useId } from "react";
import type { FeaturedWorld } from "@/lib/happy-oyster/worlds";
import { HO } from "./tokens";
import { useBlobShape } from "./useBlobShape";
import { CreamPill, MonoChip } from "./pill";

interface Props {
  world: FeaturedWorld;
  onEnter: () => void;
  onClose: () => void;
}

export function FocusBlob({ world, onEnter, onClose }: Props) {
  const uid = useId().replace(/:/g, "");
  const size = 520;
  const r = size / 2;
  const path = useBlobShape(world.key.length * 137 + 42, r, 12, 0.2);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const modeLabel = world.mode === 2 ? "Directing" : "Adventure";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        zIndex: 55,
        background: "rgba(236,229,211,.35)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
        }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            position: "absolute",
            top: -4,
            right: -32,
            background: "transparent",
            border: "none",
            color: HO.ink,
            fontFamily: HO.mono,
            fontSize: 20,
            cursor: "pointer",
            opacity: 0.55,
          }}
        >
          ×
        </button>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <h1
            style={{
              fontFamily: HO.display,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontSize: 44,
              lineHeight: 1,
              margin: 0,
              color: "#fff",
              textShadow: "0 6px 24px rgba(0,0,0,.5)",
            }}
          >
            {world.title}
          </h1>
          <MonoChip>{modeLabel}</MonoChip>
        </div>

        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          style={{
            display: "block",
            filter: `drop-shadow(${HO.goldGlow}) drop-shadow(0 30px 60px rgba(0,0,0,.45))`,
          }}
        >
          <defs>
            <clipPath id={`fc-${uid}`}>
              <path d={path} />
            </clipPath>
            <pattern id={`fp-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="transparent" />
              <rect x="0" y="0" width="2" height="2" fill={HO.ink} />
            </pattern>
          </defs>
          {world.image ? (
            <image
              href={world.image}
              x="0"
              y="0"
              width={size}
              height={size}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#fc-${uid})`}
            />
          ) : (
            <path d={path} fill={HO.cloudDark} />
          )}
          <path d={path} fill="none" stroke={`url(#fp-${uid})`} strokeWidth={14} strokeLinejoin="round" />
          <path d={path} fill="none" stroke={HO.ink} strokeWidth={2} strokeLinejoin="round" />
        </svg>

        <CreamPill onClick={onEnter}>Enter world →</CreamPill>
      </div>
    </div>
  );
}
