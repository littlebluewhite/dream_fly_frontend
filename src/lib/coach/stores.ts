/* Dream Fly — 教練端 · cross-route client state.
 *
 * The prototype kept toasts + the topbar search term in the top-level React
 * component (app.jsx). Rendered as real SvelteKit routes, that shared state
 * lives here. Self-contained — does NOT re-export from admin. Mock-only.
 *
 * NB: the coach prototype auto-dismisses toasts after 4200ms (app.jsx:39),
 * not admin's 4000ms — kept source-faithful. */

import { writable } from 'svelte/store';

import { createToasts } from '$lib/stores/toasts';

/* ---- Toasts (bottom-right stack, 4000ms — canonical store) ---- */
export const toasts = createToasts();

/* ---- Topbar search term ---- */
export const search = writable('');
