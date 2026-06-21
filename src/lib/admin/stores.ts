/* Dream Fly — 管理後台 · cross-route client state.
 *
 * The prototype kept toasts + the topbar search term in the top-level React
 * component. Rendered as real SvelteKit routes, that shared state lives here.
 * Edit dialogs mutate local `let` state only; these stores are the only
 * cross-route state. Mock-only, no backend. */

import { writable } from 'svelte/store';

import { createToasts } from '$lib/stores/toasts';
import type { MembersFilter } from './components/members-filter';

/* ---- Toasts (bottom-right stack, 4000ms — canonical store) ---- */
export const toasts = createToasts();

/* ---- Topbar search term ---- */
export const search = writable('');

/* ---- 學員管理 advanced filter (進階篩選 panel) ----
 * Only the advanced dimensions live here (status tab + topbar query stay local to
 * MembersTable). The default is fully pass-through so the table behaves exactly
 * as before until the panel narrows it. */
export const MEMBER_FILTER_DEFAULT: MembersFilter = {
	course: '',
	pay: '',
	attMin: undefined,
	attMax: undefined
};
export const memberFilter = writable<MembersFilter>({ ...MEMBER_FILTER_DEFAULT });
