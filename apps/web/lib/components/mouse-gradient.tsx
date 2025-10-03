'use client';

import { useEffect, useRef } from 'react';

/**
 * Subtle radial gradient that tracks the pointer to keep the layout feeling alive
 * without overpowering the squared-off aesthetic.
 */
export function MouseGradient() {
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) {
      return;
    }

    overlay.style.setProperty('--gradient-x', '50%');
    overlay.style.setProperty('--gradient-y', '50%');

    let animationFrame = 0;

    const handlePointerMove = (event: PointerEvent) => {
      if (animationFrame) {
        return;
      }

      animationFrame = window.requestAnimationFrame(() => {
        animationFrame = 0;
        const xPercent = (event.clientX / window.innerWidth) * 100;
        const yPercent = (event.clientY / window.innerHeight) * 100;
        overlay.style.setProperty('--gradient-x', `${xPercent}%`);
        overlay.style.setProperty('--gradient-y', `${yPercent}%`);
      });
    };

    window.addEventListener('pointermove', handlePointerMove);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-90 transition-opacity duration-700"
      style={{
        background:
          'radial-gradient(480px at var(--gradient-x, 50%) var(--gradient-y, 50%), rgba(56, 189, 248, 0.16), transparent 72%), radial-gradient(720px at var(--gradient-x, 50%) var(--gradient-y, 50%), rgba(129, 140, 248, 0.1), transparent 82%)',
      }}
    />
  );
}
