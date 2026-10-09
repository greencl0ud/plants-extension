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

- Node.js 22.13 or newer and npm.
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
- `npm run typecheck`: check extension and browser TypeScript separately.
- `npm run lint`: lint TypeScript source files.

## Structure

- `src/extension/`: VS Code activation and webview provider.
- `src/webview/`: browser UI and styles.
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
