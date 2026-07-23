import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ZAP·LIVE — realtime video editor" },
      { name: "description", content: "Edit your live camera feed with prompts, gestures, and reference images in realtime." },
      { property: "og:title", content: "ZAP·LIVE — realtime video editor" },
      { property: "og:description", content: "Edit your live camera feed with prompts, gestures, and reference images in realtime." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});