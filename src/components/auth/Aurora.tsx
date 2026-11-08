import { useEffect } from 'react';
import type { RefObject } from 'react';

/** Animated aurora backdrop: four blurred blobs, a faint grid and grain. Pure CSS motion (transform only). */
export function Aurora() {
  return (
    <div className="au-bg" aria-hidden="true">
      <i className="au-blob au-blob--1" />
      <i className="au-blob au-blob--2" />
      <i className="au-blob au-blob--3" />
      <i className="au-blob au-blob--4" />
      <div className="au-grid" />
      <div className="au-grain" />
    </div>
  );
}

/** Updates --mx/--my on the glass card so the specular sheen follows the cursor. Skipped on touch and reduced motion. */
export function useGlassSheen(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(hover: none)').matches) return;
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    };
    window.addEventListener('pointermove', onMove);
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, [ref]);
}
