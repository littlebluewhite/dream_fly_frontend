/* Dream Fly — canonical toast store (cross-surface).
 *
 * Factory-based so tests get an isolated instance; the app uses the
 * `toasts` singleton exported at the bottom.
 *
 * Behaviours:
 *   - CAP = 4: if a new (non-dedup) push would exceed 4, the oldest is evicted.
 *   - dedup: identical (tone, title, body) resets the timer and returns the
 *     existing id rather than adding a new entry.
 *   - auto-dismiss: every entry expires after `duration` ms.
 *   - this-free: notify/dismiss close over `update` so they are safe to
 *     destructure (e.g. `const { notify } = toasts`). */

import { writable } from 'svelte/store';

export type ToastTone = 'success' | 'info' | 'warning' | 'error' | 'accent';

export interface ToastItem {
	id: number;
	tone: ToastTone;
	title: string;
	body: string;
	/* Re-render nonce: bumped each time a dedup hit re-schedules this toast, so
	 * a keyed view (ToastPublic's progress bar) can remount and restart. */
	bump: number;
}

const CAP = 4;

export function createToasts(duration = 4000) {
	const { subscribe, update } = writable<ToastItem[]>([]);
	let seq = 1;
	const timers = new Map<number, ReturnType<typeof setTimeout>>();

	function scheduleExpiry(id: number) {
		const handle = setTimeout(() => {
			timers.delete(id);
			update((t) => t.filter((x) => x.id !== id));
		}, duration);
		timers.set(id, handle);
	}

	function clearTimer(id: number) {
		const h = timers.get(id);
		if (h !== undefined) {
			clearTimeout(h);
			timers.delete(id);
		}
	}

	const notify = (tone: ToastTone, title: string, body = ''): number => {
		let existingId: number | undefined;

		// Check for a duplicate already on screen; if found, bump it so a keyed
		// view can remount (immutable update → new array + new entry object).
		update((current) => {
			const found = current.find(
				(x) => x.tone === tone && x.title === title && x.body === body
			);
			if (!found) return current;
			existingId = found.id;
			return current.map((x) => (x.id === found.id ? { ...x, bump: x.bump + 1 } : x));
		});

		if (existingId !== undefined) {
			// Dedup hit — reset timer, return same id.
			clearTimer(existingId);
			scheduleExpiry(existingId);
			return existingId;
		}

		// New entry.
		const id = seq++;
		update((current) => {
			const next = [...current, { id, tone, title, body, bump: 0 }];
			if (next.length > CAP) {
				// Evict the oldest (first) entry.
				const evicted = next.shift()!;
				clearTimer(evicted.id);
			}
			return next;
		});
		scheduleExpiry(id);
		return id;
	};

	const dismiss = (id: number) => {
		clearTimer(id);
		update((t) => t.filter((x) => x.id !== id));
	};

	return { subscribe, notify, dismiss };
}

/** App-wide singleton — surfaces import this directly. */
export const toasts = createToasts();
