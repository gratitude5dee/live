import { useHappyOysterClient } from "@/components/happy-oyster/ho-client";
import { HO } from "./tokens";

const TONE: Record<string, { dot: string; label: string }> = {
  idle: { dot: "rgba(255,255,255,.35)", label: "Disconnected" },
  connecting: { dot: "#f5c451", label: "Connecting" },
  connected: { dot: "#c7c099", label: "Connected" },
  starting_stream: { dot: "#c7c099", label: "Connected" },
  streaming: { dot: "#c7c099", label: "Connected" },
  ended: { dot: "rgba(255,255,255,.35)", label: "Disconnected" },
  failed: { dot: "#ff8b7a", label: "Connection failed" },
};

export function StatusChip({ onDisconnect }: { onDisconnect?: () => void }) {
  const { phase, connect, disconnect } = useHappyOysterClient();
  const tone = TONE[phase] ?? TONE.connected;
  const idle = phase === "idle" || phase === "ended" || phase === "failed";
  const pulsing = phase === "connecting";

  return (
    <button
      type="button"
      onClick={() => {
        if (idle) void connect().catch(() => {});
        else if (onDisconnect) onDisconnect();
        else void disconnect().catch(() => {});
      }}
      style={{
        position: "fixed",
        top: 20,
        left: 20,
        zIndex: 45,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: HO.darkPill,
        color: HO.creamPill,
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 9999,
        padding: "8px 14px",
        ...HO.monoLabel,
        fontSize: 10,
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      }}
      aria-label={idle ? "Connect" : "Disconnect"}
    >
      <span
        aria-hidden
        style={{
          width: 7,
          height: 7,
          borderRadius: 9999,
          background: tone.dot,
          animation: pulsing ? "ho-pulse 1.2s ease-in-out infinite" : undefined,
        }}
      />
      {tone.label}
      <style>{`@keyframes ho-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }`}</style>
    </button>
  );
}
