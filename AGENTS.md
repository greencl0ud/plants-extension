# Project: Code Plants

## Purpose

Build a TypeScript VS Code extension that displays a plant shelf
in a collapsible webview inside Explorer.

Start with a shelf and one plant. Add plant-care features after
the basic extension and visual scene work well.

## Current scope

- Register a Plant Shelf view in Explorer.
- Display a responsive shelf with one placeholder plant.
- Support local development through an Extension Development Host.
- Allow supplied artwork to replace placeholders easily.

Do not add watering, growth, collections, or unlockable items
unless the current task requests them.

## Technology

- TypeScript with strict type checking.
- VS Code API for extension integration.
- React and TypeScript for the webview, with plain CSS.
- esbuild for bundling.
- npm for dependency management.

React is the agreed target for the webview migration. The existing UI
uses plain TypeScript until that migration is requested.
Prefer small dependencies. Discuss adding other UI frameworks, component
kits, state libraries, animation libraries, or game engines before
introducing them.

## Architecture

- src/extension/: activation, view provider, commands, persistence.
- src/webview/: shelf rendering, styling, browser interactions.
- src/webview/components/: React UI components as the migration develops.
- src/shared/: types shared between extension and webview, when needed.
- assets/: bundled plant, pot, and shelf artwork.

Keep VS Code API usage inside extension code.
Communicate between extension and webview through typed messages.
Keep plant definitions separate from rendering logic.

## React conventions

- Keep React and React DOM inside src/webview/; keep extension code in
  plain TypeScript and shared types and domain rules independent of React.
- Use function components and strict TypeScript. Use .tsx for JSX.
- Let React own rendered UI; derive presentation from state rather than
  manually changing React-managed DOM content.
- Use refs for native browser APIs, including dialog opening, closing,
  and focus management. Preserve native dialog and semantic HTML behaviour.
- Keep temporary interaction state local. Treat extension state as
  authoritative for persisted data; avoid duplicating derived state.
- Start with local state. Use a reducer when transitions warrant it;
  introduce Context only when components need shared access.
- Use effects to synchronize with external systems, with cleanup for
  listeners, timers, and animations. Do not use effects to calculate
  values that can be derived during rendering.
- Acquire the VS Code webview API once through a small typed messaging
  adapter. Validate received messages and subscribe before sending ready.
- Preserve CSS tokens, responsive scene coordinates, supplied artwork,
  restrictive CSP, and accessibility requirements during migration.
- Use CSS or browser animation APIs where suitable; avoid React state
  updates for every animation frame and respect reduced-motion preferences.
- Keep migration focused on existing behaviour. Add plant-care features
  in separately requested milestones.

### React testing

- Follow the testing pyramid: many fast domain and message-validation
  tests, UI/integration tests for interactions, and a few extension
  end-to-end checks for wiring and persistence.
- Use React Testing Library for component tests once test tooling exists.
  Test observable behaviour through accessible roles and names rather
  than component internals or large markup snapshots.
- Mock the messaging adapter for component tests; verify extension
  persistence and message handling separately.
- Verify native dialog behaviour, focus, responsive layout, themes, and
  zoom in a real browser or Extension Development Host. DOM-emulator
  tests do not replace those checks.

## Visual behaviour

- Adapt to narrow and resized Explorer views.
- Support light and dark themes.
- Respect reduced-motion preferences when adding animations.
- Keep plants aligned naturally with the shelf.
- Use temporary placeholders until supplied assets are available.
- Preserve original supplied artwork.

## Webview practices

- Use webview.asWebviewUri for local assets.
- Restrict localResourceRoots to required directories.
- Set a restrictive Content Security Policy.
- Validate incoming messages before handling them.
- Avoid remote scripts and runtime network dependencies.

## Working practices

- Keep changes focused on the requested milestone.
- Avoid speculative abstractions and unrelated refactors.
- Update the README when setup or development commands change.
- Do not claim a command or check passed unless it was run.

## Coding Standards

- Use TypeScript with strict typing
- Prefer small, reusable functions
- Use async/await instead of .then()
- Avoid using `any`
- Keep business logic separate from UI

## Accessibility (a11y) Requirements

All UI changes must follow WCAG 2.2 Level AA.

### Semantic HTML

- Prefer semantic HTML over generic divs.
- Use native buttons for actions and links for navigation.
- Never use clickable divs or spans.
- Maintain a logical heading hierarchy.
- Use lists for grouped content where appropriate.

### Keyboard Accessibility

- All interactive elements must be keyboard accessible.
- Ensure visible keyboard focus indicators.
- Never use positive tabindex values.
- Support Enter and Space for appropriate controls.
- Ensure focus order follows the visual layout.
- Manage focus when dialogs open and close.

### Screen Readers

- All form inputs must have accessible labels.
- All meaningful images must have descriptive alt text.
- Decorative images must use alt="".
- Use ARIA only when native HTML is insufficient.
- Dynamic status updates should be announced
  when appropriate using aria-live or role="status".
- Error messages must be associated with inputs.

### Visual Accessibility

- Normal text must meet 4.5:1 contrast.
- Large text must meet 3:1 contrast.
- UI component boundaries and meaningful graphical
  elements must meet applicable 3:1 requirements.
- Do not rely on colour alone to convey information.
- Support zoom up to 200% without loss of content.
- Respect prefers-reduced-motion.

## UI design

- Before creating and modifying UI components read docs/STYLE_GUIDE.md

## Verification

Once the scripts exist, run the relevant build, typecheck,
and lint checks for code changes.

For visual changes, check the Extension Development Host when
available. Otherwise, explain what still needs manual verification.

Add tests for meaningful behaviour as it develops.
