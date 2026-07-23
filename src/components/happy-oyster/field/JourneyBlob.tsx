import { useId } from "react";
import type { WorldSession } from "@/components/happy-oyster/use-world-session";
import { HO } from "./tokens";
import { useBlobShape } from "./useBlobShape";
import { MonoChip } from "./pill";
import { DarkPill } from "./pill";

export function JourneyBlob({ session }: { session: WorldSession }) {
  const uid = useId().replace(/:/g, "");
  const size = 560;
  const r = size / 2;
  const path = useBlobShape(4820, r, 12, 0.14);
  const intent = session.intent;
  const modeLabel = intent?.mode === "directing" ? "Directing" : "Adventure";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        zIndex: 55,
        pointerEvents: "none",
      }}
    >
      <div style={{ position: "relative", width: size, maxWidth: "92vw", aspectRatio: "1 / 1", pointerEvents: "auto" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 30px 80px rgba(0,0,0,.55))" }}>
          <defs>
            <clipPath id={`jc-${uid}`}>
              <path d={path} />
            </clipPath>
            <pattern id={`jp-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="transparent" />
              <rect x="0" y="0" width="2" height="2" fill={HO.ink} />
            </pattern>
          </defs>
          <path d={path} fill={HO.ink} />
          {session.seedFrame ? (
            <image
              href={session.seedFrame}
              x="0"
              y="0"
              width={size}
              height={size}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#jc-${uid})`}
              opacity={0.28}
            />
          ) : null}
          <path d={path} fill="none" stroke={`url(#jp-${uid})`} strokeWidth={14} strokeLinejoin="round" />
        </svg>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: "18% 16%",
            color: HO.creamPill,
            textAlign: "center",
          }}
        >
          {intent ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <MonoChip>{modeLabel}</MonoChip>
              <h2 style={{ fontFamily: HO.display, fontWeight: 800, letterSpacing: "-0.02em", fontSize: 26, margin: 0, color: "#fff" }}>
                {intent.title}
              </h2>
            </div>
          ) : null}

          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10, minWidth: 240 }}>
            {session.journey.map((step) => (
              <li key={step.key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <StatusDot status={step.status} />
                <span
                  style={{
                    ...HO.monoLabel,
                    fontSize: 11,
                    color:
                      step.status === "active"
                        ? HO.gold
                        : step.status === "done"
                          ? "rgba(241,234,213,.75)"
                          : "rgba(241,234,213,.3)",
                  }}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ul>

          <DarkPill onClick={session.exit}>Cancel</DarkPill>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: "pending" | "active" | "done" }) {
  if (status === "done") {
    return (
      <span style={{ width: 14, height: 14, display: "inline-grid", placeItems: "center" }}>
        <svg viewBox="0 0 14 14" width="14" height="14" fill="none" stroke={HO.gold} strokeWidth="2">
          <path d="M3 7.5 6 10.5 11.5 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  if (status === "active") {
    return (
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: 9999,
          border: `2px solid ${HO.gold}`,
          borderTopColor: "transparent",
          animation: "ho-spin 900ms linear infinite",
        }}
      >
        <style>{`@keyframes ho-spin { to { transform: rotate(360deg) } }`}</style>
      </span>
    );
  }
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: 9999,
        background: "rgba(241,234,213,.3)",
        margin: 3,
      }}
    />
  );
}
