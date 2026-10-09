import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPlant, type SavedPlant } from '../../shared/plants.js';

export function PlantInfoCard({ plant, artwork }: { plant: SavedPlant; artwork: string }) {
  const definition = getPlant(plant.id);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 8, top: 8 });
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pinned = useRef(false);
  const suppressed = useRef(false);
  const hovered = useRef(false);
  const focused = useRef(false);
  function clearTimer() { clearTimeout(timer.current); }
  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    suppressed.current = true;
    pinned.current = false;
    if (card.current?.contains(document.activeElement)) trigger.current?.focus();
    setOpen(false);
  }, []);
  function enter() {
    hovered.current = true;
    clearTimer();
    if (!suppressed.current) timer.current = setTimeout(() => setOpen(true), 300);
  }
  function leave() {
    hovered.current = false;
    clearTimer();
    if (!focused.current) suppressed.current = false;
    timer.current = setTimeout(() => {
      if (!pinned.current && !focused.current) setOpen(false);
    }, 150);
  }
  useEffect(() => {
    function key(event: KeyboardEvent) { if (event.key === 'Escape') dismiss(); }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !trigger.current?.contains(event.target)
        && !card.current?.contains(event.target)) dismiss();
    }
    document.addEventListener('keydown', key);
    document.addEventListener('pointerdown', outside);
    return () => {
      clearTimeout(timer.current);
      document.removeEventListener('keydown', key);
      document.removeEventListener('pointerdown', outside);
    };
  }, [dismiss]);
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!trigger.current || !card.current) return;
      const anchor = trigger.current.getBoundingClientRect();
      const box = card.current.getBoundingClientRect();
      const width = document.documentElement.clientWidth || window.innerWidth;
      const height = document.documentElement.clientHeight || window.innerHeight;
      const above = anchor.top - box.height - 8;
      const below = anchor.bottom + 8;
      const preferred = above >= 8 ? above : below;
      setPosition({
        left: Math.max(8, Math.min(anchor.left + anchor.width / 2 - box.width / 2, width - box.width - 8)),
        top: Math.max(8, Math.min(preferred, height - box.height - 8)),
      });
    }
    place();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(place);
    if (card.current) observer?.observe(card.current);
    if (trigger.current) observer?.observe(trigger.current);
    window.addEventListener('resize', place);
    return () => { observer?.disconnect(); window.removeEventListener('resize', place); };
  }, [open]);
  const date = plant.addedAt === null ? 'unknown'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(plant.addedAt));
  return <>
    <button ref={trigger} className="shelf-plant plant-info-trigger" type="button"
      aria-label={`View information about ${definition.name}`} aria-expanded={open}
      aria-controls={open ? 'plant-info' : undefined} aria-describedby={open ? 'plant-info' : undefined}
      onPointerEnter={(event) => { if (event.pointerType !== 'touch') enter(); }}
      onPointerLeave={leave}
      onFocus={() => { focused.current = true; clearTimer(); if (!suppressed.current) setOpen(true); }}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && card.current?.contains(event.relatedTarget)) return;
        focused.current = false; if (!hovered.current) suppressed.current = false; leave();
      }}
      onClick={() => {
        clearTimer();
        if (pinned.current) dismiss();
        else { suppressed.current = false; pinned.current = true; setOpen(true); }
      }}>
      <img id="shelf-plant" src={artwork} alt={`${definition.name}, ${definition.description.toLowerCase()}`}
        width="128" height="192" draggable={false} />
    </button>
    {open && createPortal(<section ref={card} id="plant-info" className="plant-info" aria-labelledby="plant-info-name" tabIndex={0}
      onFocus={() => { focused.current = true; clearTimer(); }}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && trigger.current?.contains(event.relatedTarget)) return;
        focused.current = false; leave();
      }}
      style={{ left: position.left, top: position.top }} onPointerEnter={enter} onPointerLeave={leave}>
      <h2 id="plant-info-name">{definition.name}</h2>
      <p><strong>Date added</strong> <span>{date}</span></p>
      <dl><div><dt>Stage</dt><dd>{plant.stage}</dd></div>
        <div><dt id="plant-health-label">Health</dt><dd>{plant.health.label}</dd></div></dl>
      <meter min={0} max={100} value={plant.health.value} aria-labelledby="plant-health-label"
        aria-valuetext={plant.health.label}>{plant.health.label}</meter>
    </section>, document.body)}
  </>;
}
