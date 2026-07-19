## What's still broken

Screenshot shows `connState = live · frame`, MediaPipe reports `None 0.99` (a real gesture-recognizer result), and the hand-skeleton overlay is drawn — so the camera stream IS live and MediaPipe IS reading valid pixels from `inputVideoRef.current`. But both `<video>` elements (main output and PiP camera) render black.

Root cause: the current attach path is `useState + useEffect`.

```tsx
useEffect(() => {
  const v = inputVideoRef.current;
  if (v && inputStream && v.srcObject !== inputStream) {
    v.srcObject = inputStream;
    v.play().catch(() => {});
  }
}, [inputStream]);
```

Two ordering problems this pattern has:

1. When `connState` transitions `idle → requesting_camera` and `setInputStream(stream)` fire in the same async tick, the effect can run in a commit where `inputVideoRef.current` was assigned but the browser hasn't yet flushed layout for the freshly-mounted `<video>`. On some browsers the `srcObject` write on a not-yet-connected video does nothing until the next microtask (`play()` resolves but the compositor never gets a frame). MediaPipe's WebGL path still reads via a texture upload from the element, which is why gesture recognition works even though the on-screen `<video>` is black.
2. The effect only re-runs when `inputStream` changes — not when React ever remounts the `<video>` node. Any structural change (HUD toggle changing the PiP wrapper class, overlay resize, error banner appearing) that causes reconciliation to swap the node loses `srcObject` silently.

## Fix

Replace both `ref={inputVideoRef}` / `ref={outputVideoRef}` with **callback refs** that attach `srcObject` at the exact moment the element mounts, and reattach on any remount. Keep the mutable refs so existing consumers (MediaPipe loop, MediaRecorder, cleanup) still work.

```tsx
const attachInputVideo = useCallback((el: HTMLVideoElement | null) => {
  inputVideoRef.current = el;
  if (el && inputStreamRef.current && el.srcObject !== inputStreamRef.current) {
    el.srcObject = inputStreamRef.current;
    el.play().catch(() => {});
  }
}, []);

const attachOutputVideo = useCallback((el: HTMLVideoElement | null) => {
  outputVideoRef.current = el;
  if (el && outputStreamRef.current && el.srcObject !== outputStreamRef.current) {
    el.srcObject = outputStreamRef.current;
    el.play().catch(() => {});
  }
}, []);
```

Then in `startSession` and `onOutputStream`, after setting the *Ref*, also attempt an immediate attach if the element is already mounted:

```tsx
inputStreamRef.current = stream;
if (inputVideoRef.current) {
  inputVideoRef.current.srcObject = stream;
  inputVideoRef.current.play().catch(() => {});
}
```

This covers both directions: stream-first (video mounts later → callback ref attaches) and video-first (stream arrives later → imperative attach).

Remove:
- the `inputStream` / `outputStream` `useState` variables
- the two `useEffect` blocks that watched them
- `setInputStream` / `setOutputStream` calls

Replace `ref={inputVideoRef}` → `ref={attachInputVideo}` and same for output.

## Secondary fix (MediaPipe WASM crash)

Console shows `RuntimeError: memory access out of bounds` from `vision_wasm_internal.wasm` on every frame. This happens when `recognizeForVideo` / `detectForVideo` is called with monotonically-close timestamps or with `videoWidth === 0`. Tighten the inference-loop guard:

```tsx
const v = inputVideoRef.current;
if (v && v.readyState >= 2 && v.videoWidth > 0 && frame % everyN === 0) {
  const ts = Math.round(performance.now());
  // ...
}
```

and pass integer `ts` (MediaPipe requires strictly increasing integer µs-ish timestamps; `ts + 0.1` for the face call violates that on repeats). Use `ts` and `ts + 1`.

## Files changed

- `src/routes/index.tsx` — callback refs, delete `inputStream`/`outputStream` state + effects, harden inference-loop guard, integer timestamps.

## Verification

After the change, on the deployed preview: click Zap Live → camera feed appears in PiP within one frame, Lucy output appears in main stage once fal returns. MediaPipe WASM warnings drop to zero when the video is ready.
