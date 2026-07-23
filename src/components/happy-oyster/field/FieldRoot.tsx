import { useEffect, useMemo, useRef, useState } from "react";
import type { FeaturedWorld } from "@/lib/happy-oyster/worlds";
import { FEATURED_WORLDS, modeName } from "@/lib/happy-oyster/worlds";
import type { WorldSession } from "@/components/happy-oyster/use-world-session";
import { HO, VIRTUAL_FIELD } from "./tokens";
import type { WorldPlacement } from "./types";
import { CloudCanvas } from "./CloudCanvas";
import { WorldBlob } from "./WorldBlob";
import { CreateBlob } from "./CreateBlob";
import { BottomDock } from "./BottomDock";
import { OnboardingOverlay } from "./OnboardingOverlay";
import { usePanController } from "./usePanController";
import { StatusChip } from "./StatusChip";
import { FocusBlob } from "./FocusBlob";
import { SessionStage } from "./SessionStage";
import { Composer } from "./Composer";

const ONBOARD_KEY = "ho-onboarded";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildPlacements(fieldW: number, fieldH: number): WorldPlacement[] {
  const rnd = mulberry32(20260722);
  const placements: WorldPlacement[] = [];
  const worlds = FEATURED_WORLDS;

  const tryPlace = (
    size: number,
    decorative: boolean,
    world: WorldPlacement["world"],
    seed: number,
    attempts = 60,
  ) => {
    for (let a = 0; a < attempts; a++) {
      const pad = size / 2 + 40;
      const x = pad + rnd() * (fieldW - pad * 2);
      const y = pad + rnd() * (fieldH - pad * 2);
      const collide = placements.some((p) => {
        const dx = p.x - x;
        const dy = p.y - y;
        return Math.hypot(dx, dy) < (p.size + size) / 2 + 60;
      });
      if (!collide) {
        placements.push({ world, x, y, size, seed, decorative });
        return true;
      }
    }
    return false;
  };

  worlds.forEach((w, i) => {
    const size = 220 + Math.floor(rnd() * 180);
    tryPlace(size, false, w, 1000 + i * 37);
  });
  for (let i = 0; i < 5; i++) {
    const w = worlds[i % worlds.length];
    const size = 130 + Math.floor(rnd() * 70);
    tryPlace(size, true, w, 5000 + i * 71);
  }
  return placements;
}

// Derive the intent for a featured world, mirroring the current Gallery logic
// so click behavior is byte-identical to the old flow.
function intentFor(world: FeaturedWorld) {
  if (world.encryptedWorldId) {
    return {
      kind: "attach" as const,
      mode: modeName(world.mode),
      encryptedWorldId: world.encryptedWorldId,
      title: world.title,
    };
  }
  return {
    kind: "create" as const,
    mode: modeName(world.mode),
    params: { prompt: world.prompt },
    title: world.title,
  };
}

export function FieldRoot({ session }: { session: WorldSession }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });
  const [onboarding, setOnboarding] = useState(false);
  const [focused, setFocused] = useState<FeaturedWorld | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);

  useEffect(() => {
    const measure = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    try {
      if (!localStorage.getItem(ONBOARD_KEY)) setOnboarding(true);
    } catch {
      setOnboarding(true);
    }
  }, []);

  const fieldW = Math.round(viewport.w * VIRTUAL_FIELD.wMul);
  const fieldH = Math.round(viewport.h * VIRTUAL_FIELD.hMul);
  const placements = useMemo(() => buildPlacements(fieldW, fieldH), [fieldW, fieldH]);
  const createSlot = useMemo(
    () => ({ x: fieldW * 0.5 + 180, y: fieldH * 0.42, size: 200, seed: 999 }),
    [fieldW, fieldH],
  );

  const overlayOpen =
    onboarding || !!focused || composerOpen || session.view.kind !== "browse";

  const pos = usePanController({
    viewportRef: rootRef,
    fieldW,
    fieldH,
    viewW: viewport.w,
    viewH: viewport.h,
    edgeThreshold: overlayOpen ? 0 : 120,
    maxSpeed: overlayOpen ? 0 : 14,
  });

  const closeOnboarding = () => {
    setOnboarding(false);
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const isBrowse = session.view.kind === "browse";
  const showChrome = isBrowse && !onboarding && !focused && !composerOpen;

  return (
    <div
      ref={rootRef}
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        background: HO.paper,
        touchAction: "none",
        overscrollBehavior: "contain",
      }}
      tabIndex={0}
    >
      <div
        style={{
          position: "absolute",
          width: fieldW,
          height: fieldH,
          transform: `translate3d(${pos.x * 0.85}px, ${pos.y * 0.85}px, 0)`,
          willChange: "transform",
        }}
      >
        <CloudCanvas width={fieldW} height={fieldH} pixelSize={4} />
      </div>

      <div
        style={{
          position: "absolute",
          width: fieldW,
          height: fieldH,
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          willChange: "transform",
        }}
      >
        {placements.map((p, i) => (
          <WorldBlob
            key={`${p.world.key}-${i}`}
            world={p.world}
            x={p.x}
            y={p.y}
            size={p.size}
            seed={p.seed}
            decorative={p.decorative}
            onActivate={(world) => {
              if (isBrowse) setFocused(world);
            }}
          />
        ))}
        <CreateBlob
          x={createSlot.x}
          y={createSlot.y}
          size={createSlot.size}
          seed={createSlot.seed}
          onClick={() => {
            if (isBrowse) setComposerOpen(true);
          }}
        />
      </div>

      {showChrome ? (
        <>
          <StatusChip onDisconnect={session.exit} />
          <BottomDock
            onCreate={() => setComposerOpen(true)}
            onHelp={() => setOnboarding(true)}
            onToggleSound={() => {
              /* placeholder */
            }}
            muted
          />
        </>
      ) : null}

      {focused && isBrowse ? (
        <FocusBlob
          world={focused}
          onEnter={() => {
            const w = focused;
            setFocused(null);
            session.run(intentFor(w));
          }}
          onClose={() => setFocused(null)}
        />
      ) : null}

      <SessionStage session={session} />

      <Composer
        open={composerOpen && isBrowse}
        onClose={() => setComposerOpen(false)}
        onIntent={(i) => session.run(i)}
      />

      <OnboardingOverlay
        open={onboarding}
        onClose={closeOnboarding}
        onCreate={() => setComposerOpen(true)}
      />
    </div>
  );
}
