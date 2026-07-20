
ALTER TABLE public.presets ADD COLUMN IF NOT EXISTS input_hint text;

INSERT INTO public.presets (name, emoji, prompt, kind, sort_order, input_hint, expand, requires_ref)
VALUES
  ('Liquid Chrome', '🪞', 'Transform the figure into flowing liquid chrome — mirror-polished metal skin that catches highlights and warps reflections of its surroundings, keeping the same silhouette and motion.', 'preset', 300, 'depth', false, false),
  ('Hologram Wireframe', '📡', 'Render the subject as a translucent cyan hologram wireframe — glowing edge lines, subtle scan bars sweeping across the body, dark starfield background.', 'preset', 301, 'depth', false, false),
  ('Thermal Camera', '🌡️', 'Restyle as a thermal infrared camera feed — warm reds and yellows on the person''s body, cool blues and purples in the background, faint scan-line noise overlay.', 'preset', 302, 'depth', false, false),
  ('Nebula Silhouette', '🌌', 'Fill the subject''s silhouette with a swirling deep-space nebula — purple, magenta, and teal clouds with pinpoint stars, black background around them.', 'preset', 303, 'depth', false, false),
  ('Topographic Map', '🗺️', 'Restyle as a topographic contour map — thin orange elevation lines follow the body''s contours over a matte cream paper background, subtle grid overlay.', 'preset', 304, 'depth', false, false)
ON CONFLICT DO NOTHING;
