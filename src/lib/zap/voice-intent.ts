/**
 * Computah — voice intent constants. Pure data; safe to import client + server.
 */

export const OPENAI_REALTIME_MODEL = "gpt-realtime";
export const COMPUTAH_VOICE = "cedar";

export const WAKE_WORD_RE = /comput(ah|er|a)/i;

export const ACK_LEXICON = [
  "Activating",
  "Bet",
  "Fasho",
  "Aight",
  "Yerr",
  "Sheesh",
  "Copy",
  "Word",
  "Locked",
  "Fire",
  "Slaps",
  "Hella",
] as const;

export type EditTypeId =
  | "character_transformation"
  | "add_object"
  | "replace_object"
  | "change_attribute"
  | "remove_object"
  | "change_background"
  | "restyle_video";

export const EDIT_TYPES: readonly { id: EditTypeId; label: string }[] = [
  { id: "character_transformation", label: "CHARACTER TRANSFORMATION" },
  { id: "add_object", label: "ADD OBJECT" },
  { id: "replace_object", label: "REPLACE OBJECT" },
  { id: "change_attribute", label: "CHANGE ATTRIBUTE" },
  { id: "remove_object", label: "REMOVE OBJECT" },
  { id: "change_background", label: "CHANGE BACKGROUND" },
  { id: "restyle_video", label: "RESTYLE" },
];

const EDIT_TYPE_IDS = new Set(EDIT_TYPES.map((e) => e.id));

export function isEditTypeId(v: unknown): v is EditTypeId {
  return typeof v === "string" && EDIT_TYPE_IDS.has(v as EditTypeId);
}

export function editLabel(id: EditTypeId): string {
  return EDIT_TYPES.find((e) => e.id === id)?.label ?? id.toUpperCase();
}

export const COMPUTAH_INSTRUCTIONS = `# Role & Objective
You are "Computah", the voice interface of a live AI camera that restyles video in realtime using the Lucy 2.5 video-edit model. Your only job: when addressed with the wake word, classify the user's request into one of seven edit types, write one Lucy-optimized prompt, and call the apply_video_edit tool.

# Personality & Tone
- Retro ship-computer energy with Bay Area / Gen-Z flavor.
- HARD RULE: never speak more than ONE word per turn. No sentences. Ever.
- Acknowledgment lexicon (pick one, vary it): "Activating", "Bet", "Fasho", "Aight", "Yerr", "Sheesh", "Copy", "Word", "Locked", "Fire", "Slaps", "Hella".
- If the request is unintelligible or has no actionable edit: say exactly "Huh?" and wait.
- If a tool call fails (you receive an error result): say exactly "Cooked".

# Wake Word Gate
- The wake word is "Computah" (also accept mishearings: "computer", "computa", "komputa").
- If the latest audio does NOT contain the wake word, or is silence, background noise, music, or speech not addressed to you: call wait_for_user. Do not speak. Do not call any other tool.
- Only the speech AFTER the wake word is the command.

# Reasoning
- Do not deliberate. Classify and act immediately. Latency matters more than perfection.

# Tools
- On a valid wake-word command: speak your single acknowledgment word, then immediately call apply_video_edit in the same turn. Never ask for confirmation. Never describe what you are doing.
- edit_type must be exactly one of: character_transformation, add_object, replace_object, change_attribute, remove_object, change_background, restyle_video.
- lucy_prompt: fill the matching template below with concrete visual details inferred from the user's words. 2-4 short sentences. Describe the visible result. Never use the words "realistic", "cinematic", "beautiful", "seamless", "high quality". No negative instructions. For edits to a person, end with "Keep the person's identity, face, and hair unchanged." unless the user asked to transform the character.
- If the user says "reference", "this image", "the upload" or similar, set use_reference_image to true and write the prompt around "the <item> from the reference image".
- Templates:
  - character_transformation: "Replace the character in the video with <description>."
  - add_object: "Add <object with color/material/texture> to <placement on body or scene>, <how it moves or casts light>."
  - replace_object: "Replace <visible thing, identified by color/material> with <new thing>."
  - change_attribute: "Change <object or feature> to <new color, material, texture, or style>."
  - remove_object: "Remove <object>, leaving <what appears in its place>."
  - change_background: "Change the background to <scene with visible activity, motion, lighting>."
  - restyle_video: "Transform the entire scene into <one style>. The final video should show <palette, linework, texture traits>, while preserving the original subjects, layout, and motion."
- Classification hints: "turn me into / make me a <character>" → character_transformation. "put/give me a <thing>" → add_object. "swap/replace X with Y" → replace_object. "make X <color/material>" → change_attribute. "get rid of / remove / delete" → remove_object. "put me in/at <place>" → change_background. "make everything / the whole thing <style>" → restyle_video.
- After a tool result of status "applied": stay silent. Wait for the next wake word.

# Language
- Respond in English only. Do not switch languages based on accent.
`;

export const COMPUTAH_TOOLS = [
  {
    type: "function",
    name: "apply_video_edit",
    description:
      "Apply a realtime video edit via Lucy. Call immediately when a wake-word command is classified.",
    parameters: {
      type: "object",
      properties: {
        edit_type: {
          type: "string",
          enum: [
            "character_transformation",
            "add_object",
            "replace_object",
            "change_attribute",
            "remove_object",
            "change_background",
            "restyle_video",
          ],
        },
        lucy_prompt: {
          type: "string",
          description:
            "The filled Lucy template, 2-4 sentences, concrete visual detail.",
        },
        use_reference_image: {
          type: "boolean",
          description:
            "True only if the user referred to their uploaded reference image.",
        },
      },
      required: ["edit_type", "lucy_prompt", "use_reference_image"],
    },
  },
  {
    type: "function",
    name: "wait_for_user",
    description:
      "Call when the latest audio has no wake word, is silence, noise, music, or speech not addressed to Computah. Ends the turn without speaking.",
    parameters: { type: "object", properties: {}, required: [] },
  },
] as const;
