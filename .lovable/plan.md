## Hero refinement

**File:** `src/components/zap/LandingHero.tsx`

1. Remove the `ZAP · LIVE` pill (lines 124–126) from above the Strands/ASCII block, where it currently floats at the very top of the hero.
2. Re-mount the same pill directly beneath the `ASCIIText` wordmark, sitting above the tagline paragraph. Keep the identical `ShinyText` styling (color `#8a8f98`, shine `#ffffff`, uppercase `.28em` tracking, rounded glass border) so the badge reads as a label anchored to "Zap!".
3. Tighten spacing so the stack reads: `Zap!` ASCII → pill (`mt-2 md:mt-4`) → tagline (`mt-4 md:mt-6`) → glass CTA. No other layout, background, or Strands changes.

Result: the pill functions as a caption under the wordmark instead of a stray chip in the top gutter, matching the annotated screenshot.