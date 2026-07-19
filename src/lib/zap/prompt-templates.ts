export type TemplateKey = "object_add" | "clothing_tryon" | "object_replace";

export type TemplateOpts = {
  detail?: string;
  placement?: string;
  slot?: string;
};

/**
 * Deterministic client-side prompt expansion following Lucy 2.5's structured
 * prompting guide (Add / Replace templates). Lucy's own
 * enable_prompt_expansion further polishes server-side.
 */
export function buildTemplatePrompt(key: TemplateKey, opts: TemplateOpts = {}): string {
  const detail = opts.detail?.trim();
  switch (key) {
    case "object_add": {
      const object = detail || "the object from the reference image";
      const where = opts.placement?.trim() || "the person's hand";
      return `Add ${object} to ${where}, attached naturally and shifting with their motion. Cast soft light on nearby skin and clothing so it feels physically present. Keep the person's identity, face, hair, and background unchanged.`;
    }
    case "clothing_tryon": {
      const garment = detail || "the garment from the reference image";
      const slot = opts.slot?.trim() || "top";
      return `Replace the person's ${slot} with ${garment}, matching its color, material, texture, fit, and any logos or trims. The garment moves naturally with the body. Keep the person's identity, face, hair, pose, and background unchanged.`;
    }
    case "object_replace": {
      const replacement = detail || "the object from the reference image";
      const target = opts.placement?.trim() || "the object the person is holding";
      return `Replace ${target} with ${replacement}, matching its scale, orientation, and grip so it looks physically held. Preserve the person's hand pose, fingers, identity, face, clothing, lighting, and background exactly. The new object moves with the hand naturally frame to frame.`;
    }
  }
}

export const TEMPLATE_META: Record<
  TemplateKey,
  { placementLabel: string; placementPlaceholder: string; detailPlaceholder: string }
> = {
  object_add: {
    placementLabel: "Placement",
    placementPlaceholder: "e.g. above the person's head",
    detailPlaceholder: "e.g. a silver crown with sapphire inlays",
  },
  clothing_tryon: {
    placementLabel: "Garment slot",
    placementPlaceholder: "top, jacket, dress, hat…",
    detailPlaceholder: "e.g. glossy black leather jacket, silver zipper",
  },
  object_replace: {
    placementLabel: "What to replace",
    placementPlaceholder: "e.g. the phone in the person's hand",
    detailPlaceholder: "e.g. the plush green backpack from the reference image",
  },
};
