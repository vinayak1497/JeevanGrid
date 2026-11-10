/**
 * Shared motion primitives.
 *
 * Rules used across the app:
 *  - One orchestrated entrance per view, not a bounce on every card.
 *  - Motion always answers a user action (open, expand, confirm).
 *  - `prefers-reduced-motion` collapses every animation to a single frame.
 */
import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion } from 'framer-motion';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ */
/* Reveal — a section that lifts in once when it enters the viewport.  */
/* ------------------------------------------------------------------ */
export const Reveal: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: 'div' | 'section' | 'li' | 'article';
}> = ({ children, className, delay = 0, y = 18, as = 'div' }) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-12% 0px -8% 0px' });
  const MotionTag = motion[as] as typeof motion.div;

  if (reduce) {
    const Tag = as;
    return <Tag className={className}>{children}</Tag>;
  }

  return (
    <MotionTag
      ref={ref as never}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.62, delay, ease: EASE_OUT_EXPO }}
    >
      {children}
    </MotionTag>
  );
};

/* ------------------------------------------------------------------ */
/* Stagger — parent that sequences its children's entrance.            */
/* ------------------------------------------------------------------ */
export const Stagger: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
  gap?: number;
}> = ({ children, className, delay = 0, gap = 0.07 }) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
};

export const StaggerItem: React.FC<{
  children: React.ReactNode;
  className?: string;
  y?: number;
}> = ({ children, className, y = 14 }) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT_EXPO } },
      }}
    >
      {children}
    </motion.div>
  );
};

/* ------------------------------------------------------------------ */
/* Pressable — tactile feedback for anything tappable on mobile.        */
/* ------------------------------------------------------------------ */
export const Pressable: React.FC<{
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  as?: 'button' | 'a' | 'div';
  href?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  'aria-label'?: string;
  title?: string;
}> = ({ children, className, onClick, as = 'button', href, type = 'button', disabled, ...rest }) => {
  const reduce = useReducedMotion();

  if (reduce) {
    const Plain = as === 'a' ? 'a' : as === 'div' ? 'div' : 'button';
    return (
      <Plain
        className={className}
        onClick={onClick}
        href={as === 'a' ? href : undefined}
        type={as === 'button' ? type : undefined}
        disabled={as === 'button' ? disabled : undefined}
        {...rest}
      >
        {children}
      </Plain>
    );
  }

  const tap = disabled ? undefined : { scale: 0.97 };
  const transition = { type: 'spring' as const, stiffness: 420, damping: 30 };

  if (as === 'a') {
    return (
      <motion.a
        className={className}
        onClick={onClick}
        href={href}
        whileTap={tap}
        transition={transition}
        {...rest}
      >
        {children}
      </motion.a>
    );
  }

  if (as === 'div') {
    return (
      <motion.div
        className={className}
        onClick={onClick}
        whileTap={tap}
        transition={transition}
        {...rest}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.button
      className={className}
      onClick={onClick}
      type={type}
      disabled={disabled}
      whileTap={tap}
      transition={transition}
      {...rest}
    >
      {children}
    </motion.button>
  );
};

/* ------------------------------------------------------------------ */
/* LiveSignal — the one pulsing dot, reserved for "happening now".     */
/* ------------------------------------------------------------------ */
export const LiveSignal: React.FC<{
  tone?: 'live' | 'warn' | 'critical' | 'idle' | 'info';
  className?: string;
  label?: string;
}> = ({ tone = 'live', className = '', label }) => {
  const color =
    tone === 'warn'
      ? 'bg-signal-warn'
      : tone === 'critical'
        ? 'bg-signal-critical'
        : tone === 'info'
          ? 'bg-signal-info'
          : tone === 'idle'
            ? 'bg-signal-idle'
            : 'bg-signal-live';
  return (
    <span className={`relative inline-flex h-2 w-2 shrink-0 rounded-full ${color} ${className}`}>
      <span className={`absolute inset-0 rounded-full ${color} animate-signal-pulse`} aria-hidden="true" />
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* CountUp — numbers that settle into place once, on view.              */
/* ------------------------------------------------------------------ */
export const CountUp: React.FC<{
  value: number;
  className?: string;
  duration?: number;
  format?: (n: number) => string;
}> = ({ value, className, duration = 900, format }) => {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const [display, setDisplay] = useState(reduce ? value : 0);
  const from = useRef(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (!inView) return;
    const start = performance.now();
    const initial = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutExpo
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplay(initial + (value - initial) * eased);
      if (progress < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, duration, reduce]);

  return (
    <span ref={ref} className={className}>
      {format ? format(display) : Math.round(display).toLocaleString('en-IN')}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* AnimateIn — small helper for list items that mount on data change.  */
/* ------------------------------------------------------------------ */
export const AnimateIn: React.FC<{
  children: React.ReactNode;
  className?: string;
  delay?: number;
}> = ({ children, className, delay = 0 }) => {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <AnimatePresence initial={false}>
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.36, delay, ease: EASE_OUT_EXPO }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export { EASE_OUT_EXPO };
