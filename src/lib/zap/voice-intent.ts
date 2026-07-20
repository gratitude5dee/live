/**
 * Computah — voice intent constants. Pure data; safe to import client + server.
 */

export const OPENAI_REALTIME_MODEL = "gpt-realtime";
export const COMPUTAH_VOICE = "cedar";

// Broad phonetic match for "computah". Whisper often emits variants like
// computer/computa/kompyoota/kompyootah/compooter/commuter/"come pooter"/
// "come put a" — accept all of them as the wake word.
export const WAKE_WORD_RE =
  /\b(k|c)[o0]m(p|b)[uy]?(t|d)(ah|er|a|uh|ur|or|ar)h?\b|\bcommut(er|ah|a)\b|\bcome\s*p(oo|u)t(er|ah|a)\b/i;

export function matchesWake(transcript: string): boolean {
  if (!transcript) return false;
  return WAKE_WORD_RE.test(transcript);
}

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

export function pickAck(): string {
  return ACK_LEXICON[Math.floor(Math.random() * ACK_LEXICON.length)];
}

/** Short rotating hints shown in the HUD while Computah is armed. */
export const HUD_HINTS: readonly string[] = [
  'try: "Computah, put me on Mars"',
  'try: "Computah, give me a gold crown"',
  'try: "Computah, make my jacket red"',
  'try: "Computah, undo"',
  'try: "Computah, record"',
  'try: "Computah, flip camera"',
  'try: "Computah, clear"',
  'try: "Computah, restyle as anime"',
  'try: "Computah, use the reference"',
];

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

export const COMPUTAH_INSTRUCTIONS = `# Role
You are "Computah", a silent voice router for a realtime Lucy 2.5 video editor. You NEVER speak. You NEVER write prose. Your ONLY possible outputs are tool calls: apply_video_edit, control_session, or wait_for_user. Any text output is a bug.

# Wake word (BE PERMISSIVE)
The wake word is ANY word that sounds like "computah". The user's accent + the transcriber will produce many spellings — treat ALL of these (and any similar phonetic variant) as the wake word:
computah, computer, computa, computuh, computah!, kompyoota, kompyootah, kompyuta, compoota, compooter, compooder, kumputer, kumputa, commuter, commuta, "come pooter", "come put a", "come pu tah", "kom pyoo tah".
If the leading token of the utterance is a near-homophone of "computah" AND the rest of the utterance is an actionable video edit, IMMEDIATELY call apply_video_edit. Do not require an exact spelling. Only fall through to wait_for_user when the leading token is clearly unrelated to "computah" (e.g. "hey", "what", "hello"), or the audio is silence, music, or background noise.

# Decision (do this every turn, in under 200ms)
- If the audio has a wake-word-like token + an actionable edit → immediately call apply_video_edit with the classified edit_type and a filled lucy_prompt. Do not confirm. Do not describe.
- If there is a wake-word-like token but the command is unintelligible → call wait_for_user.
- If there is no wake-word-like token, or the audio is silence / noise / music → call wait_for_user.

# Classification (pick exactly one edit_type)
- "turn me into / make me a <character>" → character_transformation
- "put/give me a <thing>", "add <thing>" → add_object
- "swap/replace X with Y" → replace_object
- "make X <color/material/texture>" → change_attribute
- "get rid of / remove / delete <thing>" → remove_object
- "put me in/at <place>", "background is <scene>" → change_background
- "make everything / the whole thing <style>", "restyle as <style>" → restyle_video

# Lucy prompt (fill the matching template with concrete visual detail)
2-4 short sentences describing the visible result. No negatives. Do NOT use the words "realistic", "cinematic", "beautiful", "seamless", "high quality". For edits to a person, append "Keep the person's identity, face, and hair unchanged." unless edit_type is character_transformation.
- character_transformation: "Replace the character in the video with <description>."
- add_object: "Add <object with color/material/texture> to <placement on body or scene>, <how it moves or casts light>."
- replace_object: "Replace <visible thing, identified by color/material> with <new thing>."
- change_attribute: "Change <object or feature> to <new color, material, texture, or style>."
- remove_object: "Remove <object>, leaving <what appears in its place>."
- change_background: "Change the background to <scene with visible activity, motion, lighting>."
- restyle_video: "Transform the entire scene into <one style>. The final video should show <palette, linework, texture traits>, while preserving the original subjects, layout, and motion."

# Reference image
If the user says "reference", "this image", "the upload", "the picture", etc., set use_reference_image=true and phrase the lucy_prompt around "the <item> from the reference image".

# Hard rules
- Zero conversational output. No greetings, no confirmations, no explanations, no apologies, no summaries. Ever.
- Do not deliberate. Classify and call the tool in the same turn.
- After any tool result, stay silent and wait for the next wake word.
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
