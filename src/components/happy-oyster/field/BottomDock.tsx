import { HO } from "./tokens";

export function BottomDock({
  onCreate,
  onHelp,
  onToggleSound,
  muted = true,
}: {
  onCreate?: () => void;
  onHelp?: () => void;
  onToggleSound?: () => void;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: "50%",
        bottom: 28,
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        zIndex: 40,
      }}
    >
      <button type="button" onClick={onCreate} style={darkPillStyle}>
        <span aria-hidden style={{ fontSize: 14, marginRight: 6, opacity: 0.9 }}>
          +
        </span>
        Create a world
      </button>
      <button type="button" onClick={onHelp} aria-label="Help" style={roundBtnStyle}>
        ?
      </button>
      <button
        type="button"
        onClick={onToggleSound}
        aria-label={muted ? "Unmute" : "Mute"}
        style={roundBtnStyle}
      >
        <SoundIcon muted={muted} />
      </button>
    </div>
  );
}

const darkPillStyle: React.CSSProperties = {
  background: HO.darkPill,
  color: HO.creamPill,
  borderRadius: 9999,
  padding: "12px 22px",
  border: `1px solid rgba(255,255,255,.06)`,
  cursor: "pointer",
  ...HO.monoLabel,
  fontSize: 12,
  boxShadow: "0 10px 30px rgba(0,0,0,.35)",
};

const roundBtnStyle: React.CSSProperties = {
  background: HO.darkPill,
  color: HO.creamPill,
  borderRadius: 9999,
  width: 42,
  height: 42,
  display: "grid",
  placeItems: "center",
  border: `1px solid rgba(255,255,255,.06)`,
  cursor: "pointer",
  fontFamily: HO.mono,
  fontSize: 14,
  boxShadow: "0 10px 30px rgba(0,0,0,.35)",
};

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2.5 6v4h2.2L8 12.5v-9L4.7 6H2.5Z"
        fill="currentColor"
      />
      {muted ? (
        <>
          <line x1="10.5" y1="6" x2="14" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="14" y1="6" x2="10.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path
            d="M10.5 5.5c1 .8 1 3.2 0 4"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M12 4c1.8 1.2 1.8 5.8 0 7"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            fill="none"
          />
        </>
      )}
    </svg>
  );
}
