import type { Database } from "@/integrations/supabase/types";

export type Preset = Database["public"]["Tables"]["presets"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type TakeRow = Database["public"]["Tables"]["takes"]["Row"];

export type PromptEventKind = "apply" | "undo" | "clear" | "preset" | "reactive";
export type PromptEventSource = "text" | "gesture" | "face" | "preset" | "remote";

export type PromptState = {
  text: string;
  refImage?: string; // data URI
  refPath?: string; // storage path
};

export type VisionEvent = {
  kind: "gesture" | "face";
  label: string;
  score: number;
  action?: string;
  at_ms: number;
};

export type ConnectionState =
  | "idle"
  | "requesting_camera"
  | "camera_ready"
  | "connecting"
  | "live"
  | "reconnecting"
  | "failed";

export const LUCY_APP = "decart/lucy-2-5/realtime";

export const REACTIVE_PROMPTS: Record<string, string> = {
  confetti:
    "Add colorful confetti falling around the person and bouncing lightly off their shoulders.",
  sparkle:
    "Add small glowing golden sparkles floating around the person's head and shoulders, drifting with their movement.",
};

export type RemoteMessage =
  | { type: "apply"; prompt: string; refImage?: string }
  | { type: "preset"; presetId: number }
  | { type: "clear" }
  | { type: "undo" };
