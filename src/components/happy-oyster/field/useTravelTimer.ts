import { useEffect, useRef, useState } from "react";

// Extracted 1:1 from src/components/happy-oyster/Sidebar.tsx to avoid editing
// the engine files while still driving the same countdown from the same
// TRAVEL_SECONDS values.
export function useTravelTimer(
  active: boolean,
  totalSeconds: number,
  onExpire: () => void,
): number {
  const deadline = useRef<number | null>(null);
  const expired = useRef(false);
  const [left, setLeft] = useState(totalSeconds);
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  useEffect(() => {
    if (!active) {
      deadline.current = null;
      expired.current = false;
      setLeft(totalSeconds);
      return;
    }
    if (!deadline.current) deadline.current = Date.now() + totalSeconds * 1000;
    const tick = () => {
      const remaining = Math.max(
        0,
        Math.round((deadline.current! - Date.now()) / 1000),
      );
      setLeft(remaining);
      if (remaining <= 0 && !expired.current) {
        expired.current = true;
        expireRef.current();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [active, totalSeconds]);

  return left;
}
