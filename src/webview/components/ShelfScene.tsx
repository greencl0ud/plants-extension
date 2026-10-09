import type { BootstrapData } from '../../shared/bootstrap.js';
import { stringle } from '../../shared/plants.js';

export function ShelfScene({ assets, hasPlant }: { assets: BootstrapData; hasPlant: boolean }) {
  return <div className="shelf-stage"><div className="scene-window"><div className="shelf-scene">
    <img className="shelf-art" src={assets.shelf} alt="A wooden plant shelf" width="800" height="500" draggable={false} />
    <img id="shelf-plant" className="shelf-plant" src={assets.plants.stringle}
      alt={`${stringle.name}, a small two-leaf plant in a terracotta pot`}
      width="128" height="192" draggable={false} hidden={!hasPlant} />
  </div></div></div>;
}
