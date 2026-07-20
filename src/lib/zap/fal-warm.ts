import { mintFalRealtimeToken } from "@/lib/fal-token.functions";
import { LUCY_APP } from "@/lib/zap/types";

/**
 * Pre-mint the fal.ai realtime JWT the moment the user commits to entering
 * (Enter pointerdown on the landing hero). Signaling starts with a token
 * already in hand instead of serializing the mint after getUserMedia.
 *
 * Tokens are ~120s TTL. If the mint is stale by the time startSession()
 * runs, it falls back to a fresh mint transparently.
 */
type Warm = { token: string; mintedAt: number };
let warm: Promise<Warm> | null = null;

export function warmFalToken() {
  if (warm) return warm;
  warm = mintFalRealtimeToken({ data: { app: LUCY_APP } })
    .then((token) => ({ token, mintedAt: Date.now() }))
    .catch((e) => {
      warm = null;
      throw e;
    });
  return warm;
}

export function takeWarmFalToken(): string | null {
  const p = warm;
  warm = null;
  if (!p) return null;
  // We only expose the synchronous string; the transport already asks fal
  // for a token via `tokenProvider`, so this is best-effort — caller may
  // ignore when unresolved.
  let resolved: Warm | null = null;
  p.then((v) => {
    resolved = v;
  });
  // Because callers awaited startSession's own setup, the mint has almost
  // certainly resolved by now; if not, discard and let tokenProvider run.
  if (!resolved) return null;
  const age = Date.now() - (resolved as Warm).mintedAt;
  if (age > 110_000) return null;
  return (resolved as Warm).token;
}
