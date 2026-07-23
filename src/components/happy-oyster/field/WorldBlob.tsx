import { useState, useId, type CSSProperties } from "react";
import type { FeaturedWorld } from "@/lib/happy-oyster/worlds";
import { HO } from "./tokens";
import { useBlobShape } from "./useBlobShape";
import { HoverChip } from "./HoverChip";

interface Props {
  world: FeaturedWorld;
  x: number;
  y: number;
  size: number;
  seed: number;
  decorative?: boolean;
  onActivate?: (world: FeaturedWorld) => void;
}

// A blob-shaped hole in the cloud layer: the world image is clipped inside an
// irregular 8–10-point radial spline, and a chunky ordered-dither ring around
// the rim bites the image edge back into the surrounding clouds.
export function WorldBlob({
  world,
  x,
  y,
  size,
  seed,
  decorative = false,
  onActivate,
}: Props) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const uid = useId().replace(/:/g, "");
  const r = size / 2;
  const path = useBlobShape(seed, r, 10, decorative ? 0.18 : 0.24);
  const opacity = decorative ? 0.72 : 1;

  const style: CSSProperties = {
    position: "absolute",
    left: x - r,
    top: y - r,
    width: size,
    height: size,
    cursor: "pointer",
    opacity,
    transform: hover || focus ? "scale(1.04)" : "scale(1)",
    transition: "transform 260ms cubic-bezier(.32,.72,0,1), filter 260ms",
    filter:
      hover || focus
        ? `drop-shadow(${HO.goldGlow})`
        : "drop-shadow(0 8px 24px rgba(0,0,0,.35))",
    background: "transparent",
    border: "none",
    padding: 0,
    outline: "none",
  };

  return (
    <button
      type="button"
      aria-label={world.title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      onClick={() => onActivate?.(world)}
      style={style}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
        <defs>
          <clipPath id={`clip-${uid}`}>
            <path d={path} />
          </clipPath>
          <pattern
            id={`dither-${uid}`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
            <rect width="4" height="4" fill={HO.paper} />
            <rect x="0" y="0" width="2" height="2" fill={HO.ink} />
            <rect x="2" y="2" width="2" height="2" fill={HO.ink} />
          </pattern>
          <pattern
            id={`dither-sparse-${uid}`}
            width="4"
            height="4"
            patternUnits="userSpaceOnUse"
          >
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
            clipPath={`url(#clip-${uid})`}
          />
        ) : (
          <path d={path} fill={HO.cloudDark} />
        )}
        {/* Rim: solid dark stroke immediately inside, then a wider dithered pattern
            stroke overlapping the edge to make the "bite" into the clouds. */}
        <path
          d={path}
          fill="none"
          stroke={`url(#dither-sparse-${uid})`}
          strokeWidth={12}
          strokeLinejoin="round"
        />
        <path
          d={path}
          fill="none"
          stroke={HO.ink}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </svg>

      {(hover || focus) && !decorative ? (
        <HoverChip label={world.title} />
      ) : null}
    </button>
  );
}
