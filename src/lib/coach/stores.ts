/* Dream Fly — 教練端 · cross-route client state.
 *
 * The prototype kept toasts + the topbar search term in the top-level React
 * component (app.jsx). Rendered as real SvelteKit routes, that shared state
 * lives here. Self-contained — does NOT re-export from admin. Mock-only.
 *
 * NB: the coach prototype auto-dismisses toasts after 4200ms (app.jsx:39),
 * not admin's 4000ms — kept source-faithful. */

import { writable } from 'svelte/store';

/* ---- Toasts (bottom-right stack, 4200ms) ---- */
export type ToastTone = 'success' | 'info' | 'warning' | 'error';
export interface CoachToast {
	id: number;
	tone: ToastTone;
	title: string;
	body: string;
}

/** Factory — exported so tests get an isolated instance (the app uses the
 *  `toasts` singleton below). */
export function createToasts() {
	const { subscribe, update } = writable<CoachToast[]>([]);
	let seq = 1;
	return {
		subscribe,
		/** Push a toast; it auto-dismisses after 4200ms. Returns its id. */
		notify(tone: ToastTone, title: string, body = ''): number {
			const id = seq++;
			update((t) => [...t, { id, tone, title, body }]);
			setTimeout(() => update((t) => t.filter((x) => x.id !== id)), 4200);
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
