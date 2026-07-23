import { createFileRoute } from "@tanstack/react-router";

// How long we ask Reactor to make the JWT valid for. The server caps
// this at its configured maximum (currently 6h), so asking for more
// is harmless, you just get the server max back.
const TOKEN_LIFETIME_SECONDS = 6 * 60 * 60;

// Safety margin on the cache lifetime so an in-flight request doesn't
// race with the real expiry.
const CACHE_SKEW_SECONDS = 60;

export const Route = createFileRoute("/api/reactor/token")({
  server: {
    handlers: {
      // Mint a Reactor JWT and return it with a `Cache-Control` header
      // that lets the browser reuse it for the rest of its lifetime.
      // GET (not POST) so the browser HTTP cache can serve repeat calls;
      // `private` so shared caches never store per-user tokens.
      GET: async () => {
        const apiKey = process.env.REACTOR_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "REACTOR_API_KEY is not set on the server" },
            { status: 500 },
          );
        }

        const baseUrl =
          process.env.COORDINATOR_URL || "https://api.reactor.inc";

        const res = await fetch(`${baseUrl}/tokens`, {
          method: "POST",
          headers: {
            "Reactor-API-Key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ expires_after: TOKEN_LIFETIME_SECONDS }),
        });

        if (!res.ok) {
          return Response.json(
            { error: `Reactor /tokens returned ${res.status}` },
            { status: 502 },
          );
        }

        const { jwt, expires_at } = (await res.json()) as {
          jwt: string;
          expires_at: number;
        };

        const nowSeconds = Math.floor(Date.now() / 1000);
        const maxAge = Math.max(
          0,
          expires_at - nowSeconds - CACHE_SKEW_SECONDS,
        );

        return Response.json(
          { jwt },
          {
            headers: {
              "Cache-Control": `private, max-age=${maxAge}`,
            },
          },
        );
      },
    },
  },
});
