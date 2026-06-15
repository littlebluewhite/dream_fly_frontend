/* Dream Fly — 管理後台 · cross-route client state.
 *
 * The prototype kept toasts + the topbar search term in the top-level React
 * component. Rendered as real SvelteKit routes, that shared state lives here.
 * Edit dialogs mutate local `let` state only; these stores are the only
 * cross-route state. Mock-only, no backend. */

import { writable } from 'svelte/store';

/* ---- Toasts (bottom-right stack, mirrors the member centre, 4000ms) ---- */
export type ToastTone = 'success' | 'info' | 'warning' | 'error';
export interface AdminToast {
	id: number;
	tone: ToastTone;
	title: string;
	body: string;
}

/** Factory — exported so tests get an isolated instance (the app uses the
 *  `toasts` singleton below). */
export function createToasts() {
	const { subscribe, update } = writable<AdminToast[]>([]);
	let seq = 1;
	return {
		subscribe,
		/** Push a toast; it auto-dismisses after 4000ms. Returns its id. */
		notify(tone: ToastTone, title: string, body = ''): number {
			const id = seq++;
			update((t) => [...t, { id, tone, title, body }]);
			setTimeout(() => update((t) => t.filter((x) => x.id !== id)), 4000);
			return id;
		},
		dismiss(id: number) {
			update((t) => t.filter((x) => x.id !== id));
		}
	};
}
export const toasts = createToasts();

/* ---- Topbar search term ---- */
export const search = writable('');
