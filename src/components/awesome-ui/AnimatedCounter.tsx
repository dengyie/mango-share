import React, { useEffect, useRef, useState } from "react";

export interface AnimatedCounterProps {
  /** Target final value to count up to */
  target: number;
  /** Initial starting value, default 0 */
  start?: number;
  /** Duration in milliseconds, default 1200 */
  duration?: number;
  /** Delay in milliseconds before animation starts, default 0 */
  delay?: number;
  /** Suffix string attached to the number (e.g. "+", "%", "k") */
  suffix?: string;
  /** Prefix string attached to the number (e.g. "$", "¥") */
  prefix?: string;
  className?: string;
  style?: React.CSSProperties;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  target,
  start = 0,
  duration = 1200,
  delay = 0,
  suffix = "",
  prefix = "",
  className = "",
  style,
}) => {
  const [displayValue, setDisplayValue] = useState<number>(start);
  const elRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    // If reduced motion is preferred, jump straight to target
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplayValue(target);
      return;
    }

    if (duration <= 0) {
      setDisplayValue(target);
      return;
    }

    setDisplayValue(start);
    let rafId = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const range = target - start;

    timeoutId = setTimeout(() => {
      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, Math.max(0, elapsed / duration));
        const current = Math.round(start + easeOutCubic(progress) * range);
        setDisplayValue(current);

        if (progress < 1) {
          rafId = requestAnimationFrame(tick);
        } else {
          setDisplayValue(target);
        }
      };

      rafId = requestAnimationFrame(tick);
    }, delay);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [target, start, duration, delay]);

  return (
    <span
      ref={elRef}
      className={className}
      style={style}
      aria-label={`${prefix}${target}${suffix}`}
    >
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
};
