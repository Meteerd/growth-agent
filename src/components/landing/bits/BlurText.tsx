"use client";

// Adapted from React Bits BlurText (https://reactbits.dev, MIT + Commons Clause, (c) David Haz): words rise out of a
// blur when the line scrolls into view. Changes: one shared keyframe set, renders as any tag, reduced motion handled in
// CSS (.blur-word in globals.css) so the server and the client always render the same markup.
import { motion, useInView } from "motion/react";
import { useRef } from "react";

const FROM = { filter: "blur(10px)", opacity: 0, y: 28 };
const TO = { filter: ["blur(10px)", "blur(4px)", "blur(0px)"], opacity: [0, 0.6, 1], y: [28, -3, 0] };

export function BlurText({
  text,
  as: Tag = "span",
  className,
  delay = 60,
  step = 0.32,
}: {
  text: string;
  as?: "span" | "h1" | "h2" | "p";
  className?: string;
  /** ms between words */
  delay?: number;
  /** seconds per keyframe step */
  step?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const words = text.split(" ");
  return (
    <Tag ref={ref as never} className={className} aria-label={text}>
      <span aria-hidden className="contents">
        {words.map((w, i) => (
          <motion.span
            key={i}
            className="blur-word inline-block will-change-[transform,filter,opacity]"
            initial={FROM}
            animate={inView ? TO : FROM}
            transition={{ duration: step * 2, times: [0, 0.5, 1], delay: (i * delay) / 1000, ease: "easeOut" }}
          >
            {w}
            {i < words.length - 1 && " "}
          </motion.span>
        ))}
      </span>
    </Tag>
  );
}
