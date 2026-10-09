import './tokens.css';
import './styles.css';
import { isShelfMessage, stringle, type WebviewMessage } from '../shared/plants.js';

declare function acquireVsCodeApi(): { postMessage(message: WebviewMessage): void };
const vscode = acquireVsCodeApi();

const addButton = document.querySelector<HTMLButtonElement>('#add-plant');
const closeButton = document.querySelector<HTMLButtonElement>('#close-dialog');
const plantDialog = document.querySelector<HTMLDialogElement>('#plant-dialog');
const selectButton = document.querySelector<HTMLButtonElement>('#select-plant');
const shelfPlant = document.querySelector<HTMLImageElement>('#shelf-plant');
const plantStatus = document.querySelector<HTMLElement>('#plant-status');
const shelfStatus = document.querySelector<HTMLElement>('#shelf-status');
const selectionError = document.querySelector<HTMLElement>('#selection-error');
let selecting = false;

if (selectButton && shelfPlant && plantStatus && shelfStatus && selectionError && plantDialog) {
  selectButton.addEventListener('click', () => {
    selecting = true;
    selectButton.disabled = true;
    selectionError.textContent = '';
    vscode.postMessage({ type: 'selectPlant', plantId: stringle.id });
  });
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    if (!isShelfMessage(event.data)) return;
    selectButton.disabled = false;
    if (event.data.type === 'saveError') {
      selecting = false;
      selectionError.textContent = 'Could not save your plant. Please try again.';
      return;
    }
    const hasPlant = event.data.plantId === stringle.id;
    shelfPlant.hidden = !hasPlant;
    plantStatus.textContent = hasPlant ? 'On your shelf' : 'Add to shelf';
    if (selecting) {
      selecting = false;
      plantDialog.close();
      shelfStatus.textContent = `${stringle.name} added to shelf.`;
    }
  });
  vscode.postMessage({ type: 'ready' });
}

if (addButton && closeButton && plantDialog) {
  addButton.addEventListener('click', () => plantDialog.showModal());
  closeButton.addEventListener('click', () => plantDialog.close());
  plantDialog.addEventListener('close', () => addButton.focus());

  // Both ends of a pointer gesture must be outside the dialog, so dragging
  // from its content onto the backdrop does not accidentally close it.
  let startedOnBackdrop = false;
  const isOutsideDialog = (event: PointerEvent): boolean => {
    const bounds = plantDialog.getBoundingClientRect();
    return event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom;
  };
  plantDialog.addEventListener('pointerdown', (event) => {
    startedOnBackdrop = isOutsideDialog(event);
  });
  plantDialog.addEventListener('pointerup', (event) => {
    if (startedOnBackdrop && isOutsideDialog(event)) {
      plantDialog.close();
    }
    startedOnBackdrop = false;
  });
  plantDialog.addEventListener('pointercancel', () => {
    startedOnBackdrop = false;
  });
}
