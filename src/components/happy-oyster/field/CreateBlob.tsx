import { useState, useId, type CSSProperties } from "react";
import { HO } from "./tokens";
import { useBlobShape } from "./useBlobShape";

// Special "+ CREATE YOUR OWN" dark blob in the field. Same organic shape as
// world blobs but pure ink fill with mono-caps label.
export function CreateBlob({
  x,
  y,
  size,
  seed,
  onClick,
}: {
  x: number;
  y: number;
  size: number;
  seed: number;
  onClick?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const uid = useId().replace(/:/g, "");
  const r = size / 2;
  const path = useBlobShape(seed, r, 10, 0.22);

  const style: CSSProperties = {
    position: "absolute",
    left: x - r,
    top: y - r,
    width: size,
    height: size,
    cursor: "pointer",
    transform: hover ? "scale(1.04)" : "scale(1)",
    transition: "transform 260ms cubic-bezier(.32,.72,0,1), filter 260ms",
    filter: hover
      ? `drop-shadow(${HO.goldGlow})`
      : "drop-shadow(0 8px 24px rgba(0,0,0,.4))",
    background: "transparent",
    border: "none",
    padding: 0,
    outline: "none",
  };

  return (
    <button
      type="button"
      aria-label="Create your own world"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={style}
    >
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: "block" }}>
        <defs>
          <pattern id={`ct-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
            <rect width="4" height="4" fill="transparent" />
            <rect x="0" y="0" width="2" height="2" fill={HO.ink} />
          </pattern>
        </defs>
        <path d={path} fill={HO.ink} />
        <path
          d={path}
          fill="none"
          stroke={`url(#ct-${uid})`}
          strokeWidth={12}
          strokeLinejoin="round"
        />
      </svg>
      <span
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          color: HO.creamPill,
          ...HO.monoLabel,
          fontSize: 12,
          padding: "0 16%",
          textAlign: "center",
          pointerEvents: "none",
          lineHeight: 1.35,
        }}
      >
        + Create your own
      </span>
    </button>
  );
}
