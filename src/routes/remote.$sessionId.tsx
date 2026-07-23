import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/remote/$sessionId")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — Remote" },
      { name: "description", content: "Control a ZAP·LIVE stage from your phone." },
      { property: "og:title", content: "ZAP·LIVE — Remote" },
      { property: "og:description", content: "Control a ZAP·LIVE stage from your phone." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "viewport", content: "width=device-width, initial-scale=1, maximum-scale=1" },
    ],
  }),
});