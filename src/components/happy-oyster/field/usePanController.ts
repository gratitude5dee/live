import { useEffect, useRef, useState } from "react";

// RAF-driven pan for the field. Supports edge-hover (desktop), one-finger drag
// (touch/pointer), and arrow keys. Rubber-bands at the virtual-field edges.
export function usePanController(opts: {
  viewportRef: React.RefObject<HTMLElement>;
  fieldW: number;
  fieldH: number;
  viewW: number;
  viewH: number;
  edgeThreshold?: number;
  maxSpeed?: number;
}) {
  const {
    viewportRef,
    fieldW,
    fieldH,
    viewW,
    viewH,
    edgeThreshold = 120,
    maxSpeed = 14,
  } = opts;

  const [pos, setPos] = useState({ x: (viewW - fieldW) / 2, y: (viewH - fieldH) / 2 });
  const posRef = useRef(pos);
  const velRef = useRef({ x: 0, y: 0 });
  const targetVelRef = useRef({ x: 0, y: 0 });
  const mouseRef = useRef<{ x: number; y: number } | null>(null);
  const draggingRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const keyRef = useRef({ up: 0, down: 0, left: 0, right: 0 });

  // Keep pos ref in sync
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);

  // Re-center when viewport changes
  useEffect(() => {
    const next = {
      x: Math.min(0, Math.max(viewW - fieldW, posRef.current.x)),
      y: Math.min(0, Math.max(viewH - fieldH, posRef.current.y)),
    };
    posRef.current = next;
    setPos(next);
  }, [fieldW, fieldH, viewW, viewH]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseLeave = () => {
      mouseRef.current = null;
      targetVelRef.current = { x: 0, y: 0 };
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      draggingRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        posX: posRef.current.x,
        posY: posRef.current.y,
      };
      (e.target as Element).setPointerCapture?.(e.pointerId);
    };
    const onPointerMove = (e: PointerEvent) => {
      const drag = draggingRef.current;
      if (!drag || e.pointerType !== "touch") return;
      const nx = drag.posX + (e.clientX - drag.startX);
      const ny = drag.posY + (e.clientY - drag.startY);
      posRef.current = { x: nx, y: ny };
      setPos({ x: nx, y: ny });
    };
    const onPointerUp = () => {
      draggingRef.current = null;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") keyRef.current.up = 1;
      else if (e.key === "ArrowDown") keyRef.current.down = 1;
      else if (e.key === "ArrowLeft") keyRef.current.left = 1;
      else if (e.key === "ArrowRight") keyRef.current.right = 1;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") keyRef.current.up = 0;
      else if (e.key === "ArrowDown") keyRef.current.down = 0;
      else if (e.key === "ArrowLeft") keyRef.current.left = 0;
      else if (e.key === "ArrowRight") keyRef.current.right = 0;
    };

    el.addEventListener("mousemove", onMouseMove);
    el.addEventListener("mouseleave", onMouseLeave);
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let raf = 0;
    const tick = () => {
      // Compute target velocity from edge proximity + keys
      let tvx = 0;
      let tvy = 0;
      const m = mouseRef.current;
      if (m && !draggingRef.current) {
        const rect = el.getBoundingClientRect();
        const dxLeft = m.x - rect.left;
        const dxRight = rect.right - m.x;
        const dyTop = m.y - rect.top;
        const dyBottom = rect.bottom - m.y;
        if (dxLeft < edgeThreshold) {
          const t = 1 - Math.max(0, dxLeft) / edgeThreshold;
          tvx += t * t * maxSpeed;
        }
        if (dxRight < edgeThreshold) {
          const t = 1 - Math.max(0, dxRight) / edgeThreshold;
          tvx -= t * t * maxSpeed;
        }
        if (dyTop < edgeThreshold) {
          const t = 1 - Math.max(0, dyTop) / edgeThreshold;
          tvy += t * t * maxSpeed;
        }
        if (dyBottom < edgeThreshold) {
          const t = 1 - Math.max(0, dyBottom) / edgeThreshold;
          tvy -= t * t * maxSpeed;
        }
      }
      const k = keyRef.current;
      tvx += (k.left - k.right) * maxSpeed * 0.8;
      tvy += (k.up - k.down) * maxSpeed * 0.8;

      targetVelRef.current = { x: tvx, y: tvy };
      // Lerp current vel toward target for momentum
      velRef.current.x += (tvx - velRef.current.x) * 0.15;
      velRef.current.y += (tvy - velRef.current.y) * 0.15;

      if (!draggingRef.current) {
        let nx = posRef.current.x + velRef.current.x;
        let ny = posRef.current.y + velRef.current.y;
        // Rubber-band clamp
        const minX = viewW - fieldW;
        const minY = viewH - fieldH;
        if (nx > 0) nx = nx * 0.65;
        else if (nx < minX) nx = minX + (nx - minX) * 0.35;
        if (ny > 0) ny = ny * 0.65;
        else if (ny < minY) ny = minY + (ny - minY) * 0.35;

        if (
          Math.abs(nx - posRef.current.x) > 0.01 ||
          Math.abs(ny - posRef.current.y) > 0.01
        ) {
          posRef.current = { x: nx, y: ny };
          setPos({ x: nx, y: ny });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("mousemove", onMouseMove);
      el.removeEventListener("mouseleave", onMouseLeave);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [viewportRef, fieldW, fieldH, viewW, viewH, edgeThreshold, maxSpeed]);

  return pos;
}
