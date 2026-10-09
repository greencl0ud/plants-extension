import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { getPlant, plantArtworkBounds, type SavedPlant } from '../../shared/plants.js';

export function PlantInfoCard({ plant, artwork, open, onOpenChange }: {
  plant: SavedPlant; artwork: string; open: boolean; onOpenChange: (open: boolean) => void;
}) {
  const definition = getPlant(plant.id);
  const setOpen = useCallback((value: boolean) => onOpenChange(value), [onOpenChange]);
  const infoId = `plant-info-${plant.id}`;
  const [position, setPosition] = useState<CSSProperties>({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const [overArtwork, setOverArtwork] = useState(false);
  function artworkContains(clientX: number, clientY: number): boolean | null {
    const frame = image.current?.getBoundingClientRect();
    if (!frame || frame.width <= 0 || frame.height <= 0) return null;
    const x = (clientX - frame.left) * 128 / frame.width;
    const y = (clientY - frame.top) * 192 / frame.height;
    const bounds = plantArtworkBounds[plant.id];
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
  }
  const dismiss = useCallback((restoreFocus = false) => {
    if (restoreFocus && card.current?.contains(document.activeElement)) trigger.current?.focus();
    setOpen(false);
  }, [setOpen]);
  useEffect(() => {
    if (!open) return;
    function key(event: KeyboardEvent) { if (event.key === 'Escape') dismiss(true); }
    function outside(event: MouseEvent) {
      if (event.target instanceof Node && !trigger.current?.contains(event.target)
        && !card.current?.contains(event.target)) dismiss();
    }
    document.addEventListener('keydown', key);
    document.addEventListener('click', outside);
    return () => {
      document.removeEventListener('keydown', key);
      document.removeEventListener('click', outside);
    };
  }, [open, dismiss]);
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!trigger.current || !card.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const box = card.current.getBoundingClientRect();
      const width = Math.min(document.documentElement.clientWidth || window.innerWidth, window.innerWidth);
      const height = Math.min(document.documentElement.clientHeight || window.innerHeight, window.innerHeight);
      // DOM rectangles include CSS zoom; fixed-position offsets use CSS pixels.
      const scale = card.current.offsetWidth > 0 ? box.width / card.current.offsetWidth : 1;
      const above = anchor.top - box.height - 8;
      const below = anchor.bottom + 8;
      const preferred = above >= 8 ? above : below;
      setPosition({
        maxWidth: Math.max(0, width / scale - 16),
        maxHeight: Math.max(0, height / scale - 16),
        left: Math.max(8, Math.min(anchor.left + anchor.width / 2 - box.width / 2, width - box.width - 8)) / scale,
        top: Math.max(8, Math.min(preferred, height - box.height - 8)) / scale,
      });
    }
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (card.current) observer?.observe(card.current);
    if (trigger.current) observer?.observe(trigger.current);
    window.addEventListener('resize', place);
    document.addEventListener('scroll', place, true);
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); document.removeEventListener('scroll', place, true); };
  }, [open, position.maxWidth, position.maxHeight]);
  const date = plant.addedAt === null ? 'unknown'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(plant.addedAt));
  return <>
    <button ref={trigger} className="shelf-plant plant-info-trigger" type="button"
      aria-label={`View information about ${definition.name}`} aria-expanded={open}
      id={`plant-trigger-${plant.id}`} aria-controls={open ? infoId : undefined} aria-describedby={open ? infoId : undefined}
      style={{ cursor: overArtwork ? 'pointer' : 'default' }}
      onPointerMove={event => setOverArtwork(artworkContains(event.clientX, event.clientY) === true)}
      onPointerLeave={() => setOverArtwork(false)}
      onFocus={() => {
        trigger.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      }}
      onClick={event => {
        // Native keyboard/assistive activation has no pointer coordinates.
        if (event.detail !== 0 && artworkContains(event.clientX, event.clientY) === false) {
          setOpen(false);
          return;
        }
        setOpen(!open);
      }}>
      <img ref={image} id={`shelf-plant-${plant.id}`} src={artwork} alt={`${definition.name}, ${definition.description.toLowerCase()}`}
        width="128" height="192" draggable={false} />
    </button>
    {open && createPortal(<section ref={card} id={infoId} className="plant-info" aria-labelledby={`${infoId}-name`} tabIndex={0}
      style={position}>
      <h2 id={`${infoId}-name`}>{definition.name}</h2>
      <p><strong>Date added</strong> <span>{date}</span></p>
      <dl><div><dt>Stage</dt><dd>{plant.stage}</dd></div>
        <div><dt id={`${infoId}-health`}>Health</dt><dd>{plant.health.label}</dd></div></dl>
      <meter min={0} max={100} value={plant.health.value} aria-labelledby={`${infoId}-health`}
        aria-valuetext={plant.health.label}>{plant.health.label}</meter>
    </section>, document.body)}
  </>;
}
