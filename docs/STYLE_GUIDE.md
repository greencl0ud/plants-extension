# Code Plants Style Guide

## Colour palette

Use the CSS custom properties in [src/webview/tokens.css](../src/webview/tokens.css)
as the source of truth for Code Plants colours. The webview entry point imports
these tokens before the scene styles.

Reference colours with `var(--color-...)` rather than duplicating hex values
in component styles. Add or change palette values in `tokens.css`.

| Purpose | Tokens |
| --- | --- |
| Plant foliage | `--color-forest-green`, `--color-sage`, `--color-soft-mint` |
| Plant pots | `--color-terracotta` |
| Shelf | `--color-warm-wood`, `--color-dark-wood` |
| Flowers | `--color-dusty-pink`, `--color-soft-yellow` |
| Backgrounds | `--color-soft-cream` |
| Outlines | `--color-outline` |
| Plant resources | `--color-water`, `--color-sunlight`, `--color-nutrients` |
| UI | `--color-text`, `--color-text-muted`, `--color-border` |

For example:

```css
.plant-label {
  color: var(--color-text);
  background-color: var(--color-soft-cream);
}
```

## Themes and accessibility

Use the palette for the illustrated scene and its custom UI. Keep VS Code theme
variables for editor-integrated surfaces, text, and controls where theme
compatibility is needed. Support light, dark, and high-contrast themes.

Check contrast for each foreground/background pairing; palette membership
does not guarantee accessible contrast. Normal text needs at least 4.5:1,
large text 3:1, and meaningful control boundaries 3:1 where applicable.
Use a darker palette token or an appropriate VS Code theme colour when a
pairing fails. Do not communicate state through colour alone.

## Supplied artwork

Preserve supplied SVG and image files. Use the palette for new artwork, but
do not recolour existing assets unless requested. CSS tokens in the webview
do not automatically apply inside SVG files loaded as images.

## Typography

Use a base text size of 90% of the VS Code font-size setting. Dialogs and
controls inherit this size; headings use relative `em` sizes. Keep text
responsive to editor font settings and zoom, and allow wrapping in narrow views.
