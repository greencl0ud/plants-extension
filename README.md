# Code Plants

A TypeScript VS Code extension with a Plant Shelf view inside Explorer.
The view displays the supplied wooden shelf over the funky wallpaper background.
Use **Add +** in the container’s top-left corner to open the Plants dialog and add Stringle, Pricklepop, or Pebblebloom.
Each plant can be added once; owned plants show **On your shelf** with a disabled
button. Dangleleaf remains a preview labelled **Not available yet**.
The dialog stays open after additions and moves focus to the next available
plant, or Close when all plants have been added. Close it with **Close**, Escape,
or a click outside it. Cards stack when their text would wrap in the grid.

Plants appear in addition order, with smaller artwork as the shelf fills.
Narrow views scroll the shelf horizontally instead of shrinking plants below
72px wide. A contrasting horizontal scrollbar appears when needed. Focus the
shelf region and use Left/Right or Home/End to browse; Tab brings each plant
into view. Manual scrolling is preserved when the panel resizes. Click a plant, or focus it and press Enter or Space,
to inspect its name, date added, stage, and health. Only one info card is
open at a time; click outside it or press Escape to close it. Cards follow their plants when the shelf scrolls and close when their plant
moves completely out of view.

The collection and each plant's metadata are saved for the current workspace.
Existing single-plant saves migrate automatically while retaining the original
save. Historical dates that were never recorded remain unknown. Additions appear
only after saving succeeds; failed saves can be retried.

## Plant care

The workspace shares a food balance, shown beside **Add**, and progress such as
**3/5 editing minutes**. Each fixed clock minute containing a text change in an
open workspace document earns one credit. Five credited minutes earn one food,
up to twelve food per local calendar day. Only the focused VS Code window earns
credit. Unsaved edits, formatting, refactoring, paste, deletion, and undo count;
reading, unchanged saves, untitled documents, and files outside the workspace do not.
Food can be earned before adding a plant and never expires. Partial progress is saved.

Open a plant’s info card and choose **Feed · 1 food**. Feeding spends shared food
on that plant, makes it thriving for 168 hours, then content for another 168 hours,
then resting. Unfed new plants start content for 168 hours. Existing plants receive
this content period on their first care migration. Resting never causes sickness,
death, or loss of growth. Feeding refreshes the period instead of stacking time.

Each food adds one permanent growth point: **Growing** at five points and
**Mature** at fifteen. Mature plants can be fed when content or resting to refresh
health; mature thriving plants cannot be fed. **Visual growth is pending:** every
stage uses the existing stage-one artwork in this release.

Care saves are local and workspace-specific. Windows sharing a workspace use one
locked, atomically replaced garden file in VS Code’s extension workspace storage;
this prevents duplicate credit and lost food updates. Credited minute identities
are retained locally so delayed retries from other windows can arrive out of order.
This history grows by at most 60 credited minutes per earning day. Existing care
saves retain their original deduplication watermark; minutes at or before that
pre-upgrade watermark cannot be recovered. Original collection and
single-plant saves remain untouched after migration. A failed feeding leaves food
and growth unchanged. Failed editing credit retries while the window remains open;
credit that never saved can be lost when the window closes. Balances, minute credit,
and care timestamps are stored; code contents and file names are never recorded.
No activity telemetry or reward pop-ups are used.

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
unique additions, migration, concurrent persistence, save failure/retry,
info cards, modal focus, subscription lifecycle, care boundaries, daily limits,
feeding failures, and shared-file persistence. Tests use a limited
native-dialog stub; they do not establish browser focus or layout behaviour.

In the Extension Development Host, manually check:

- Editing progress, food earnings, feeding, mature feeding limits, save retries,
  and restoration of care after reload. Open the same workspace in two windows
  and verify one credit per minute while switching focus.
- Empty shelf, one through three additions, owned-card availability, legacy
  migration, and restoration after reload.
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
