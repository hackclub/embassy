"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

// motion@13's HTMLMotionProps type resolution is broken against React 19.2
// types (motion props vanish from JSX), so bind the div factory to the props
// this component actually uses.
const MotionDiv = motion.div as unknown as (props: {
  className?: string;
  children?: ReactNode;
  initial?: object;
  whileInView?: object;
  viewport?: object;
  transition?: object;
}) => React.ReactElement;

export default function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <MotionDiv
      className={className}
      initial={reduce ? undefined : { opacity: 0, y: 24 }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </MotionDiv>
  );
}
