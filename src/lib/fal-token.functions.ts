import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mints a short-lived fal.ai realtime JWT for the authenticated user.
 * Rate-limited to 30 mints/min/user. Only decart/lucy-2-5/* apps allowed.
 */
export const mintFalRealtimeToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { app: string }) => {
    if (!data || typeof data.app !== "string") throw new Error("bad_input");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { app } = data;
    if (!app.startsWith("decart/lucy-2-5")) {
      throw new Error("app_not_allowed");
    }

    const { supabase, userId } = context;

    // Rate limit: <= 30 mints/min
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("token_mints")
      .select("*", { count: "exact", head: true })
      .gte("minted_at", oneMinAgo);

    if ((count ?? 0) >= 30) {
      throw new Error("rate_limited");
    }

    await supabase.from("token_mints").insert({ user_id: userId });

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) throw new Error("FAL_KEY not configured");

    const res = await fetch("https://rest.fal.ai/tokens/realtime", {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app,
        duration: 120,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("fal token mint failed", res.status, text);
      throw new Error(`fal_mint_failed_${res.status}`);
    }

    const body = (await res.json()) as { token?: string } | string;
    const token = typeof body === "string" ? body : body.token;
    if (!token) throw new Error("fal_mint_no_token");
    return { token };
  });

