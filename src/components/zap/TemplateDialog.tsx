import { useCallback, useEffect, useRef, useState } from "react";
import type { TemplateKey } from "@/lib/zap/prompt-templates";
import { TEMPLATE_META, buildTemplatePrompt } from "@/lib/zap/prompt-templates";

export type TemplateApplyPayload = {
  dataUri: string;
  file: Blob;
  prompt: string;
};

type Props = {
  open: boolean;
  templateKey: TemplateKey;
  name: string;
  onClose: () => void;
  onApply: (payload: TemplateApplyPayload) => Promise<void> | void;
};

export default function TemplateDialog({ open, templateKey, name, onClose, onApply }: Props) {
  const meta = TEMPLATE_META[templateKey];
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [file, setFile] = useState<Blob | null>(null);
  const [detail, setDetail] = useState("");
  const [placement, setPlacement] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setDataUri(null);
      setFile(null);
      setDetail("");
      setPlacement("");
      setBusy(false);
    }
  }, [open]);

  const ingest = useCallback((f: File | Blob) => {
    setFile(f);
    const r = new FileReader();
    r.onload = () => setDataUri(r.result as string);
    r.readAsDataURL(f);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const f = item?.getAsFile();
      if (f) ingest(f);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, ingest]);

  if (!open) return null;

  const canApply = !!dataUri && !!file && !busy;

  const handleApply = async () => {
    if (!dataUri || !file) return;
    setBusy(true);
    const opts =
      templateKey === "object_add"
        ? { detail, placement }
        : { detail, slot: placement };
    const prompt = buildTemplatePrompt(templateKey, opts);
    try {
      await onApply({ dataUri, file, prompt });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[min(520px,92vw)] rounded-2xl border border-[#2A2A35] bg-[#0F1015] p-5 text-[#E5E7EB] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">{name}</h2>
            <p className="text-xs text-[#9CA3AF]">
              Drop a reference image and we'll write a Lucy-optimized prompt.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-[#9CA3AF] hover:bg-white/5"
          >
            ✕
          </button>
        </div>

        {/* Drop zone */}
        <label
          htmlFor="tpl-file"
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f && f.type.startsWith("image/")) ingest(f);
          }}
          className={`flex h-44 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed transition ${
            drag
              ? "border-[#22D3EE] bg-[#22D3EE]/5"
              : "border-[#2A2A35] hover:border-[#22D3EE]/60"
          }`}
        >
          {dataUri ? (
            <img
              src={dataUri}
              alt="reference"
              className="h-full w-full rounded-xl object-contain"
            />
          ) : (
            <div className="text-center text-sm text-[#9CA3AF]">
              <div className="text-2xl">📥</div>
              <div className="mt-1">Drop, paste, or click to select an image</div>
              <div className="text-[10px] opacity-70">PNG · JPG · WebP</div>
            </div>
          )}
          <input
            ref={inputRef}
            id="tpl-file"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) ingest(f);
            }}
          />
        </label>

        {/* Inputs */}
        <div className="mt-4 space-y-2">
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-[#9CA3AF]">
              {meta.placementLabel}
            </label>
            <input
              value={placement}
              onChange={(e) => setPlacement(e.target.value)}
              placeholder={meta.placementPlaceholder}
              className="w-full rounded-lg border border-[#2A2A35] bg-[#16161D] px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] uppercase tracking-wide text-[#9CA3AF]">
              Detail hint <span className="opacity-60">(optional)</span>
            </label>
            <input
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder={meta.detailPlaceholder}
              className="w-full rounded-lg border border-[#2A2A35] bg-[#16161D] px-3 py-2 text-sm outline-none focus:border-[#22D3EE]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm text-[#9CA3AF] hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            disabled={!canApply}
            onClick={handleApply}
            className="rounded-lg bg-[#22D3EE] px-4 py-2 text-sm font-medium text-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
