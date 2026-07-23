import { createFileRoute } from "@tanstack/react-router";
import { HappyOysterApp } from "@/components/happy-oyster/HappyOysterApp";
import { SetupRequired } from "@/components/happy-oyster/SetupRequired";
import { getReactorSetup } from "@/lib/happy-oyster/reactor-setup.functions";

// /discover — the full HappyOyster app (happy-oyster repo), hosted as a page
// of this project. The gate mirrors happy-oyster's app/page.tsx:
//   - VITE_HO_LOCAL_RUNTIME=1 → the live app against a local runtime (no key)
//   - REACTOR_API_KEY set     → the live app, which mints JWTs server-side
//   - none                    → the <SetupRequired /> landing
//
// ssr: false — the Reactor SDK is WebRTC/browser-only, so this route renders
// entirely on the client (the Next.js original used `force-dynamic` + client
// components for the same reason).

export const Route = createFileRoute("/discover")({
  ssr: false,
  loader: () => getReactorSetup(),
  head: () => ({
    meta: [
      { title: "HappyOyster — Discover" },
      {
        name: "description",
        content:
          "Build a world from a prompt, then travel it live, WASD in Adventure, text in Directing.",
      },
    ],
  }),
  component: DiscoverPage,
});

function DiscoverPage() {
  const { hasKey } = Route.useLoaderData();
  const localRuntime = import.meta.env.VITE_HO_LOCAL_RUNTIME === "1";
  const showApp = localRuntime || hasKey;

  // .ho-scope + dark scope HappyOyster's theme tokens (Reactor gold primary,
  // 4px radius, Reactor fonts, dark scrollbars) to this page only — the rest
  // of the app keeps its own design system. See src/styles/happy-oyster.css.
  return (
    <div className="ho-scope dark font-sans antialiased">
      {showApp ? <HappyOysterApp /> : <SetupRequired />}
    </div>
  );
}
