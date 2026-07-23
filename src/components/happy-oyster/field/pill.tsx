import { useState, type CSSProperties, type ReactNode } from "react";
import { HO } from "./tokens";

export function CreamPill({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const [hover, setHover] = useState(false);
  const style: CSSProperties = {
    background: HO.creamPill,
    color: HO.ink,
    border: "none",
    borderRadius: 9999,
    padding: "12px 22px",
    ...HO.monoLabel,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.45 : 1,
    boxShadow: hover && !disabled ? `0 0 34px rgba(241,234,213,.5)` : HO.pillGlow,
    transition: "box-shadow 260ms",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  );
}

export function DarkPill({
  children,
  onClick,
  disabled,
  danger,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: HO.darkPill,
        color: danger ? "#ffb4a8" : HO.creamPill,
        border: `1px solid ${danger ? "rgba(255,120,110,.4)" : "rgba(255,255,255,.08)"}`,
        borderRadius: 9999,
        padding: "10px 18px",
        ...HO.monoLabel,
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        boxShadow: "0 10px 30px rgba(0,0,0,.35)",
      }}
    >
      {children}
    </button>
  );
}

export function OutlinePill({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        color: HO.creamPill,
        border: `1px solid rgba(241,234,213,.35)`,
        borderRadius: 9999,
        padding: "12px 22px",
        ...HO.monoLabel,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

export function MonoChip({
  children,
  tone = "dark",
}: {
  children: ReactNode;
  tone?: "dark" | "cream";
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: tone === "dark" ? HO.darkPill : HO.creamPill,
        color: tone === "dark" ? HO.creamPill : HO.ink,
        borderRadius: 9999,
        padding: "5px 10px",
        ...HO.monoLabel,
        fontSize: 10,
        border: tone === "dark" ? "1px solid rgba(255,255,255,.06)" : "none",
      }}
    >
      {children}
    </span>
  );
}
