/* Dream Fly — 教練端 · cross-route client state.
 *
 * The prototype kept toasts + the topbar search term in the top-level React
 * component (app.jsx). Rendered as real SvelteKit routes, that shared state
 * lives here. Self-contained — does NOT re-export from admin. Mock-only.
 *
 * NB: toasts auto-dismiss at 4000ms, unified across desktop surfaces (the
 * coach prototype used 4200ms; aligned in the consolidation — see ADR 0005). */

import { writable } from 'svelte/store';

import { createToasts } from '$lib/stores/toasts';

/* ---- Toasts (bottom-right stack, 4000ms — canonical store) ---- */
export const toasts = createToasts();

/* ---- Topbar search term ---- */
export const search = writable('');
