import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/library")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — Archive" },
      { name: "description", content: "View, download, and manage every take Zap has repainted." },
      { property: "og:title", content: "ZAP·LIVE — Archive" },
      { property: "og:description", content: "View, download, and manage every take Zap has repainted." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});