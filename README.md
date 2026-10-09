# Code Plants

A TypeScript VS Code extension with a Plant Shelf view inside Explorer.
The view displays the supplied wooden shelf over the funky wallpaper background,
inside a bounded 400 × 300px scene above the bottom controls. The background,
shelf, and plant scale together between 75% and 100%. Smaller views crop the
scene's sides and top; larger views centre it without enlarging it further.
The wallpaper fills the bordered container behind both the scene and **Add +**.
The button sits over the wallpaper at the bottom, keeping its normal size and
remaining visible as the artwork area crops in smaller views.
The main view does not scroll. The bottom **Add +** button opens a Plants dialog showing
Stringle and a Dangleleaf preview labelled **Not available yet**. Dangleleaf
cannot be selected. Close the dialog with **Close**, Escape, or a click outside it.
Short or narrow views use compact previews, spacing, and text; Dangleleaf's
label becomes **Unavailable**. The dialog retains scrolling as a fallback
for extremely small views or increased text zoom.
Click Stringle to place it in the centre of the shelf. The selection is saved
for the current workspace and restored after reloading. Selecting it again
keeps the same single plant on the shelf.

## Requirements

- Node.js 22.22.2+ on the 22.x release line, or 24.15+ on the 24.x release line, and npm.
  The test DOM environment requires these versions.
- VS Code 1.100.0 or newer.

## Develop

1. Run `npm install`.
2. Open this folder in VS Code.
3. Press **F5** and select **Run Code Plants** if prompted.
4. In the Extension Development Host, open Explorer and expand **Plant Shelf**.

F5 builds the extension before launching. If the view is hidden, right-click
an Explorer section heading and enable Plant Shelf. Views can be dragged to
reorder them within Explorer.

For continuous rebuilding, run `npm run watch` in a terminal. After changing
extension code, run **Developer: Reload Window** in the development host.
Reload that window to refresh webview changes too. Watch bundles code; run
`npm run typecheck` separately to check types.

## Commands

- `npm run build`: check types and build extension and webview bundles.
- `npm run watch`: rebuild both bundles when their source files change.
- `npm run typecheck`: check extension, browser, and test TypeScript separately.
- `npm run lint`: lint source files, tests, and test configuration, including webview React hook rules.
- `npm test`: run the Vitest unit and React component tests.
- `npm run vscode:prepublish`: check types, lint, and build minified production bundles.

## React webview

The webview renders React components from `src/webview/main.tsx` using strict
TypeScript, plain CSS, and the automatic JSX transform. `npm run build` and
`npm run watch` use React development mode; `npm run vscode:prepublish` uses
production mode. React is bundled locally, with no runtime network dependency.
The extension retains its separate TypeScript configuration and CommonJS output.

The provider supplies a minimal document shell and safely escaped artwork data.
The messaging adapter validates extension responses, subscribes before requesting
state, and cleans up subscriptions, including React StrictMode remounts.
Persisted shelf state remains authoritative in the extension; dialog, pending,
and error state live in React. The native dialog and existing scene styles remain.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and
`npm run vscode:prepublish`. Tests cover message boundaries, bootstrap handling,
selection, save failure/retry, and subscription lifecycle. Tests use a limited
native-dialog stub; they do not establish browser focus or layout behaviour.

In the Extension Development Host, manually check:

- Empty shelf, selection, repeated selection, and restoration after reload.
- Dialog opening, Close, Escape, backdrop dismissal, and return of focus to Add.
  Dragging from dialog content onto the backdrop must not dismiss it.
- Narrow and short Explorer views, dialog scrolling, and 200% zoom.
- Light, dark, and high-contrast themes, keyboard focus, and status announcements.
- Loaded artwork and bundles, with no CSP violations in webview developer tools.

## Structure

- `src/extension/`: VS Code activation and webview provider.
- `src/webview/`: React entry point, typed messaging adapter, and styles.
- `src/webview/components/`: shelf, dialog, plant cards, and application state.
- `tests/`: Vitest tests, with test types isolated in `tsconfig.tests.json`.
- `assets/plants/`, `assets/shelves/`, and `assets/backgrounds/`: supplied artwork.
- `dist/`: generated bundles, excluded from version control.

The package uses ES modules. Extension source imports use `.js` extensions
with Node16 module resolution. esbuild bundles the VS Code entry point as
`dist/extension.cjs`, so its CommonJS format remains explicit within the
module package. The webview keeps its browser bundle format.

The extension loads local bundled UI files and artwork from `assets/shelves/`
and `assets/backgrounds/`, plus `assets/plants/` for the dialog preview.
The original shelf SVG is preserved; explicit display dimensions follow its
800 × 500 viewBox. The plant pot base and shelf surface share scene coordinates.
Supplied plant artwork is preserved.
