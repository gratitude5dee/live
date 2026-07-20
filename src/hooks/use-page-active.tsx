import * as React from "react";

/**
 * Returns false when the user has expressed `prefers-reduced-motion` OR
 * when the tab is hidden. Consumers use this to gate expensive WebGL
 * animations — mount a static fallback instead of running rAF loops in
 * the background (saves battery + respects OS a11y).
 */
export function usePageActive(): boolean {
  const [active, setActive] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const rm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return !rm && !document.hidden;
  });

  React.useEffect(() => {
    const rmq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setActive(!rmq.matches && !document.hidden);
    update();
    rmq.addEventListener?.("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      rmq.removeEventListener?.("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return active;
}

/** True only when the user has explicitly requested reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState<boolean>(() =>
    typeof window === "undefined"
      ? false
      : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}
