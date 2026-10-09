import { useCallback, useEffect, useRef, useState } from 'react';
import type { BootstrapData } from '../../shared/bootstrap.js';
import { stringle, type PlantId } from '../../shared/plants.js';
import type { ShelfMessaging } from '../messaging.js';
import { ShelfScene } from './ShelfScene.js';
import { PlantDialog } from './PlantDialog.js';
import { PlantCard } from './PlantCard.js';

export function App({ assets, messaging }: { assets: BootstrapData; messaging: ShelfMessaging }) {
  const [plantId, setPlantId] = useState<PlantId | null | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const selecting = useRef(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [announcement, setAnnouncement] = useState('');
  const addButton = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    addButton.current?.focus();
  }, []);
  useEffect(() => {
    const unsubscribe = messaging.subscribe((message) => {
      if (message.type === 'saveError') {
        selecting.current = false;
        setPending(false);
        setError('Could not save your plant. Please try again.');
        return;
      }
      setPlantId(message.plantId);
      if (selecting.current) {
        selecting.current = false;
        setPending(false);
        close();
        setAnnouncement(`${stringle.name} added to shelf.`);
      }
    });
    messaging.send({ type: 'ready' });
    return unsubscribe;
  }, [messaging, close]);
  function select(): void {
    if (plantId === undefined || selecting.current) return;
    selecting.current = true;
    setPending(true);
    setError('');
    messaging.send({ type: 'selectPlant', plantId: stringle.id });
  }
  return <>
    <main id="shelf" aria-label="Plant Shelf"><div className="shelf-display">
      <img className="background-art" src={assets.background} alt="" width="800" height="500" draggable={false} />
      <ShelfScene assets={assets} hasPlant={plantId === stringle.id} />
      <footer className="shelf-actions"><button ref={addButton} id="add-plant" type="button"
        aria-haspopup="dialog" onClick={() => setOpen(true)}>Add <span aria-hidden="true">+</span></button></footer>
    </div></main>
    <p id="shelf-status" className="visually-hidden" role="status">{announcement}</p>
    <PlantDialog open={open} onClose={close}>
      <ul className="plant-list"><li><PlantCard available artwork={assets.plants.stringle}
        disabled={plantId === undefined || pending} onSelect={select}
        status={plantId === undefined ? 'Loading shelf…' : plantId ? 'On your shelf' : 'Add to shelf'} /></li>
        <li><PlantCard available={false} artwork={assets.plants.dangleleaf} /></li></ul>
      <p id="selection-error" role="status">{error}</p>
    </PlantDialog>
  </>;
}
