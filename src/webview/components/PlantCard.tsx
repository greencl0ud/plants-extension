import { dangleleaf, stringle } from '../../shared/plants.js';

type CardProps = { artwork: string } & (
  { available: true; disabled: boolean; status: string; onSelect: () => void }
  | { available: false }
);

export function PlantCard(props: CardProps) {
  const preview = <span className="plant-preview"><img src={props.artwork}
    alt={props.available ? 'A small two-leaf plant in a terracotta pot' : 'A small plant with a heart-shaped leaf in a terracotta pot'}
    width="128" height="192" draggable={false} /></span>;
  if (props.available) return <button id="select-plant" className="plant-card" type="button"
    disabled={props.disabled} onClick={props.onSelect}>
    {preview}<span className="plant-name">{stringle.name}</span><span id="plant-status">{props.status}</span>
  </button>;
  return <article className="plant-card plant-card-unavailable" aria-labelledby="dangleleaf-name">
    {preview}<h2 id="dangleleaf-name" className="plant-name">{dangleleaf.name}</h2>
    <span className="availability-badge"><span className="availability-full">Not available yet</span>
      <span className="availability-compact">Unavailable</span></span>
  </article>;
}
