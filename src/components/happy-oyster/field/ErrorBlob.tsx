import { useId } from "react";
import type { WorldSession } from "@/components/happy-oyster/use-world-session";
import { HO } from "./tokens";
import { useBlobShape } from "./useBlobShape";
import { CreamPill, DarkPill } from "./pill";

export function ErrorBlob({ session }: { session: WorldSession }) {
  const uid = useId().replace(/:/g, "");
  const size = 520;
  const r = size / 2;
  const path = useBlobShape(3311, r, 12, 0.22);
  const view = session.view;
  if (view.kind !== "error") return null;

  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 55 }}>
      <div style={{ position: "relative", width: size, maxWidth: "92vw", aspectRatio: "1 / 1" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 30px 80px rgba(180,20,20,.4))" }}>
          <defs>
            <pattern id={`erp-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="transparent" />
              <rect x="0" y="0" width="2" height="2" fill="#3d0808" />
            </pattern>
          </defs>
          <path d={path} fill="#1a0808" />
          <path d={path} fill="none" stroke={`url(#erp-${uid})`} strokeWidth={14} strokeLinejoin="round" />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            padding: "18% 14%",
            color: HO.creamPill,
            textAlign: "center",
          }}
        >
          <span style={{ ...HO.monoLabel, fontSize: 11, color: "#ff8b7a" }}>
            {view.buildFailed ? "World build failed" : "Something broke"}
          </span>
          <p style={{ fontFamily: HO.display, fontSize: 14, lineHeight: 1.55, color: "rgba(255,180,168,.9)", margin: 0, maxWidth: 340 }}>
            {view.message}
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            <DarkPill onClick={session.exit}>Back to worlds</DarkPill>
            <CreamPill onClick={session.retry}>Try again →</CreamPill>
          </div>
        </div>
      </div>
    </div>
  );
}
