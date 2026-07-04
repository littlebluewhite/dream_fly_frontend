/* Dream Fly — 管理後台 · cross-route client state.
 *
 * The prototype kept toasts + the topbar search term in the top-level React
 * component. Rendered as real SvelteKit routes, that shared state lives here.
 * Edit dialogs mutate local `let` state only; these stores are the only
 * cross-route state. Mock-only, no backend. */

import { writable } from 'svelte/store';

import { createToasts } from '$lib/stores/toasts';
import type { MemberAccountFilter } from './components/member-account-filter';

/* ---- Toasts (bottom-right stack, 4000ms — canonical store) ---- */
export const toasts = createToasts();

/* ---- Topbar search term ---- */
export const search = writable('');

/* ---- 學員管理 advanced filter (進階篩選 panel) ----
 * Task 5: retyped from MembersFilter (mock Member: course/pay/attMin/attMax) to
 * MemberAccountFilter (real GET /users shape) now that the 學員管理 page's table
 * consumes getMembers(). Only 點數 (pointsMin) lives here — 課程/繳費狀態/出席率 had no
 * backend data source and were removed (P2, issue #8); 狀態 (啟用中/已停用) narrowing
 * stays local to MembersTable's own tabs, same as before. The default is fully
 * pass-through so the table is unnarrowed until the panel is used. */
export const MEMBER_FILTER_DEFAULT: MemberAccountFilter = {
	pointsMin: undefined
};
export const memberFilter = writable<MemberAccountFilter>({ ...MEMBER_FILTER_DEFAULT });
