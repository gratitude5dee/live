import { createServerFn } from "@tanstack/react-start";

/**
 * Setup gate for the /discover (HappyOyster) page — the TanStack Start
 * equivalent of happy-oyster's server-component check in app/page.tsx.
 *
 * Reports only whether REACTOR_API_KEY is configured on the server; the key
 * itself never leaves the server (the /api/reactor/token route exchanges it
 * for short-lived browser JWTs).
 */
export const getReactorSetup = createServerFn({ method: "GET" }).handler(
  async () => ({
    hasKey: !!process.env.REACTOR_API_KEY,
  }),
);
