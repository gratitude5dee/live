## Goal
After the user uploads a new reference image, show an **Apply** button on the ref-image chip that sends the current prompt together with the new ref image to Lucy in one call.

## Current behavior
- `onRefUpload` (src/routes/index.tsx) stores the image in state via `setRefImage` and uploads to the `refs` bucket, but never forwards it to Lucy.
- The ref is only pushed to Lucy when a preset/template is applied (`applyPreset` / `applyTemplate` → `applyPrompt(..., ref)`).
- Typing a new prompt and pressing Enter calls `applyPrompt(text, "text")` — it does NOT include `refImage`, so uploaded refs are silently ignored.

## Changes

### 1. `src/routes/index.tsx`
- Fix `handleSubmit` / text-input apply path to pass the currently uploaded `refImage` into `applyPrompt` (so the normal prompt-submit flow also honors the ref).
- Add new handler `applyRefImage()`:
  - Guard: transport ready + `refImage` present.
  - Use `prompt.trim() || applied?.text` as the prompt text. If neither exists, `toast.error("Type a prompt first")`.
  - Call `applyPrompt(text, "text", refImage)` and toast "Applied with reference".
- Add derived flag `refImagePending = !!refImage && refImage.dataUri !== applied?.refImage`.
- Expose `applyRefImage` and `refImagePending` through the stage view props.

### 2. `src/components/zap/stage/types.ts`
- Add `applyRefImage: () => void` and `refImagePending: boolean` to `StageViewProps`.

### 3. `src/components/zap/stage/DesktopStage.tsx` and `MobileStage.tsx`
- In the ref-image chip (currently shows the thumbnail + `×` remove button):
  - When `refImagePending` is true, render a small "Apply" specular button beside the thumbnail (and a subtle pulsing ring on the chip to signal a pending ref).
  - Clicking it calls `p.applyRefImage()`.
  - Once applied (dataUri matches `applied.refImage`), hide the Apply button.

## Out of scope
- No changes to fal transport, storage schema, presets, or gesture pipeline.
- No changes to `clearRefImage` behavior.