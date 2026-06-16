/* Dream Fly — 行動版會員 App · cross-route client state.
 *
 * The prototype (app.jsx) kept tab / stack / sheet / cart / points / notifs /
 * toasts / prefs / profile in one React component. Rendered as real routes, the
 * bottom tabs are URLs but push-screens + sheets are overlay state, and the
 * cart / points / notifs / toasts / prefs / profile are shared stores that live
 * here. Factories are exported (isolated test instances, mirroring the admin /
 * coach `createToasts` convention); the app uses the singletons below.
 * Mock-only, no backend. */

import { writable, derived } from 'svelte/store';
import { ME, NOTIFS_SEED, type NotifItem } from './data';

/* ---------- Overlay (push-screen stack + one bottom sheet) ---------- */
export interface OverlayEntry {
	id: string;
	props: Record<string, unknown>;
}
export interface OverlayState {
	stack: OverlayEntry[];
	sheet: OverlayEntry | null;
}

/** push() / pop() drive the slide-in screen stack; sheet() / closeSheet() drive
 *  the single bottom sheet; closeAll() resets both (called on every tab change so
 *  an open overlay never survives navigation). */
export function createOverlay() {
	const { subscribe, update, set } = writable<OverlayState>({ stack: [], sheet: null });
	return {
		subscribe,
		push(id: string, props: Record<string, unknown> = {}) {
			update((o) => ({ ...o, stack: [...o.stack, { id, props }] }));
		},
		pop() {
			update((o) => ({ ...o, stack: o.stack.slice(0, -1) }));
		},
		sheet(id: string, props: Record<string, unknown> = {}) {
			update((o) => ({ ...o, sheet: { id, props } }));
		},
		closeSheet() {
			update((o) => ({ ...o, sheet: null }));
		},
		closeAll() {
			set({ stack: [], sheet: null });
		}
	};
}
export const overlay = createOverlay();

/* ---------- Shopping cart (報名購物車) ---------- */
/** A catalog course as added to the cart — core fields are typed; the index
 *  signature carries the rest of the course verbatim (icon / level / desc …)
 *  for the cart sheet. Kept as its own interface (not `Omit<CartLine>`) because
 *  an index signature collapses `keyof`, which would break Omit. */
export interface CartInput {
	id: string | number;
	name: string;
	price: number;
	spots: number;
	[k: string]: unknown;
}
export interface CartLine extends CartInput {
	qty: number;
}
/** add() increments an existing line or appends qty 1; updateQty() clamps to a
 *  minimum of 1 (ui.jsx checkout never allows 0). */
export function createCart() {
	const { subscribe, update, set } = writable<CartLine[]>([]);
	return {
		subscribe,
		add(course: CartInput) {
			update((items) => {
				const ex = items.find((c) => c.id === course.id);
				if (ex) return items.map((c) => (c.id === course.id ? { ...c, qty: c.qty + 1 } : c));
				const line: CartLine = { ...course, qty: 1 };
				return [...items, line];
			});
		},
		remove(id: string | number) {
			update((items) => items.filter((c) => c.id !== id));
		},
		updateQty(id: string | number, delta: number) {
			update((items) => items.map((c) => (c.id === id ? { ...c, qty: Math.max(1, c.qty + delta) } : c)));
		},
		clear() {
			set([]);
		}
	};
}
export const cart = createCart();

/** Total item count across cart lines. */
export function cartCount(items: { qty: number }[]): number {
	return items.reduce((s, c) => s + c.qty, 0);
}
export const cartTotal = derived(cart, ($c) => cartCount($c));

/* ---------- Member points (點數) ---------- */
export const points = writable(ME.points);
/** Checkout maths (app.jsx checkoutDone): spend redeemed, earn completion points. */
export function applyCheckout(pts: number, redeem: number, earned: number): number {
	return pts - redeem + earned;
}
/** Apply a finished checkout to the live stores: adjust points, empty the cart. */
export function checkout(redeem: number, earned: number) {
	points.update((p) => applyCheckout(p, redeem, earned));
	cart.clear();
}
/** Redeem a reward by spending its point cost. PointsScreen disables the 兌換
 *  button unless the balance covers the cost (`can`), so this simply debits the
 *  points — mirroring checkout's points-only model (the mobile surface keeps no
 *  live ledger). Without it the balance never moves and a reward could be
 *  redeemed indefinitely. */
export function redeemReward(cost: number) {
	points.update((p) => p - cost);
}

/* ---------- Notification centre ---------- */
/** read-flag store; markRead flips one, markAllRead clears all. Immutable update
 *  so the seed array is never mutated. */
export function createNotifs<T extends { id: string; read: boolean }>(seed: T[]) {
	const { subscribe, update } = writable<T[]>(seed.map((n) => ({ ...n })));
	return {
		subscribe,
		markRead(id: string) {
			update((ns) => ns.map((n) => (n.id === id ? { ...n, read: true } : n)));
		},
		markAllRead() {
			update((ns) => ns.map((n) => ({ ...n, read: true })));
		}
	};
}
export function unreadCount(items: { read: boolean }[]): number {
	return items.filter((n) => !n.read).length;
}
export const notifs = createNotifs<NotifItem>(NOTIFS_SEED);
export const unread = derived(notifs, ($n) => unreadCount($n));

/* ---------- Toasts (above the tab bar, 2800ms — app.jsx) ---------- */
export type ToastTone = 'success' | 'info' | 'warning' | 'error' | 'accent';
export interface MobileToast {
	id: number;
	tone: ToastTone;
	title: string;
	body: string;
}
export function createToasts() {
	const { subscribe, update } = writable<MobileToast[]>([]);
	let seq = 1;
	return {
		subscribe,
		notify(tone: ToastTone, title: string, body = ''): number {
			const id = seq++;
			update((t) => [...t, { id, tone, title, body }]);
			setTimeout(() => update((t) => t.filter((x) => x.id !== id)), 2800);
			return id;
		},
		dismiss(id: number) {
			update((t) => t.filter((x) => x.id !== id));
		}
	};
}
export const toasts = createToasts();

/* ---------- Preferences + profile (帳戶 / 設定) ---------- */
export interface Prefs {
	classReminder: boolean;
	coachMsg: boolean;
	promo: boolean;
	dark: boolean;
}
export const prefs = writable<Prefs>({ classReminder: true, coachMsg: true, promo: false, dark: false });

export const profile = writable({
	...ME,
	birth: '2013/05/18',
	phone: '0912-345-678',
	email: 'wang.family@example.com',
	guardian: '王先生 · 0911-222-333'
});

/* ---------- Demo auth session (gate flag only; layout owns localStorage) ---------- */
export const session = writable(false);
