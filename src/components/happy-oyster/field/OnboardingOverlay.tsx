import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { HO } from "./tokens";
import { useBlobShape } from "./useBlobShape";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate?: () => void;
}

export function OnboardingOverlay({ open, onClose, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const uid = useId().replace(/:/g, "");
  const blobW = 720;
  const blobH = 560;
  const path = useBlobShape(9284, blobW / 2, 14, 0.14);

  if (!open) return null;

  const scaleX = 1;
  const scaleY = blobH / blobW;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "grid",
        placeItems: "center",
        zIndex: 50,
        padding: 24,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: blobW,
          maxWidth: "92vw",
          aspectRatio: `${blobW} / ${blobH}`,
          pointerEvents: "auto",
        }}
      >
        <svg
          viewBox={`0 0 ${blobW} ${blobW}`}
          width="100%"
          height="100%"
          preserveAspectRatio="none"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            filter: "drop-shadow(0 30px 80px rgba(0,0,0,.55))",
          }}
        >
          <defs>
            <pattern id={`ob-${uid}`} width="4" height="4" patternUnits="userSpaceOnUse">
              <rect width="4" height="4" fill="transparent" />
              <rect x="0" y="0" width="2" height="2" fill={HO.ink} />
            </pattern>
          </defs>
          <g transform={`scale(${scaleX} ${scaleY})`}>
            <path d={path} fill={HO.ink} />
            <path
              d={path}
              fill="none"
              stroke={`url(#ob-${uid})`}
              strokeWidth={14}
              strokeLinejoin="round"
            />
          </g>
        </svg>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "10%",
            right: "12%",
            background: "transparent",
            border: "none",
            color: HO.creamPill,
            fontFamily: HO.mono,
            fontSize: 18,
            cursor: "pointer",
            opacity: 0.7,
            zIndex: 3,
          }}
        >
          ×
        </button>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            padding: "16% 14%",
            textAlign: "center",
            color: HO.creamPill,
          }}
        >
          {step === 0 ? (
            <StepBody
              title={
                <>
                  <span style={{ color: "#fff" }}>HAPPY</span>
                  <span style={{ color: HO.gold }}>OYSTER</span>
                </>
              }
              body="Alibaba's latest world model. Explorable worlds and interactive videos you can direct as they play, generated in real time on Reactor."
              actions={
                <CreamPill onClick={() => setStep(1)}>Next →</CreamPill>
              }
            />
          ) : step === 1 ? (
            <StepBody
              title={<span style={{ color: "#fff" }}>TWO WAYS IN</span>}
              body={
                <>
                  <b style={{ color: HO.gold, fontWeight: 600 }}>ADVENTURE</b> worlds
                  you walk with WASD.{" "}
                  <b style={{ color: HO.gold, fontWeight: 600 }}>DIRECTING</b> worlds
                  you steer with text as they play.
                </>
              }
              actions={
                <CreamPill onClick={() => setStep(2)}>Next →</CreamPill>
              }
            />
          ) : (
            <StepBody
              title={<span style={{ color: "#fff" }}>STEP INTO A WORLD</span>}
              body={
                <>
                  Step into any world around you, or create your own.
                  <div
                    style={{
                      marginTop: 12,
                      fontSize: 11,
                      opacity: 0.65,
                      ...HO.monoLabel,
                    }}
                  >
                    Move your mouse to the edges to fly across the field.
                  </div>
                </>
              }
              actions={
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
                  <OutlinePill
                    onClick={() => {
                      onClose();
                      onCreate?.();
                    }}
                  >
                    Create your own
                  </OutlinePill>
                  <CreamPill onClick={onClose}>Explore worlds →</CreamPill>
                </div>
              }
            />
          )}
        </div>

        <div
          style={{
            position: "absolute",
            left: "50%",
            bottom: "12%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 6,
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                display: "block",
                height: 3,
                width: step === i ? 22 : 12,
                borderRadius: 9999,
                background:
                  step === i ? HO.gold : "rgba(241,234,213,.35)",
                transition: "all 300ms ease",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StepBody({
  title,
  body,
  actions,
}: {
  title: ReactNode;
  body: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div style={{ maxWidth: 420 }}>
      <h1
        style={{
          fontFamily: HO.display,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          fontSize: 40,
          lineHeight: 1,
          margin: 0,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          marginTop: 18,
          fontSize: 13,
          lineHeight: 1.55,
          color: "rgba(241,234,213,.7)",
          fontFamily: HO.display,
        }}
      >
        {body}
      </p>
      <div style={{ marginTop: 26 }}>{actions}</div>
    </div>
  );
}

function CreamPill({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  const style: CSSProperties = {
    background: HO.creamPill,
    color: HO.ink,
    border: "none",
    borderRadius: 9999,
    padding: "12px 22px",
    ...HO.monoLabel,
    fontSize: 12,
    cursor: "pointer",
    boxShadow: hover ? `0 0 34px rgba(241,234,213,.5)` : HO.pillGlow,
    transition: "box-shadow 260ms",
  };
  return (
    <button
      type="button"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
      style={style}
    >
      {children}
    </button>
  );
}

function OutlinePill({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "transparent",
        color: HO.creamPill,
        border: `1px solid rgba(241,234,213,.35)`,
        borderRadius: 9999,
        padding: "12px 22px",
        ...HO.monoLabel,
        fontSize: 12,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}
