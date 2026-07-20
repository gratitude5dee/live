import { useEffect, useState } from "react";
import { HUD_HINTS } from "@/lib/zap/voice-intent";

/**
 * Rotating command hint shown under the Computah HUD chip while armed.
 * Idle 4s, then cross-fade to the next hint. Pauses when Computah is
 * "thinking" so the user isn't distracted by the rotation during an edit.
 */
export default function VoiceHintChip({
  active,
  className = "",
}: {
  active: boolean;
  className?: string;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => {
      setIdx((i) => (i + 1) % HUD_HINTS.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [active]);
  if (!active) return null;
  return (
    <div
      key={idx}
      className={`animate-fade-in truncate rounded-full border border-white/10 bg-black/50 px-2.5 py-0.5 text-[10px] text-white/60 backdrop-blur-xl ${className}`}
    >
      {HUD_HINTS[idx]}
    </div>
  );
}
