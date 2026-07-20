import { useEffect, useState } from "react";

/**
 * First-run coach marks. Three dismissible glass chips shown once per
 * device (keyed by `zap.coach.v1` in sessionStorage — persistent so a
 * page reload during the same visit doesn't re-nag).
 */
const STORAGE_KEY = "zap.coach.v1";

const MARKS: { id: string; text: string; delay: number }[] = [
  { id: "gesture", text: "👍 commits · 👎 undoes", delay: 400 },
  { id: "clear", text: "🖐 hold to clear", delay: 1200 },
  { id: "voice", text: "Say “Computah…” to talk", delay: 2000 },
];

const AUTO_DISMISS_MS = 8000;

export default function CoachMarks({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!enabled || dismissed) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    MARKS.forEach((m) => {
      timers.push(
        setTimeout(() => {
          setVisible((s) => new Set(s).add(m.id));
          timers.push(
            setTimeout(() => {
              setVisible((s) => {
                const n = new Set(s);
                n.delete(m.id);
                return n;
              });
            }, AUTO_DISMISS_MS),
          );
        }, m.delay),
      );
    });
    // Persist once shown so a session refresh isn't nagged again.
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore quota / privacy modes */
    }
    return () => timers.forEach(clearTimeout);
  }, [enabled, dismissed]);

  const dismiss = (id: string) => {
    setVisible((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
  };
  const dismissAll = () => {
    setVisible(new Set());
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <div
      className="pointer-events-none fixed left-1/2 z-30 flex -translate-x-1/2 flex-col items-center gap-1.5"
      style={{ top: "calc(env(safe-area-inset-top) + 4.5rem)" }}
      aria-live="polite"
    >
      {MARKS.map((m) =>
        visible.has(m.id) ? (
          <button
            key={m.id}
            type="button"
            onClick={() => dismiss(m.id)}
            className="pointer-events-auto animate-[fadeInDown_260ms_ease-out] rounded-full border border-white/15 bg-black/70 px-3.5 py-1.5 text-[11px] text-white/85 backdrop-blur-xl transition hover:bg-black/90"
          >
            {m.text}
          </button>
        ) : null,
      )}
      {visible.size > 0 && (
        <button
          type="button"
          onClick={dismissAll}
          className="pointer-events-auto rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[10px] uppercase tracking-widest text-white/50 backdrop-blur-xl hover:text-white/80"
        >
          Dismiss
        </button>
      )}
      <style>{`
        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
