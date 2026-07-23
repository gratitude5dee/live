import { createFileRoute } from "@tanstack/react-router";
import { getReactorSetup } from "@/lib/happy-oyster/reactor-setup.functions";

export const Route = createFileRoute("/discover")({
  ssr: false,
  loader: () => getReactorSetup(),
  head: () => ({
    meta: [
      { title: "HappyOyster — Discover" },
      { name: "description", content: "Build a world from a prompt, then travel it live in Adventure or Directing mode." },
      { property: "og:title", content: "HappyOyster — Discover" },
      { property: "og:description", content: "Build a world from a prompt, then travel it live in Adventure or Directing mode." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});