import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { BootstrapData } from '../../shared/bootstrap.js';
import { plants, getPlant, type PlantId, type SavedPlant, type CareSummary } from '../../shared/plants.js';
import type { ShelfMessaging } from '../messaging.js';
import { ShelfScene } from './ShelfScene.js';
import { PlantDialog } from './PlantDialog.js';
import { PlantCard } from './PlantCard.js';
import { PlantList } from './PlantList.js';

export function App({ assets, messaging }: { assets: BootstrapData; messaging: ShelfMessaging }) {
  const [shelf, setShelf] = useState<SavedPlant[] | undefined>(undefined);
  const [care, setCare] = useState<CareSummary>();
  const [careError, setCareError] = useState('');
  const feeding = useRef<PlantId | null>(null);
  const [feedingPending, setFeedingPending] = useState(false);
  const [earningError, setEarningError] = useState('');
  const [pending, setPending] = useState(false);
  const selecting = useRef<PlantId | null>(null);
  const focusNext = useRef<PlantId | null>(null);
  const modal = useRef<HTMLDivElement>(null);
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
      if (message.type === 'earningError') {
        setEarningError('Could not save editing credit. Retrying while this window is open.');
        return;
      }
      if (message.type === 'saveError') {
        if (feeding.current) {
          feeding.current = null;
          setFeedingPending(false);
          setCareError('Could not save feeding. Your food and growth are unchanged. Please try again.');
          return;
        }
        selecting.current = null;
        setPending(false);
        setError('Could not save your plant. Please try again.');
        return;
      }
      setShelf(message.plants);
      setCare(message.care);
      setEarningError('');
      if (message.fedPlantId && feeding.current === message.fedPlantId) {
        feeding.current = null;
        setFeedingPending(false);
        setAnnouncement(`${getPlant(message.fedPlantId).name} care saved.`);
      }
      if (selecting.current && message.plants.some(plant => plant.id === selecting.current)) {
        const id = selecting.current;
        selecting.current = null;
        setPending(false);
        focusNext.current = id;
        setAnnouncement(`${getPlant(id).name} added to shelf.`);
      }
    });
    messaging.send({ type: 'ready' });
    return unsubscribe;
  }, [messaging]);
  useLayoutEffect(() => {
    if (!focusNext.current) return;
    const id = focusNext.current;
    focusNext.current = null;
    if (!open) return;
    const buttons = Array.from(modal.current?.querySelectorAll<HTMLButtonElement>('button.plant-card') ?? []);
    const index = buttons.findIndex(button => button.dataset.plantId === id);
    const next = [...buttons.slice(index + 1), ...buttons.slice(0, index)].find(button => !button.disabled);
    (next ?? document.getElementById('close-dialog'))?.focus();
  }, [shelf, pending, open]);
  function select(id: PlantId): void {
    if (shelf === undefined || selecting.current || feeding.current || shelf.some(plant => plant.id === id)) return;
    selecting.current = id;
    document.getElementById("close-dialog")?.focus();
    setPending(true);
    setError('');
    messaging.send({ type: 'addPlant', plantId: id });
  }
  function feed(id: PlantId): void {
    if (feeding.current || selecting.current || !care || care.food < 1) return;
    feeding.current = id;
    setFeedingPending(true);
    setCareError('');
    messaging.send({ type: 'feedPlant', plantId: id });
  }
  return <>
    <main id="shelf" aria-label="Plant Shelf"><div className="shelf-display">
      <img className="background-art" src={assets.background} alt="" width="800" height="500" draggable={false} />
      <header className="shelf-actions"><button ref={addButton} id="add-plant" type="button"
        aria-haspopup="dialog" onClick={() => setOpen(true)}>Add <span aria-hidden="true">+</span></button>
        {care && <div className="care-summary" role="status"><strong>{care.food} food</strong>
          <span>{care.earnedToday >= 12 ? 'Daily earning limit reached' : `${care.editingMinutes}/5 editing minutes`}</span></div>}
      </header>
      <ShelfScene assets={assets} plants={shelf ?? []} care={care} onFeed={feed}
        feedingPending={feedingPending || pending} careError={careError} />
      {earningError && <p className="care-error" role="status">{earningError}</p>}
    </div></main>
    <p id="shelf-status" className="visually-hidden" role="status">{announcement}</p>
    <PlantDialog open={open} onClose={close}>
      <div ref={modal}><PlantList open={open}>{plants.map(definition => <li key={definition.id}>
        {definition.available ? <PlantCard plant={definition} available artwork={assets.plants[definition.id]}
          disabled={shelf === undefined || pending || shelf.some(plant => plant.id === definition.id)} onSelect={() => select(definition.id)}
          status={shelf === undefined ? 'Loading shelf…' : shelf.some(plant => plant.id === definition.id) ? 'On your shelf' : 'Add to shelf'} />
          : <PlantCard plant={definition} available={false} artwork={assets.plants[definition.id]} />}
      </li>)}</PlantList></div>
      <p id="selection-error" role="status">{error}</p>
    </PlantDialog>
  </>;
}
