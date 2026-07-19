import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mints a short-lived OpenAI Realtime ephemeral client secret for the
 * authenticated user. Shares the 30/min rate-limit bucket with fal tokens
 * via public.token_mints so a runaway client cannot burn credits.
 *
 * The raw OPENAI_API_KEY never crosses to the browser — only the ephemeral
 * `ek_...` value is returned.
 */
export const mintOpenAIRealtimeSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Rate limit: <= 30 mints/min (shared bucket with fal)
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabase
      .from("token_mints")
      .select("*", { count: "exact", head: true })
      .gte("minted_at", oneMinAgo);

    if ((count ?? 0) >= 30) {
      throw new Error("rate_limited");
    }

    await supabase.from("token_mints").insert({ user_id: userId });

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const model = process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime";
    const voice = "cedar";

    const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          audio: { output: { voice } },
        },
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("openai realtime mint failed", res.status, text);
      throw new Error(`openai_mint_failed_${res.status}`);
    }

    const json = (await res.json()) as {
      value?: string;
      expires_at?: number;
      session?: { model?: string };
    };
    const ephemeralKey = json.value;
    if (!ephemeralKey) throw new Error("openai_mint_no_secret");

    return {
      ephemeralKey,
      model: json.session?.model ?? model,
      voice,
      expiresAt: json.expires_at ?? null,
    };
  });
