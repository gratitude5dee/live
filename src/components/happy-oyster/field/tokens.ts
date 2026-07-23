// Design tokens for the HappyOyster field UI. All new field components read
// colors, type, and shadows from here — no hardcoded hex elsewhere.

export const HO = {
  paper: "#ECE5D3",
  ink: "#0D0C0A",
  creamPill: "#F1EAD5",
  darkPill: "#1C1B18",
  cloud: "#8A8C8B",
  cloudDark: "#5C6063",
  gold: "var(--reactor-color-light-gold, #d4b855)",
  mono: `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`,
  display: `"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif`,
  pillGlow: "0 0 24px rgba(241,234,213,.35)",
  goldGlow:
    "0 0 28px color-mix(in oklab, var(--reactor-color-light-gold, #d4b855) 55%, transparent)",
  monoLabel: {
    fontFamily: `"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace`,
    textTransform: "uppercase" as const,
    letterSpacing: "0.12em",
    fontWeight: 500,
  },
};

export const VIRTUAL_FIELD = {
  wMul: 2.5,
  hMul: 1.8,
};
