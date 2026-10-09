import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Measure the grid separately so stacking cannot make the layout oscillate. */
export function PlantList({ open, children }: { open: boolean; children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const element = list.current;
    if (!open || !element) return;
    function measure() {
      if (!element || element.getBoundingClientRect().width === 0) return;
      const probe = element.cloneNode(true) as HTMLUListElement;
      probe.className = 'plant-list plant-list-probe';
      probe.inert = true;
      probe.setAttribute('aria-hidden', 'true');
      probe.style.width = `${element.getBoundingClientRect().width}px`;
      probe.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
      element.parentElement?.append(probe);
      try {
        const wraps = Array.from(probe.querySelectorAll('.plant-name, .plant-status, .availability-badge'))
          .some(label => {
            const range = document.createRange();
            range.selectNodeContents(label);
            const lines = new Set(Array.from(range.getClientRects())
              .filter(rect => rect.width > 0 && rect.height > 0)
              .map(rect => Math.round(rect.top)));
            return lines.size > 1;
          });
        setStacked(wraps);
      } finally {
        probe.remove();
      }
    }
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [open, children]);
  return <ul ref={list} className={`plant-list${stacked ? ' plant-list-stacked' : ''}`}>{children}</ul>;
}
