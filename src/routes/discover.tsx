import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import type { HappyOysterMode } from "@reactor-models/happy-oyster";
import { getReactorSetup } from "@/lib/happy-oyster/reactor-setup.functions";
import type { WorldIntent } from "@/lib/happy-oyster/worlds";
import { Header } from "@/components/happy-oyster/Header";
import { LiveClientProvider } from "@/components/happy-oyster/ho-client";
import { useWorldSession } from "@/components/happy-oyster/use-world-session";
import { Sidebar } from "@/components/happy-oyster/Sidebar";
import { Screen } from "@/components/happy-oyster/Screen";

export const Route = createFileRoute("/discover")({
  loader: () => getReactorSetup(),
  component: DiscoverPage,
  head: () => ({
    meta: [
      { title: "HappyOyster · Discover — Reactor worlds" },
      {
        name: "description",
        content:
          "Build a world from a prompt, then travel it live — WASD in Adventure, text in Directing.",
      },
      { property: "og:title", content: "HappyOyster · Discover" },
      {
        property: "og:description",
        content:
          "Build a world from a prompt, then travel it live — WASD in Adventure, text in Directing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function DiscoverPage() {
  const { hasKey } = Route.useLoaderData();
  return (
    <div className="ho-scope dark min-h-dvh">
      {hasKey ? <HappyOysterApp /> : <SetupRequired />}
    </div>
  );
}

function HappyOysterApp() {
  const [mode, setMode] = useState<HappyOysterMode>("adventure");
  const [intent, setIntent] = useState<WorldIntent | null>(null);

  const run = useCallback((next: WorldIntent) => {
    setMode(next.mode);
    setIntent(next);
  }, []);
  const clearIntent = useCallback(() => setIntent(null), []);

  return (
    <LiveClientProvider mode={mode} key={mode}>
      <Shell intent={intent} onRun={run} onClearIntent={clearIntent} />
    </LiveClientProvider>
  );
}

function Shell({
  intent,
  onRun,
  onClearIntent,
}: {
  intent: WorldIntent | null;
  onRun: (intent: WorldIntent) => void;
  onClearIntent: () => void;
}) {
  const session = useWorldSession({ intent, onRun, onClearIntent });
  return (
    <div className="flex h-dvh flex-col bg-zinc-950">
      <Header />
      <main className="flex w-full min-h-0 flex-1 flex-col gap-4 p-4 max-lg:overflow-y-auto sm:p-6 lg:flex-row lg:gap-6">
        <Sidebar session={session} />
        <Screen session={session} />
      </main>
    </div>
  );
}

const ACCOUNT_API_KEYS_URL = "https://www.reactor.inc/account/api-keys";

function SetupRequired() {
  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950">
      <Header />
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-white/[0.08] bg-white/[0.02] p-6">
          <h2 className="text-base font-semibold text-zinc-100">
            Setup required
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            This app needs a Reactor API key to mint session tokens. You only
            need to do this once.
          </p>

          <ol className="mt-5 space-y-4 text-sm text-zinc-300">
            <li className="flex gap-3">
              <Step>1</Step>
              <span>
                Create an API key at{" "}
                <a
                  href={ACCOUNT_API_KEYS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary underline-offset-2 hover:underline"
                >
                  reactor.inc/account/api-keys
                </a>
                . It starts with <code className="text-zinc-200">rk_</code>.
              </span>
            </li>
            <li className="flex gap-3">
              <Step>2</Step>
              <div className="min-w-0 flex-1">
                <p>
                  Save it as the backend secret{" "}
                  <code className="text-zinc-200">REACTOR_API_KEY</code>.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <Step>3</Step>
              <span>Restart the preview so the new variable is picked up.</span>
            </li>
          </ol>
        </div>
      </main>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-700 text-[11px] text-zinc-400">
      {children}
    </span>
  );
}
