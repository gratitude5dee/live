import { useId } from "react";
import type { WorldSession } from "@/components/happy-oyster/use-world-session";
import { WorldIdChip } from "@/components/happy-oyster/ui";
import { HO } from "./tokens";
import { useBlobShape } from "./useBlobShape";
import { CreamPill, DarkPill, MonoChip } from "./pill";

export function EndBlob({ session }: { session: WorldSession }) {
  const uid = useId().replace(/:/g, "");
  const size = 560;
  const r = size / 2;
  const path = useBlobShape(7714, r, 12, 0.18);
  const worldId = session.client.worldState?.encrypted_world_id;
  const modeLabel = session.intent?.mode === "directing" ? "Directing" : "Adventure";

  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 55 }}>
      <div style={{ position: "relative", width: size, maxWidth: "92vw", aspectRatio: "1 / 1" }}>
        <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, filter: "drop-shadow(0 30px 80px rgba(0,0,0,.55))" }}>
          <defs>
            <pattern id={`ep-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="transparent" />
              <rect x="0" y="0" width="2" height="2" fill={HO.ink} />
            </pattern>
          </defs>
          <path d={path} fill={HO.ink} />
          <path d={path} fill="none" stroke={`url(#ep-${uid})`} strokeWidth={14} strokeLinejoin="round" />
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
            padding: "18% 16%",
            color: HO.creamPill,
            textAlign: "center",
          }}
        >
          <span style={{ ...HO.monoLabel, fontSize: 11, color: HO.gold }}>Travel ended</span>
          {session.intent ? (
            <h2 style={{ fontFamily: HO.display, fontWeight: 800, letterSpacing: "-0.02em", fontSize: 28, margin: 0, color: "#fff" }}>
              {session.intent.title}
            </h2>
          ) : null}
          <MonoChip>{modeLabel}</MonoChip>
          {worldId ? <WorldIdChip worldId={worldId} /> : null}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginTop: 4 }}>
            <DarkPill onClick={session.exit}>Back to worlds</DarkPill>
            <CreamPill onClick={session.beginTravel} disabled={session.starting}>
              {session.starting ? "Starting…" : "Travel again →"}
            </CreamPill>
          </div>
        </div>
      </div>
    </div>
  );
}
