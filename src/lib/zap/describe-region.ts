/**
 * describeRegion — turn a normalized (0..1) point on the camera frame into a
 * human-readable spatial fragment we can inject into Lucy prompts. A 3x3 grid
 * gives Lucy enough spatial resolution ("upper-left", "center") without over-
 * constraining the model.
 *
 * The camera PiP is mirrored (`-scale-x-100`) for the user, so a point at
 * x=0.1 (raw video left) appears on the *user's* right. We mirror x here so
 * "point to what looks like your right" maps to what Lucy sees.
 */
export type Zone =
  | "upper-left" | "upper-center" | "upper-right"
  | "center-left" | "center" | "center-right"
  | "lower-left" | "lower-center" | "lower-right";

const ZONE_PHRASE: Record<Zone, string> = {
  "upper-left": "at the upper left of the frame",
  "upper-center": "at the top center of the frame",
  "upper-right": "at the upper right of the frame",
  "center-left": "on the left side of the frame",
  "center": "at the center of the frame",
  "center-right": "on the right side of the frame",
  "lower-left": "at the lower left of the frame",
  "lower-center": "at the bottom center of the frame",
  "lower-right": "at the lower right of the frame",
};

export function describeRegion(x: number, y: number, opts?: { mirror?: boolean }): {
  zone: Zone;
  phrase: string;
} {
  const mx = opts?.mirror === false ? x : 1 - x;
  const col = mx < 1 / 3 ? "left" : mx < 2 / 3 ? "center" : "right";
  const row = y < 1 / 3 ? "upper" : y < 2 / 3 ? "center" : "lower";
  const zone = (row === "center" && col === "center"
    ? "center"
    : `${row}-${col}`) as Zone;
  return { zone, phrase: ZONE_PHRASE[zone] };
}
