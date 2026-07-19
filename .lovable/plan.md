# Add disconnect control + 90s auto-disconnect

## Changes

### `src/routes/index.tsx`
- Track `liveStartedAt` when the transport reports `onTransportChosen` (i.e. Lucy stream is live).
- Start a 90-second timer at that moment; on expiry, call the same `stopSession()` path used for manual teardown and surface a toast/status: "Session ended after 90s".
- Add a visible **Disconnect** button in the live HUD (top-right of the stage, next to existing session stats). Clicking it:
  - Clears the auto-disconnect timer
  - Calls `stopSession()` (closes `VideoTransport`, stops MediaPipe loop, stops the webcam tracks, flushes vision buffer, marks the session ended)
  - Returns the UI to the `LandingHero` state so the user can start a new session
- Add a live countdown badge ("Ends in 1:23") next to the Disconnect button, updated once per second, so the auto-stop is not surprising.
- Ensure the timer is cleared on unmount and on any error path that already tears down the transport.

### Nothing else changes
- No transport, signaling, or fal changes.
- No schema, auth, presets, or remote-control changes.
- The 90s window is a hard client-side cap; the underlying fal token continues to auto-refresh until we close, so no server changes needed.

## Verification
Click **Zap Live** → wait for "live" → confirm countdown appears and Disconnect button works immediately. Let a second session run untouched and confirm it tears down cleanly at 0:00 with camera light off and UI back on landing.
