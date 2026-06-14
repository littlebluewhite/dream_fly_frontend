# Dream Fly — design source snapshots (reference only)

Read-only snapshots of the Claude Design export that the site's design-system
alignment was built from. **This is reference material, not a runnable app** —
the live implementation is the SvelteKit project under `src/`.

Contents:

- **`tokens/*.css`** — the canonical `--df-*` design tokens. The same files are
  copied verbatim into `src/lib/styles/tokens/` (loaded via `global.css`); edit
  there, keep these as the untouched source of truth.
- **`readme.md`** — the design-system guidelines (brand voice, colour, type,
  iconography, layout, motion).
- **`styles.css`** — the design-system entry point (imports the token files).
- **`marketing/*.jsx`** — the original **React** prototype source for the
  marketing site, kept as the section-by-section spec (layout, copy, exact
  styles) that the Svelte homepage was reconstructed from.

> The `marketing/*.jsx` files reference the original `_ds` component bundle
> (`window.DreamFlyDesignSystem_*`), which is **not** vendored here, so they are
> source-for-reading only — they are not meant to run. The runnable prototype
> shell (`index.html`) was intentionally omitted for this reason.
