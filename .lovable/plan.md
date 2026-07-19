Plan: Reposition the Computah voice button in DesktopStage

Scope
- Only the desktop live-stage UI (`src/components/zap/stage/DesktopStage.tsx`).
- The voice button currently lives in the top-right header next to Record / Disconnect.
- Move it to the left of the prompt input field in the bottom prompt dock.

What will change
1. Remove the Computah `<button>` block from the top-right header actions (lines 124–153 in `DesktopStage.tsx`).
2. Insert the same Computah `<button>` as the first element inside the prompt dock’s inner flex row, immediately before the `<input>`.
3. Preserve all existing behavior and state styling:
   - `onClick={p.toggleVoice}`
   - `disabled={!p.voiceAvailable}`
   - state-driven colors for `off`, `armed`, `connecting`, `thinking`, `error`
   - pulsing status dot
   - "🎙 Computah" label
4. Keep the title/tooltip text intact.
5. Add a small right margin or use the existing `gap-2` so the button sits cleanly apart from the input.

Out of scope
- No changes to voice logic, `index.tsx`, or mobile stage.
- No changes to Computah functionality or the voice agent pipeline.

Verification
- Typecheck the project.
- Visually confirm in desktop preview that the Computah button now appears inside the bottom prompt bar to the left of the text input, and that the top-right header no longer contains it.