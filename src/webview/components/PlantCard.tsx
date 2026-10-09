import { type PlantDefinition } from '../../shared/plants.js';

type CardProps = { artwork: string; plant: PlantDefinition } & (
  { available: true; disabled: boolean; status: string; onSelect: () => void }
  | { available: false }
);

export function PlantCard(props: CardProps) {
  const preview = <span className="plant-preview"><img src={props.artwork}
    alt={props.plant.description}
    width="128" height="192" draggable={false} /></span>;
  if (props.available) return <button className="plant-card" type="button"
    disabled={props.disabled} onClick={props.onSelect}>
    {preview}<span className="plant-name">{props.plant.name}</span><span className="plant-status">{props.status}</span>
  </button>;
  return <article className="plant-card plant-card-unavailable" aria-labelledby={`${props.plant.id}-name`}>
    {preview}<h2 id={`${props.plant.id}-name`} className="plant-name">{props.plant.name}</h2>
    <span className="availability-badge"><span className="availability-full">Not available yet</span>
      <span className="availability-compact">Unavailable</span></span>
  </article>;
}
