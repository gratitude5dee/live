import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const WMA_URL = "https://wma.fal.run";
const LUCY_APP = "decart/lucy-2-5/realtime";

type SessionAnswer = {
  session_id: string;
  sdp: string;
  type: "answer";
};

export const createLucySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sdp: string; type: "offer" }) => {
    if (!data || data.type !== "offer" || typeof data.sdp !== "string") {
      throw new Error("Invalid WebRTC offer");
    }
    if (data.sdp.length < 20 || data.sdp.length > 250_000) {
      throw new Error("Invalid WebRTC offer size");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error("FAL_KEY not configured");

    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count } = await context.supabase
      .from("token_mints")
      .select("*", { count: "exact", head: true })
      .gte("minted_at", oneMinuteAgo);
    if ((count ?? 0) >= 30) throw new Error("Too many Lucy sessions");
    const { error: mintError } = await context.supabase
      .from("token_mints")
      .insert({ user_id: context.userId });
    if (mintError) throw new Error("Could not authorize Lucy session");

    const response = await fetch(`${WMA_URL}/session`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_id: LUCY_APP,
        sdp: data.sdp,
        type: data.type,
      }),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      console.error("Lucy WebRTC session failed", response.status, detail);
      throw new Error(`Lucy session failed (${response.status})`);
    }

    const answer = (await response.json()) as Partial<SessionAnswer>;
    if (!answer.session_id || !answer.sdp || answer.type !== "answer") {
      console.error("Lucy returned an invalid WebRTC answer");
      throw new Error("Lucy returned an invalid WebRTC answer");
    }
    return answer as SessionAnswer;
  });

export const heartbeatLucySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string }) => {
    if (!data || !/^[0-9a-f-]{20,64}$/i.test(data.sessionId)) {
      throw new Error("Invalid Lucy session");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const key = process.env.FAL_KEY;
    if (!key) throw new Error("FAL_KEY not configured");

    const response = await fetch(`${WMA_URL}/session/heartbeat`, {
      method: "POST",
      headers: {
        Authorization: `Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: data.sessionId }),
    });
    if (!response.ok) {
      console.warn("Lucy heartbeat failed", response.status);
      return { ok: false };
    }
    return { ok: true };
  });