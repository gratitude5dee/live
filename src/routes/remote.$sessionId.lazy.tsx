import { createLazyFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Preset, RemoteMessage } from "@/lib/zap/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createLazyFileRoute("/remote/$sessionId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — Remote" },
      { name: "description", content: "Phone remote for a ZAP·LIVE stage." },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
  component: RemotePage,
});

type Ticker = { id: number; label: string; at: number };

function RemotePage() {
  const { sessionId } = Route.useParams();
  const [ready, setReady] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<string | null>(null);
  const [hostOnline, setHostOnline] = useState(false);
  const [ticker, setTicker] = useState<Ticker[]>([]);
  const lastHeartbeatRef = useRef<number>(0);

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
    ch.on("broadcast", { event: "heartbeat" }, (payload) => {
      lastHeartbeatRef.current = Date.now();
      setHostOnline(true);
      const p = payload.payload as { prompt?: string | null };
      setCurrentPrompt(p.prompt ?? null);
    });
    ch.on("broadcast", { event: "vision" }, (payload) => {
      const p = payload.payload as { label?: string };
      if (!p.label) return;
      const id = Date.now() + Math.random();
      setTicker((prev) => [...prev.slice(-6), { id, label: p.label!, at: Date.now() }]);
      setTimeout(() => setTicker((prev) => prev.filter((t) => t.id !== id)), 3000);
    });
    ch.on("broadcast", { event: "prompt" }, (payload) => {
      const p = payload.payload as { prompt?: string };
      if (p.prompt !== undefined) setCurrentPrompt(p.prompt || null);
    });
    ch.subscribe();
    setChannel(ch);

    const interval = setInterval(() => {
      if (Date.now() - lastHeartbeatRef.current > 6000) setHostOnline(false);
    }, 1000);

    return () => {
      clearInterval(interval);
      supabase.removeChannel(ch);
    };
  }, [ready, sessionId]);

  const send = (msg: RemoteMessage) => {
    channel?.send({ type: "broadcast", event: "remote", payload: msg });
  };

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-4 text-[#FAFAFA]">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="font-bold text-[#22D3EE]">ZAP·LIVE Remote</h1>
        <span className="flex items-center gap-1.5 rounded-full bg-[#16161D] px-2.5 py-1 text-xs">
          <span
            className={`h-2 w-2 rounded-full ${hostOnline ? "bg-emerald-500" : "bg-red-500"}`}
          />
          {hostOnline ? "connected" : "host offline"}
        </span>
      </header>

      <div className="mb-3 min-h-[2.5rem] rounded-md border border-[#2A2A35] bg-[#16161D] px-3 py-2 text-xs">
        <span className="text-[#4a4a5a]">now: </span>
        <span className="text-[#4ADE80]">{currentPrompt || "—"}</span>
      </div>

      <div className="flex gap-2">
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Send a prompt…"
          className="flex-1 rounded-md border border-[#2A2A35] bg-[#16161D] px-3 py-3 text-base"
        />
        <button
          onClick={() => {
            if (prompt.trim()) {
              send({ type: "apply", prompt });
              setPrompt("");
            }
          }}
          disabled={!hostOnline}
          className="rounded-md bg-[#22D3EE] px-4 py-3 text-sm font-semibold text-black disabled:opacity-40"
        >
          Apply
        </button>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => send({ type: "undo" })}
          disabled={!hostOnline}
          className="flex-1 rounded-md bg-[#22222D] py-3 text-sm disabled:opacity-40"
        >
          Undo
        </button>
        <button
          onClick={() => send({ type: "clear" })}
          disabled={!hostOnline}
          className="flex-1 rounded-md bg-[#22222D] py-3 text-sm disabled:opacity-40"
        >
          Clear
        </button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => send({ type: "preset", presetId: p.id })}
            disabled={!hostOnline}
            className="flex flex-col items-center gap-1 rounded-xl border border-[#2A2A35] bg-[#16161D] px-2 py-3 disabled:opacity-40"
          >
            <span className="text-2xl">{p.emoji}</span>
            <span className="text-xs text-[#9CA3AF]">{p.name}</span>
          </button>
        ))}
      </div>

      {ticker.length > 0 && (
        <div className="fixed inset-x-0 bottom-2 flex flex-wrap justify-center gap-1 px-2">
          {ticker.map((t) => (
            <span
              key={t.id}
              className="rounded-full bg-[#E879F9]/20 px-2 py-1 text-xs text-[#E879F9]"
            >
              ✋ {t.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
