import { HO } from "./tokens";

export function HoverChip({ label }: { label: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: "absolute",
        left: "50%",
        bottom: -34,
        transform: "translateX(-50%)",
        background: HO.darkPill,
        color: HO.creamPill,
        padding: "6px 12px",
        borderRadius: 9999,
        ...HO.monoLabel,
        fontSize: 11,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        boxShadow: "0 6px 18px rgba(0,0,0,.4)",
      }}
    >
      {label}
    </span>
  );
}
