## Root cause

When the user clicks **Zap Live**, `startSession()` runs:

1. `setConnState("requesting_camera")` — schedules a re-render (still on the LandingHero screen, so no `<video>` elements are mounted yet).
2. `await navigator.mediaDevices.getUserMedia(...)` — resolves quickly; React hasn't necessarily flushed yet.
3. `if (inputVideoRef.current) inputVideoRef.current.srcObject = stream;` — the ref is still `null`, so **the assignment is silently skipped**.
4. Session, transport, and fal all continue and eventually reach `live` — matching the "live · frame" chip in the screenshot — but the PiP video element mounts later with no `srcObject` and stays black.

The same race can affect `outputVideoRef` (frame-mode's canvas captureStream is delivered via `onOutputStream` after the connection settles, so it usually wins, but it's the same anti-pattern).

The MediaPipe "memory access out of bounds" warnings are unrelated noise from running inference against a video that has no frames — they'll stop once the stream is actually attached.

## Fix

Stop assigning `srcObject` imperatively inside `startSession`. Store the input stream in state and attach it from a `useEffect` keyed on the stream + the ref. Do the same for the output stream so both videos are declarative.

### Changes to `src/routes/index.tsx`

1. Add two state values alongside the existing refs:
   - `const [inputStream, setInputStream] = useState<MediaStream | null>(null);`
   - `const [outputStream, setOutputStream] = useState<MediaStream | null>(null);`
2. In `startSession`, after `getUserMedia`, call `setInputStream(stream)` (keep `inputStreamRef.current = stream` for the transport/recorder paths that read it synchronously). Remove the `inputVideoRef.current.srcObject = ...` + `.play()` block.
3. In the transport `onOutputStream` callback, call `setOutputStream(out)` (keep `outputStreamRef.current = out`). Remove the imperative `outputVideoRef.current.srcObject = ...` block.
4. Add one `useEffect` that attaches whichever stream is present:
   ```ts
   useEffect(() => {
     const v = inputVideoRef.current;
     if (v && inputStream && v.srcObject !== inputStream) {
       v.srcObject = inputStream;
       v.play().catch(() => {});
     }
   }, [inputStream]);
   useEffect(() => {
     const v = outputVideoRef.current;
     if (v && outputStream && v.srcObject !== outputStream) {
       v.srcObject = outputStream;
       v.play().catch(() => {});
     }
   }, [outputStream]);
   ```
5. Add `autoPlay` to both `<video>` elements as a defensive measure so a rejected `.play()` promise (autoplay policy edge cases) still resolves on the next user gesture.

### Notes

- No changes to `VideoTransport`, session/DB, MediaPipe, or the landing flow.
- Inference loop already guards on `inputVideoRef.current.readyState >= 2`, so it just starts producing real results once the stream is attached.
- The MediaPipe wasm warnings should disappear once frames exist; if any persist they're benign and unrelated to this bug.

### Validation

- Click **Zap Live** → PiP shows the webcam within ~1s and the main stage shows Lucy output once `live`.
- Header chip still reads `live · webrtc` or `live · frame`.
- No regression to Record, presets, Apply, Undo, Clear, or remote broadcast.
