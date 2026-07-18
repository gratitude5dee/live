import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Preset, RemoteMessage } from "@/lib/zap/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/remote/$sessionId")({
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — Remote" },
      { name: "description", content: "Phone remote for a ZAP·LIVE stage." },
    ],
  }),
  component: RemotePage,
});

function RemotePage() {
  const { sessionId } = Route.useParams();
  const [ready, setReady] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) await supabase.auth.signInAnonymously();
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    if (!ready) return;
    supabase
      .from("presets")
      .select("*")
      .order("sort_order", { ascending: true })
      .then(({ data }) => data && setPresets(data));
    const ch = supabase.channel(`sess:${sessionId}`);
    ch.subscribe();
    setChannel(ch);
    return () => {
      supabase.removeChannel(ch);
    };
  }, [ready, sessionId]);

  const send = (msg: RemoteMessage) => {
    channel?.send({ type: "broadcast", event: "remote", payload: msg });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-4 text-[#FAFAFA]">
      <h1 className="mb-4 font-bold text-[#22D3EE]">ZAP·LIVE Remote</h1>
      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Send a prompt…"
          className="flex-1 rounded-md border border-[#2A2A35] bg-[#16161D] px-3 py-2 text-sm"
        />
        <button
          onClick={() => {
            if (prompt.trim()) send({ type: "apply", prompt });
          }}
          className="rounded-md bg-[#22D3EE] px-4 py-2 text-sm font-semibold text-black"
        >
          Apply
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => send({ type: "undo" })}
          className="flex-1 rounded-md bg-[#22222D] py-2 text-sm"
        >
          Undo
        </button>
        <button
          onClick={() => send({ type: "clear" })}
          className="flex-1 rounded-md bg-[#22222D] py-2 text-sm"
        >
          Clear
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => send({ type: "preset", presetId: p.id })}
            className="flex flex-col items-center gap-1 rounded-xl border border-[#2A2A35] bg-[#16161D] px-2 py-3"
          >
            <span className="text-2xl">{p.emoji}</span>
            <span className="text-xs text-[#9CA3AF]">{p.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
