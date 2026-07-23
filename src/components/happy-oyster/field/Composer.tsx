import { useEffect, useId, useState } from "react";
import { MAX_FIRST_FRAME_IMAGE_BYTES } from "@reactor-models/happy-oyster";
import type { WorldIntent } from "@/lib/happy-oyster/worlds";
import { HO } from "./tokens";
import { useBlobShape } from "./useBlobShape";
import { CreamPill } from "./pill";

interface Props {
  open: boolean;
  onClose: () => void;
  onIntent: (intent: WorldIntent) => void;
}

export function Composer({ open, onClose, onIntent }: Props) {
  const [tab, setTab] = useState<"create" | "attach">("create");
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<1 | 2>(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [perspective, setPerspective] = useState<"third_person" | "first_person">("third_person");
  const [resolution, setResolution] = useState<"720p" | "480p">("720p");
  const [layout, setLayout] = useState<"auto" | "Stable" | "Fast">("auto");
  const [narrative, setNarrative] = useState<"auto" | "Normal" | "Calm" | "Dramatic">("auto");
  const [attachId, setAttachId] = useState("");
  const [attachMode, setAttachMode] = useState<1 | 2>(1);

  const uid = useId().replace(/:/g, "");
  const path = useBlobShape(6142, 400, 14, 0.1);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const buildCreate = () => {
    const text = prompt.trim();
    if (!text) return;
    const firstFrameImage = imageFile ?? undefined;
    const intent: WorldIntent = {
      kind: "create",
      mode: mode === 2 ? "directing" : "adventure",
      title: "Your world",
      params:
        mode === 2
          ? {
              prompt: text,
              firstFrameImage,
              resolution,
              ...(layout !== "auto" ? { layout } : {}),
              ...(narrative !== "auto" ? { narrative } : {}),
            }
          : { prompt: text, firstFrameImage, perspective },
    };
    onIntent(intent);
    onClose();
  };

  const buildAttach = () => {
    const id = attachId.trim();
    if (!id) return;
    onIntent({
      kind: "attach",
      mode: attachMode === 2 ? "directing" : "adventure",
      encryptedWorldId: id,
      title: "Attached world",
    });
    onClose();
  };

  const blobW = 800;
  const blobH = 700;

  return (
    <div style={{ position: "fixed", inset: 0, display: "grid", placeItems: "center", zIndex: 60, padding: 24 }}>
      <div
        style={{
          position: "relative",
          width: blobW,
          maxWidth: "min(92vw, 720px)",
          maxHeight: "92vh",
          aspectRatio: `${blobW} / ${blobH}`,
        }}
      >
        <svg
          viewBox={`0 0 ${blobW} ${blobW}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", filter: "drop-shadow(0 30px 80px rgba(0,0,0,.55))" }}
        >
          <defs>
            <pattern id={`cp-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="transparent" />
              <rect x="0" y="0" width="2" height="2" fill={HO.ink} />
            </pattern>
          </defs>
          <g transform={`scale(1 ${blobH / blobW})`}>
            <path d={path} fill={HO.ink} transform="translate(0 0)" />
            <path d={path} fill="none" stroke={`url(#cp-${uid})`} strokeWidth={16} strokeLinejoin="round" />
          </g>
        </svg>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "8%",
            right: "10%",
            background: "transparent",
            border: "none",
            color: HO.creamPill,
            fontFamily: HO.mono,
            fontSize: 18,
            cursor: "pointer",
            opacity: 0.7,
            zIndex: 2,
          }}
        >
          ×
        </button>

        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "14% 12% 10%",
            display: "flex",
            flexDirection: "column",
            gap: 14,
            color: HO.creamPill,
            overflow: "auto",
          }}
        >
          {tab === "create" ? (
            <>
              <ModeToggle mode={mode} setMode={setMode} />
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="Describe a world… a paragraph with explicit setting, mood, and camera framing works best."
                style={textareaStyle}
              />
              {imageFile ? (
                <div style={fileRowStyle}>
                  <span style={{ ...HO.monoLabel, fontSize: 11, opacity: 0.85, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {imageFile.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setImageFile(null)}
                    style={{ background: "transparent", border: "none", color: "rgba(241,234,213,.55)", cursor: "pointer", ...HO.monoLabel, fontSize: 10 }}
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label style={{ ...fileRowStyle, borderStyle: "dashed", cursor: "pointer", justifyContent: "center", color: "rgba(241,234,213,.55)" }}>
                  <span style={{ ...HO.monoLabel, fontSize: 10 }}>Optional first frame</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      e.target.value = "";
                      if (!f) return;
                      if (f.size > MAX_FIRST_FRAME_IMAGE_BYTES) {
                        setImageError("That image is over the 2MB limit.");
                        return;
                      }
                      setImageError(null);
                      setImageFile(f);
                    }}
                  />
                </label>
              )}
              {imageError ? (
                <p style={{ ...HO.monoLabel, fontSize: 10, color: "#ff8b7a", margin: 0 }}>{imageError}</p>
              ) : null}

              {mode === 1 ? (
                <Knob
                  label="Perspective"
                  value={perspective}
                  onChange={setPerspective}
                  options={[
                    { value: "third_person", label: "Third-person" },
                    { value: "first_person", label: "First-person" },
                  ]}
                />
              ) : (
                <>
                  <Knob
                    label="Resolution"
                    value={resolution}
                    onChange={setResolution}
                    options={[
                      { value: "720p", label: "720p" },
                      { value: "480p", label: "480p" },
                    ]}
                  />
                  <Knob
                    label="Camera motion"
                    value={layout}
                    onChange={setLayout}
                    options={[
                      { value: "auto", label: "Auto" },
                      { value: "Stable", label: "Stable" },
                      { value: "Fast", label: "Fast" },
                    ]}
                  />
                  <Knob
                    label="Narrative"
                    value={narrative}
                    onChange={setNarrative}
                    options={[
                      { value: "auto", label: "Auto" },
                      { value: "Normal", label: "Normal" },
                      { value: "Calm", label: "Calm" },
                      { value: "Dramatic", label: "Dramatic" },
                    ]}
                  />
                </>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 6, gap: 12 }}>
                <button type="button" onClick={() => setTab("attach")} style={linkBtnStyle}>
                  Have a world id?
                </button>
                <CreamPill onClick={buildCreate} disabled={prompt.trim().length === 0}>
                  Build world →
                </CreamPill>
              </div>
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ ...HO.monoLabel, fontSize: 10, color: HO.gold }}>Attach existing world</span>
                <p style={{ fontFamily: HO.display, fontSize: 12, color: "rgba(241,234,213,.55)", margin: 0, lineHeight: 1.5 }}>
                  Worlds are permanent. Paste an <code style={{ fontFamily: HO.mono, background: "rgba(0,0,0,.4)", padding: "1px 5px", borderRadius: 4 }}>encrypted_world_id</code> to jump back in — no build wait.
                </p>
              </div>
              <ModeToggle mode={attachMode} setMode={setAttachMode} />
              <input
                type="text"
                value={attachId}
                onChange={(e) => setAttachId(e.target.value)}
                placeholder="encrypted_world_id"
                style={inputStyle}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto", paddingTop: 6 }}>
                <button type="button" onClick={() => setTab("create")} style={linkBtnStyle}>
                  ← Compose instead
                </button>
                <CreamPill onClick={buildAttach} disabled={attachId.trim().length === 0}>
                  Attach →
                </CreamPill>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: 1 | 2; setMode: (m: 1 | 2) => void }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignSelf: "flex-start",
        background: "rgba(0,0,0,.35)",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: 9999,
        padding: 3,
        gap: 2,
      }}
    >
      {[1, 2].map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m as 1 | 2)}
            style={{
              background: active ? HO.gold : "transparent",
              color: active ? HO.ink : "rgba(241,234,213,.55)",
              border: "none",
              borderRadius: 9999,
              padding: "6px 14px",
              ...HO.monoLabel,
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            {m === 1 ? "Adventure" : "Directing"}
          </button>
        );
      })}
    </div>
  );
}

function Knob<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ ...HO.monoLabel, fontSize: 9, color: "rgba(241,234,213,.5)" }}>{label}</span>
      <div style={{ display: "flex", background: "rgba(0,0,0,.35)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 8, padding: 2, gap: 2 }}>
        {options.map((o) => {
          const active = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              style={{
                flex: 1,
                background: active ? "rgba(255,255,255,.14)" : "transparent",
                color: active ? "#fff" : "rgba(241,234,213,.55)",
                border: "none",
                borderRadius: 6,
                padding: "6px 8px",
                ...HO.monoLabel,
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const textareaStyle: React.CSSProperties = {
  background: "rgba(0,0,0,.4)",
  color: HO.creamPill,
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 10,
  padding: "10px 12px",
  fontFamily: HO.mono,
  fontSize: 12,
  lineHeight: 1.5,
  resize: "none",
  outline: "none",
};

const inputStyle: React.CSSProperties = {
  ...textareaStyle,
  fontSize: 11,
  padding: "10px 12px",
};

const fileRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  background: "rgba(0,0,0,.35)",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 10,
  padding: "8px 12px",
};

const linkBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "rgba(241,234,213,.6)",
  cursor: "pointer",
  ...HO.monoLabel,
  fontSize: 10,
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};
