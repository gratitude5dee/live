## OptionWheel: fix stacking + upgrade visual polish

### Root cause of the stacked labels
The rAF layout tries to place items before their refs are attached in the React 19 commit order. When presets load async (empty → 6 items), the layout effect fires once, but if `settled` is true on the first frame (`pos === target === 0`), the loop paints exactly one frame — and that frame runs before the item refs are guaranteed populated in some renders. Result: every `.option-wheel__item` keeps its default CSS (`position:absolute; top:50%; left:40px`) and stacks on top of each other, exactly like the screenshot.

### Fixes in `src/components/reactbits/OptionWheel.tsx`
1. Swap the layout-driving `useEffect` for `useLayoutEffect` so item transforms are written before browser paint.
2. Track `items.length` and re-run the initial layout after refs are attached (call `applyTarget(targetRef.current, false)` inside a `useLayoutEffect` keyed on `items`).
3. In `runFrame`, always paint at least one full pass on the first tick (bypass the `settled` early-exit for the very first invocation after a config change) — guarantees every item gets a transform once refs land.
4. Guard against a null `el` and skip clearing existing entries when the callback ref is called with `null` (React unmount transient).

### Visual upgrade in `src/components/reactbits/OptionWheel.css`
Match the reference (Awwwards-tier, apple-esque):
- Font family: use the app's premium display stack (fall back to `ui-sans-serif`), weight `300` resting / `600` selected, letter-spacing `-0.03em`.
- Selected item: gradient text fill (`cyan → violet → pink`) via `background-clip:text`, plus a soft cyan glow.
- Add a subtle **center indicator bar** — a 2px horizontal accent on the anchored edge (`left:0`, `top:50%`, `width:24px`, gradient white→transparent) so the "active slot" reads clearly.
- Remove the harsh black gradient masks in `ChooseReality` that were hiding the first characters; replace with a single soft radial vignette behind the wheel.
- Increase container height to `600px`, bump `inset` to `56`, `fontSize` to `3.2`, `spacing` to `1.55`, `tilt` to `8`, `blur` to `1.2` for a more premium curl.
- On mobile (`<768px`) drop `fontSize` to `2.2` and `inset` to `28`, and stack wheel above preview card.

### Section polish in `src/components/zap/ChooseReality.tsx`
- Vertically align the wheel middle with the preview card middle (`items-center` + matching min-heights).
- Preview card wrapped in a Double-Bezel: outer `bg-white/[0.04] p-1.5 ring-1 ring-white/10 rounded-[2.25rem]`, inner card `rounded-[calc(2.25rem-0.375rem)]`.
- Add loop `loop={true}` so the wheel wraps infinitely — feels endless.
- Wire a soft tick sound (optional, only if `sessionStorage.zaplive.mute !== '1'`) using a data-URI base64 short click so no asset upload needed.
- Preload the next/prev preset thumbnail so switching feels instant.

### Not changing
- Wheel component API stays identical; drop-in.
- No DB/schema changes.

Result: labels lay out along the curve, active option pops with gradient + glow, alignment matches the reference, no clipped characters.
