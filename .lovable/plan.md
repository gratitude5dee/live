## Goal
On the landing page, keep SFX only for real button interactions (press/release/toggle). Remove non-button audio cues.

## Change
- `src/components/zap/ModesSection.tsx` (line 60): remove the `play("sparkle")` call fired on every `InfiniteMenu` snap. This is the continuous/ambient-feeling cue on the landing page (rapid re-fires while the wheel scrolls).

## Keep
- Button press/release on `LandingHero` CTA.
- Button press/toggle in `ChooseReality`.
- `BubbleMenu` button press + sfx toggle.

No other files change; global sfx init and the mute toggle stay as-is.