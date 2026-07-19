ALTER TABLE public.presets ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'preset';
ALTER TABLE public.presets ADD COLUMN IF NOT EXISTS template_key text;

INSERT INTO public.presets (user_id, name, emoji, prompt, requires_ref, sort_order, kind, template_key)
VALUES
  (NULL, 'Object add-in', '📦', '', true, 10, 'template', 'object_add'),
  (NULL, 'Try-on',        '👕', '', true, 11, 'template', 'clothing_tryon');