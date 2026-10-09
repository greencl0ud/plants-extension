import { useEffect, useRef, type PointerEvent, type ReactNode } from 'react';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function PlantDialog({ open, onClose, children }: DialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const startedOnBackdrop = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  function outside(event: PointerEvent<HTMLDialogElement>): boolean {
    const bounds = event.currentTarget.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
  }
  return <dialog ref={dialog} id="plant-dialog" aria-labelledby="plant-dialog-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={() => { if (!dialog.current?.open) onClose(); }}
    onPointerDown={(event) => { startedOnBackdrop.current = outside(event); }}
    onPointerUp={(event) => {
      if (startedOnBackdrop.current && outside(event)) onClose();
      startedOnBackdrop.current = false;
    }}
    onPointerCancel={() => { startedOnBackdrop.current = false; }}>
    <div className="dialog-content"><header className="dialog-header">
      <h1 id="plant-dialog-title">Plants</h1>
      <button id="close-dialog" type="button" autoFocus onClick={onClose}>Close</button>
    </header>{children}</div>
  </dialog>;
}
