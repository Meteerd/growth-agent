"use client";

// Adapted from React Bits Magnet (https://reactbits.dev, MIT + Commons Clause, (c) David Haz): the call to action leans
// toward the pointer when it comes near. Changes: pointer-fine devices only, off under reduced motion.
import { useReducedMotion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

export function Magnet({
  children,
  padding = 90,
  strength = 3,
}: {
  children: ReactNode;
  padding?: number;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0, active: false });
  const still = useReducedMotion();

  useEffect(() => {
    if (still || !window.matchMedia("(pointer: fine)").matches) return;
    const move = (e: MouseEvent) => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const near =
        Math.abs(cx - e.clientX) < r.width / 2 + padding && Math.abs(cy - e.clientY) < r.height / 2 + padding;
      setPos(
        near
          ? { x: (e.clientX - cx) / strength, y: (e.clientY - cy) / strength, active: true }
          : { x: 0, y: 0, active: false },
      );
    };
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, [padding, strength, still]);

  return (
    <div ref={ref} className="relative inline-block">
      <div
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          transition: pos.active ? "transform 0.3s ease-out" : "transform 0.5s ease-in-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
