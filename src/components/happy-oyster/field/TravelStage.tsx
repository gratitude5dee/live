import type { WorldSession } from "@/components/happy-oyster/use-world-session";
import { useVideoSlot } from "@/components/happy-oyster/ho-client";
import { AdventureControls } from "@/components/happy-oyster/AdventureControls";
import { DirectingControls } from "@/components/happy-oyster/DirectingControls";
import { TRAVEL_SECONDS } from "@/lib/happy-oyster/worlds";
import { HO } from "./tokens";
import { MonoChip, DarkPill } from "./pill";
import { useTravelTimer } from "./useTravelTimer";

export function TravelStage({ session }: { session: WorldSession }) {
  const { view, client, intent } = session;
  const videoSlot = useVideoSlot();
  const live = view.kind === "traveling" && view.live;
  const mode = (client.worldState?.mode === 2 ? 2 : 1) as 1 | 2;
  const totalSeconds = TRAVEL_SECONDS[mode];
  const secondsLeft = useTravelTimer(live, totalSeconds, () => {
    void client.endTravelSession().catch(() => {});
  });
  const modeLabel = mode === 2 ? "Directing" : "Adventure";
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");
  const warn = secondsLeft <= 10;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, background: "#000" }}>
      <div style={{ position: "absolute", inset: 0 }}>{videoSlot}</div>

      {/* Top-left: world title + mode */}
      <div
        style={{
          position: "fixed",
          top: 20,
          left: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 3,
        }}
      >
        <MonoChip>{modeLabel}</MonoChip>
        {intent ? (
          <span
            style={{
              fontFamily: HO.display,
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "#fff",
              fontSize: 18,
              textShadow: "0 4px 20px rgba(0,0,0,.6)",
            }}
          >
            {intent.title}
          </span>
        ) : null}
      </div>

      {/* Top-right: countdown + end travel */}
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          display: "flex",
          alignItems: "center",
          gap: 10,
          zIndex: 3,
        }}
      >
        <span
          style={{
            ...HO.monoLabel,
            fontFamily: HO.mono,
            fontSize: 13,
            padding: "8px 12px",
            borderRadius: 9999,
            background: warn ? "rgba(255,120,110,.9)" : HO.darkPill,
            color: warn ? "#0D0C0A" : HO.creamPill,
            fontVariantNumeric: "tabular-nums",
            letterSpacing: "0.08em",
            border: warn ? "none" : "1px solid rgba(255,255,255,.08)",
          }}
        >
          {minutes}:{seconds}
        </span>
        <DarkPill onClick={() => void client.endTravelSession().catch(() => {})} danger>
          End travel
        </DarkPill>
      </div>

      {/* Bottom-center: control deck (wraps AdventureControls / DirectingControls as-is) */}
      {live ? (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3,
            width: "min(720px, calc(100vw - 32px))",
          }}
        >
          <div
            style={{
              background: "rgba(12,11,10,.72)",
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,.08)",
              borderRadius: 20,
              padding: 16,
              boxShadow: "0 30px 60px rgba(0,0,0,.5)",
            }}
          >
            {mode === 2 ? <DirectingControls /> : <AdventureControls />}
          </div>
        </div>
      ) : null}
    </div>
  );
}
