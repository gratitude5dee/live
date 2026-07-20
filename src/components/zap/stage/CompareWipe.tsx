import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Draggable A/B wipe. Renders a mirrored raw-input `<video>` on the left
 * clipped to `x%` of the viewport, giving a before/after slider over the
 * Lucy output beneath it. Desktop-only; press "\" to toggle from anywhere.
 */
export default function CompareWipe({
  inputStream,
  active,
  onClose,
}: {
  inputStream: MediaStream | null;
  active: boolean;
  onClose: () => void;
}) {
  const [x, setX] = useState(50);
  const draggingRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !inputStream) return;
    if (el.srcObject !== inputStream) {
      el.srcObject = inputStream;
      el.play().catch(() => {});
    }
  }, [inputStream, active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, onClose]);

  const setFromClientX = useCallback((clientX: number) => {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setX(pct);
  }, []);

  useEffect(() => {
    if (!active) return;
    const onMove = (e: PointerEvent) => {
      if (!draggingRef.current) return;
      setFromClientX(e.clientX);
    };
    const onUp = () => {
      draggingRef.current = false;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [active, setFromClientX]);

  if (!active) return null;

  return (
    <div
      ref={rootRef}
      className="pointer-events-auto fixed inset-0 z-30"
      aria-label="Before / after wipe"
    >
      {/* Raw input on top, clipped to left of the handle */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}
      >
        <video
          ref={videoRef}
          className="h-full w-full -scale-x-100 object-cover"
          autoPlay
          playsInline
          muted
        />
        <div className="absolute left-4 top-4 rounded-full border border-white/20 bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/80 backdrop-blur-xl">
          Raw
        </div>
      </div>
      <div
        className="absolute right-4 top-4 rounded-full border border-emerald-300/40 bg-black/70 px-2.5 py-1 text-[10px] uppercase tracking-widest text-emerald-100 backdrop-blur-xl"
      >
        Lucy
      </div>

      {/* Handle */}
      <div
        className="absolute inset-y-0 z-10 flex w-8 -translate-x-1/2 cursor-ew-resize items-center justify-center"
        style={{ left: `${x}%` }}
        onPointerDown={(e) => {
          draggingRef.current = true;
          (e.target as Element).setPointerCapture?.(e.pointerId);
        }}
      >
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/70 shadow-[0_0_16px_rgba(255,255,255,0.6)]" />
        <div className="relative grid h-11 w-11 place-items-center rounded-full border border-white/40 bg-black/70 text-white/90 backdrop-blur-xl shadow-2xl">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m8 8-4 4 4 4" />
            <path d="m16 8 4 4-4 4" />
          </svg>
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 bottom-6 rounded-full border border-white/20 bg-black/70 px-3.5 py-1.5 text-[11px] text-white/85 backdrop-blur-xl transition hover:bg-black/90"
      >
        Close wipe (Esc)
      </button>
    </div>
  );
}
