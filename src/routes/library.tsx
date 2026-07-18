import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { TakeRow } from "@/lib/zap/types";

export const Route = createFileRoute("/library")({
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — Library" },
      { name: "description", content: "Recorded takes and snapshots." },
    ],
  }),
  component: LibraryPage,
});

type TakeWithUrl = TakeRow & { url?: string };

function LibraryPage() {
  const [takes, setTakes] = useState<TakeWithUrl[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) await supabase.auth.signInAnonymously();
      const { data } = await supabase
        .from("takes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(60);
      if (!data) {
        setLoading(false);
        return;
      }
      const withUrls = await Promise.all(
        data.map(async (t) => {
          const { data: signed } = await supabase.storage
            .from("takes")
            .createSignedUrl(t.storage_path, 3600);
          return { ...t, url: signed?.signedUrl };
        }),
      );
      setTakes(withUrls);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0A0F] p-6 text-[#FAFAFA]">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">
          <span className="text-[#22D3EE]">ZAP·LIVE</span> Library
        </h1>
        <Link
          to="/"
          className="rounded-md bg-[#16161D] px-3 py-1.5 text-xs hover:bg-[#22222D]"
        >
          ← Stage
        </Link>
      </header>

      {loading && <p className="text-[#9CA3AF]">Loading…</p>}
      {!loading && takes.length === 0 && (
        <p className="text-[#9CA3AF]">No takes yet. Hit ⬤ Record on the stage.</p>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {takes.map((t) => (
          <div
            key={t.id}
            className="overflow-hidden rounded-lg border border-[#2A2A35] bg-[#16161D]"
          >
            {t.url ? (
              t.kind === "video" ? (
                <video src={t.url} className="aspect-video w-full" controls />
              ) : (
                <img src={t.url} alt="snapshot" className="aspect-video w-full object-cover" />
              )
            ) : (
              <div className="aspect-video bg-black" />
            )}
            <div className="flex items-center justify-between gap-2 p-2 text-xs text-[#9CA3AF]">
              <span>{t.kind}</span>
              <span className="flex-1 truncate">{new Date(t.created_at).toLocaleString()}</span>
              <button
                onClick={async () => {
                  if (!confirm("Delete this take?")) return;
                  await supabase.storage.from("takes").remove([t.storage_path]);
                  await supabase.from("takes").delete().eq("id", t.id);
                  setTakes((prev) => prev.filter((x) => x.id !== t.id));
                }}
                className="text-[#F87171] hover:underline"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
