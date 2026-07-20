import type { Database } from "@/integrations/supabase/types";

export type Preset = Database["public"]["Tables"]["presets"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type TakeRow = Database["public"]["Tables"]["takes"]["Row"];

export type PromptEventKind = "apply" | "undo" | "clear" | "preset" | "reactive";
export type PromptEventSource = "text" | "gesture" | "face" | "preset" | "remote" | "voice";

export type VoiceState = "off" | "connecting" | "armed" | "thinking" | "error";

export type RefImage = {
  /** Public/signed URL — preferred: ~100 bytes over the WS instead of ~400 KB base64. */
  url?: string;
  /** data:image/jpeg;base64,... — fallback when storage upload hasn't completed. */
  dataUri?: string;
  /** Supabase Storage path, for logging + re-mint. */
  path?: string;
};

export type PromptState = {
  text: string;
  /** Reference image sent to Lucy. Prefer `refUrl`; `refImage` (data URI) is fallback. */
  refImage?: string; // data URI (legacy / fallback)
  refUrl?: string; // remote URL (preferred)
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
