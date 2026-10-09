import { useLayoutEffect, useRef, useState } from 'react';
import type { BootstrapData } from '../../shared/bootstrap.js';
import type { PlantId, SavedPlant } from '../../shared/plants.js';
import { PlantInfoCard } from './PlantInfoCard.js';

export function ShelfScene({ assets, plants }: { assets: BootstrapData; plants: SavedPlant[] }) {
  const [active, setActive] = useState<PlantId | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const userScrolled = useRef(false);
  const centredAt = useRef(0);
  useLayoutEffect(() => {
    const scrollArea = viewport.current;
    const content = scene.current;
    if (!scrollArea || !content) return;
    function centre() {
      if (!scrollArea || userScrolled.current) return;
      centredAt.current = Math.max(0, (scrollArea.scrollWidth - scrollArea.clientWidth) / 2);
      scrollArea.scrollLeft = centredAt.current;
    }
    centre();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(centre);
    observer?.observe(scrollArea);
    observer?.observe(content);
    return () => observer?.disconnect();
  }, [plants.length]);
  return <div className="shelf-stage"><div ref={viewport} className="scene-window" role="region" aria-label="Plants on your shelf" tabIndex={0}
    onScroll={event => {
      const area = event.currentTarget;
      if (Math.abs(area.scrollLeft - centredAt.current) > 1) userScrolled.current = true;
      if (!active) return;
      const trigger = area.querySelector<HTMLButtonElement>(`#plant-trigger-${active}`);
      if (!trigger) return;
      const bounds = area.getBoundingClientRect();
      const plantBounds = trigger.getBoundingClientRect();
      if (plantBounds.right <= bounds.left || plantBounds.left >= bounds.right) setActive(null);
    }}
    onKeyDown={event => {
      if (event.target !== event.currentTarget) return;
      const area = event.currentTarget;
      const max = Math.max(0, area.scrollWidth - area.clientWidth);
      const step = Math.max(48, area.clientWidth / 2);
      let next: number;
      switch (event.key) {
        case 'ArrowLeft': next = area.scrollLeft - step; break;
        case 'ArrowRight': next = area.scrollLeft + step; break;
        case 'Home': next = 0; break;
        case 'End': next = max; break;
        default: return;
      }
      event.preventDefault();
      userScrolled.current = true;
      area.scrollLeft = Math.max(0, Math.min(max, next));
    }}>
    <div ref={scene} className={`shelf-scene shelf-scene-${Math.min(plants.length, 3)}`} style={{ minWidth: Math.max(300, plants.length * 104) }}>
      <img className="shelf-art" src={assets.shelf} alt="A wooden plant shelf" width="800" height="500" draggable={false} />
      <ul className="shelf-plants">{plants.map(plant => <li key={plant.id}>
        <PlantInfoCard plant={plant} artwork={assets.plants[plant.id]} open={active === plant.id}
          onOpenChange={open => setActive(current => open ? plant.id : current === plant.id ? null : current)} />
      </li>)}</ul>
    </div>
  </div></div>;
}
