/**
 * Cuelume wrapper — tasteful UI SFX for ZAP-LIVE.
 *
 * - Declarative sounds via `data-cuelume-*` attributes (bind() is idempotent).
 * - Imperative outcomes via play("name").
 * - Persistent mute toggle in localStorage; respects prefers-reduced-motion.
 * - SSR-safe: cuelume is a no-op on the server.
 */
import { useCallback, useEffect, useState } from "react";
import { bind, play as cuePlay, setEnabled, type SoundName } from "cuelume";

const STORAGE_KEY = "zap.sfx";
let initialized = false;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function readStored(): boolean | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

export function isSfxEnabled(): boolean {
  const stored = readStored();
  if (stored !== null) return stored;
  return !prefersReducedMotion();
}

export function initSfx() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  bind();
  setEnabled(isSfxEnabled());
}

export function setSfxEnabled(on: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, on ? "true" : "false");
  setEnabled(on);
  window.dispatchEvent(new CustomEvent("zap:sfx-changed", { detail: on }));
}

export function play(name: SoundName) {
  try {
    cuePlay(name);
  } catch {
    /* silent no-op */
  }
}

export function useSfxEnabled(): [boolean, (v: boolean) => void] {
  const [enabled, setLocal] = useState<boolean>(() => isSfxEnabled());
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<boolean>).detail;
      setLocal(!!detail);
    };
    window.addEventListener("zap:sfx-changed", handler);
    return () => window.removeEventListener("zap:sfx-changed", handler);
  }, []);
  const set = useCallback((v: boolean) => setSfxEnabled(v), []);
  return [enabled, set];
}

/** toast.error wrapper that also plays the error cue. */
export async function toastError(message: string) {
  const { toast } = await import("sonner");
  play("error");
  toast.error(message);
}
