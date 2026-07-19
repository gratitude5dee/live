## Already the case — confirm and lock it in

After the last change, the outbound stream to Lucy is already routed per preset category:

| Preset category | template_key | Baked into Lucy stream |
| --- | --- | --- |
| Character Swap (YE, DRAKE, N3ON, MBAPPE) | `character_swap` | Face landmarks |
| Gesture FX (Fire Hands) | `gesture_fx` | Hand landmarks |
| Templates (Object add-in, Try-on, Object replace) | `object_add` / `clothing_tryon` / `object_replace` | **Clean camera** |
| Looks (Beach, Neon City, Anime, Watercolor, Sketch, Crown, Cyberpunk, Clean Studio, NFL Night, Soccer Daylight, Try-On) | none | **Clean camera** |
| No preset applied | — | **Clean camera** |

The on-screen PiP still overlays both face + hands for user feedback; only the outbound frame to Lucy is gated.

## Small hardening pass I'll ship in the same edit

To guarantee the "clean by default" contract can't regress:

1. **`src/routes/index.tsx` compositor callback** — add an explicit early return with a comment so the default branch is the raw video frame, and no accidental overlay call can slip in:
   ```ts
   const kind = activePresetKindRef.current;
   if (kind === "character_swap") drawFaceOverlay(ctx, faceEngineRef.current?.lastResult ?? null);
   else if (kind === "gesture_fx") drawHandOverlay(ctx, lastGestureResultRef.current, lastHoldRef.current);
   // else: send the raw webcam frame — no MediaPipe baked in.
   ```
2. **Reset on template apply** — in `applyTemplate` (Object add-in / Try-on / Object replace), explicitly set `activePresetKindRef.current = "other"` so switching from a Character Swap into a template immediately drops the face bake.
3. **Reset on manual prompt apply** — in the free-text `applyPrompt` path (when `source !== "preset"`), also reset to `"other"`.
4. **Reset on `stopSession`** — set back to `"other"` on teardown (already true via `clearPrompt`, but make it explicit in the stop path too).

No schema, no UI, no compositor internals change. Just tightening the gate so the outbound stream stays clean unless a preset explicitly opts in.
