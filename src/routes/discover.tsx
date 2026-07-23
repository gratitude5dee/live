import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { SetupRequired } from "@/components/happy-oyster/SetupRequired";
import { getReactorSetup } from "@/lib/happy-oyster/reactor-setup.functions";

// /discover — the full HappyOyster app, hosted as a page of this project.
//
// ssr: false — the Reactor SDK is WebRTC/browser-only. But ssr:false only
// skips *rendering* on the server; TanStack Start still loads this route's
// module server-side to answer the loader. A static import of HappyOysterApp
// would drag the ~1.7MB Reactor SDK into the Cloudflare Worker bundle, where
// its browser-globals module-init crashes every request (500 across the
// site). React.lazy defers the import until the browser mounts the route.
const HappyOysterApp = lazy(() =>
  import("@/components/happy-oyster/HappyOysterApp").then((m) => ({
    default: m.HappyOysterApp,
  })),
);

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

  return (
    <div className="ho-scope dark font-sans antialiased">
      {showApp ? (
        <Suspense fallback={<div className="min-h-dvh bg-zinc-950" />}>
          <HappyOysterApp />
        </Suspense>
      ) : (
        <SetupRequired />
      )}
    </div>
  );
}
