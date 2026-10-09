import type { BootstrapData } from '../../shared/bootstrap.js';
import { type SavedPlant } from '../../shared/plants.js';
import { PlantInfoCard } from './PlantInfoCard.js';

export function ShelfScene({ assets, plant }: { assets: BootstrapData; plant: SavedPlant | null }) {
  return <div className="shelf-stage"><div className="scene-window"><div className="shelf-scene">
    <img className="shelf-art" src={assets.shelf} alt="A wooden plant shelf" width="800" height="500" draggable={false} />
    {plant && <PlantInfoCard plant={plant} key={plant.id} artwork={assets.plants[plant.id]} />}
  </div></div></div>;
}
