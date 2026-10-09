import { useCallback, useEffect, useRef, useState } from 'react';
import type { BootstrapData } from '../../shared/bootstrap.js';
import { plants, getPlant, type PlantId, type SavedPlant } from '../../shared/plants.js';
import type { ShelfMessaging } from '../messaging.js';
import { ShelfScene } from './ShelfScene.js';
import { PlantDialog } from './PlantDialog.js';
import { PlantCard } from './PlantCard.js';
import { PlantList } from './PlantList.js';

export function App({ assets, messaging }: { assets: BootstrapData; messaging: ShelfMessaging }) {
  const [plant, setPlant] = useState<SavedPlant | null | undefined>(undefined);
  const plantId = plant?.id;
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
      setPlant(message.plant);
      if (selecting.current) {
        selecting.current = false;
        setPending(false);
        close();
        setAnnouncement(`${message.plant ? getPlant(message.plant.id).name : "Plant"} added to shelf.`);
      }
    });
    messaging.send({ type: 'ready' });
    return unsubscribe;
  }, [messaging, close]);
  function select(id: PlantId): void {
    if (plant === undefined || selecting.current) return;
    selecting.current = true;
    setPending(true);
    setError('');
    messaging.send({ type: 'selectPlant', plantId: id });
  }
  return <>
    <main id="shelf" aria-label="Plant Shelf"><div className="shelf-display">
      <img className="background-art" src={assets.background} alt="" width="800" height="500" draggable={false} />
      <ShelfScene assets={assets} plant={plant ?? null} />
      <footer className="shelf-actions"><button ref={addButton} id="add-plant" type="button"
        aria-haspopup="dialog" onClick={() => setOpen(true)}>Add <span aria-hidden="true">+</span></button></footer>
    </div></main>
    <p id="shelf-status" className="visually-hidden" role="status">{announcement}</p>
    <PlantDialog open={open} onClose={close}>
      <PlantList open={open}>{plants.map(definition => <li key={definition.id}>
        {definition.available ? <PlantCard plant={definition} available artwork={assets.plants[definition.id]}
          disabled={plant === undefined || pending} onSelect={() => select(definition.id)}
          status={plant === undefined ? 'Loading shelf…' : plantId === definition.id ? 'On your shelf' : 'Add to shelf'} />
          : <PlantCard plant={definition} available={false} artwork={assets.plants[definition.id]} />}
      </li>)}</PlantList>
      <p id="selection-error" role="status">{error}</p>
    </PlantDialog>
  </>;
}
