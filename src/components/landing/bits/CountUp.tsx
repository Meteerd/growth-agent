"use client";

// Adapted from React Bits CountUp (https://reactbits.dev, MIT + Commons Clause, (c) David Haz): a spring counts up to
// the real number once it is in view. Changes: integers only, en-US grouping, final value at once under reduced motion.
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function CountUp({ to, duration = 1.6, className }: { to: number; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const value = useMotionValue(0);
  const spring = useSpring(value, { damping: 20 + 40 / duration, stiffness: 100 / duration });
  const inView = useInView(ref, { once: true });
  const still = useReducedMotion();

  useEffect(() => {
    if (!still && ref.current) ref.current.textContent = "0";
  }, [still]);
  useEffect(() => {
    if (inView && !still) value.set(to);
  }, [inView, to, value, still]);
  useEffect(
    () =>
      spring.on("change", (v) => {
        if (ref.current) ref.current.textContent = fmt(v);
      }),
    [spring],
  );

  // the server renders the real number (no script, reduced motion); on screen it counts up from 0
  return (
    <span ref={ref} className={className}>
      {fmt(to)}
    </span>
  );
}
