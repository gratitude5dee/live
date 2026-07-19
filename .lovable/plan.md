## Hero layout adjustment

Reorder the hero column in `src/components/zap/LandingHero.tsx` so the glass "Zap Live" CTA sits directly beneath the ASCII wordmark.

New vertical order under the `Strands` centerpiece:
1. `ASCIIText` "Zap!" wordmark
2. Glass CTA button ("Zap Live") — moved up, tighter top margin
3. "ZAP · LIVE" pill — moved below the CTA
4. Tagline paragraph ("Create your reality in realtime…")
5. "Uses your camera…" fine print

### Technical notes
- Single-file change: `src/components/zap/LandingHero.tsx`.
- Move the `GlassSurface` block (lines ~159–197) to immediately follow the ASCII container (line ~141).
- Adjust top margins: CTA `mt-6 md:mt-8`, pill `mt-4`, tagline `mt-6`, keep fine print `mt-6`.
- No prop, state, or logic changes; purely presentational reorder.