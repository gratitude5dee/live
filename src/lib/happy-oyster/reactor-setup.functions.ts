import { createServerFn } from "@tanstack/react-start";

/**
 * Page gate for /discover. Reports whether REACTOR_API_KEY is set on the
 * server. Never returns the key itself.
 */
export const getReactorSetup = createServerFn({ method: "GET" }).handler(
  async () => {
    return { hasKey: !!process.env.REACTOR_API_KEY };
  },
);
