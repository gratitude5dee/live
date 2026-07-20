import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function readMatch(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(QUERY).matches;
}

export function useIsMobile() {
  // Initialize synchronously so the first paint mounts the correct stage.
  // Avoids the Desktop→Mobile remount that would tear <video> srcObject refs
  // mid-session on real phones.
  const [isMobile, setIsMobile] = React.useState<boolean>(readMatch);

  React.useEffect(() => {
    const mql = window.matchMedia(QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    // Reconcile in case SSR/hydration guessed wrong.
    setIsMobile(mql.matches);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}
