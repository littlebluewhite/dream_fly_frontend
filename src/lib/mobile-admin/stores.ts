/* Dream Fly — 行動版後台 · cross-route client state.
 *
 * The prototype (app.jsx) kept role / tab / stack / sheet / toasts / live
 * members·classes·coaches / notifs in one React component. Rendered as real
 * routes, role + tab are URLs but push-screens + sheets are overlay state; the
 * live collections, notifs and toasts are shared stores here. Factories are
 * exported for isolated test instances; the app uses the singletons.
 * Self-contained (does NOT re-export from the desktop admin). Mock-only. */

import { writable, derived } from 'svelte/store';
import type { Role } from './nav';
import { MEMBERS, CLASSES, COACHES, ORDERS, MESSAGES, ADMIN_NOTIFS, COACH_NOTIFS, type MemberRow, type ClassRow, type Coach, type OrderRow, type MessageRow, type AdminNotif } from './data';

/* ---------- Overlay (push-screen stack + one bottom sheet) ---------- */
export interface OverlayEntry {
	id: string;
	props: Record<string, unknown>;
}
export interface OverlayState {
	stack: OverlayEntry[];
	sheet: OverlayEntry | null;
}
/** Mirror of the member-app overlay machine (kept per-surface, not shared). */
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

/* ---------- Notifications (mobile bell — `unread` flag) ---------- */
/** Admin / coach bell notifications mark all-read in one action (ui.jsx NotifSheet
 *  onReadAll). Immutable update keeps the seed array intact. */
export function createAdminNotifs<T extends { id?: string; unread: boolean }>(seed: T[]) {
	const { subscribe, update } = writable<T[]>(seed.map((n) => ({ ...n })));
	return {
		subscribe,
		markAllRead() {
			update((ns) => ns.map((n) => ({ ...n, unread: false })));
		}
	};
}
export function adminUnread(items: { unread: boolean }[]): number {
	return items.filter((n) => n.unread).length;
}
export const adminNotifs = createAdminNotifs<AdminNotif>(ADMIN_NOTIFS);
export const coachNotifs = createAdminNotifs<AdminNotif>(COACH_NOTIFS);

/* ---------- Live collections (新增 / 編輯 表單寫回) ---------- */
/** Replace a record by id, or prepend it when the id is new (app.jsx save*). */
export function upsertById<T extends { id: string | number }>(list: T[], rec: T): T[] {
	return list.some((x) => x.id === rec.id) ? list.map((x) => (x.id === rec.id ? rec : x)) : [rec, ...list];
}
/** Next sequential id: `${prefix}${count + 1}`, optionally zero-padded to `pad`. */
export function nextId(prefix: string, list: unknown[], pad = 0): string {
	const n = String(list.length + 1);
	return prefix + (pad ? n.padStart(pad, '0') : n);
}

export const members = writable<MemberRow[]>(MEMBERS);
export const classes = writable<ClassRow[]>(CLASSES);
export const coaches = writable<Coach[]>(COACHES);

/** Create (id assigned) or update a member / class / coach record in place. */
export function saveMember(rec: MemberRow, isNew: boolean) {
	members.update((ms) => (isNew ? [{ ...rec, id: nextId('GY2026', ms, 3) }, ...ms] : upsertById(ms, rec)));
}
export function saveClass(rec: ClassRow, isNew: boolean) {
	classes.update((cs) => (isNew ? [{ ...rec, id: nextId('k', cs) }, ...cs] : upsertById(cs, rec)));
}
export function saveCoach(rec: Coach, isNew: boolean) {
	coaches.update((cs) => (isNew ? [{ ...rec, id: nextId('c', cs) }, ...cs] : upsertById(cs, rec)));
}

/** Live orders, so 標記已付款 actually persists. The orders screen KPIs (本月已收
 *  revenue, 待付款 count) and the admin home 待付款 banner all derive from this
 *  store — keep it the single source of truth for order status. */
export const orders = writable<OrderRow[]>(ORDERS);
/** Flip a pending order to paid and stamp the receipt time, so revenue / counts /
 *  filter chips recompute. Without this the action only toasts and the row stays
 *  pending. The detail sheet closes on action, so only the list needs to react. */
export function markOrderPaid(id: string) {
	orders.update((os) => os.map((o) => (o.id === id ? { ...o, status: 'paid', paidAt: '剛剛' } : o)));
}

/** Live parent-message threads. The coach 訊息 badge + row highlight derive from
 *  this store, so reading a thread updates both — the static seed only ever showed
 *  the original unread count for the whole session. */
export const messages = writable<MessageRow[]>(MESSAGES.map((m) => ({ ...m })));
/** Mark a thread read (the coach opened it). */
export function markMessageRead(id: string) {
	messages.update((ms) => ms.map((m) => (m.id === id ? { ...m, unread: false } : m)));
}
export const coachMsgUnread = derived(messages, ($m) => $m.filter((x) => x.unread).length);

/* ---------- Role + demo auth session ---------- */
export const role = writable<Role>('admin');
export const session = writable(false);

/* ---------- Toasts (above the tab bar, 2800ms — app.jsx) ---------- */
export type ToastTone = 'success' | 'info' | 'warning' | 'error' | 'accent';
export interface AdminToast {
	id: number;
	tone: ToastTone;
	title: string;
	body: string;
}
export function createToasts() {
	const { subscribe, update } = writable<AdminToast[]>([]);
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

/* ---------- Convenience derived counts ---------- */
export const adminUnreadCount = derived(adminNotifs, ($n) => adminUnread($n));
export const coachUnreadCount = derived(coachNotifs, ($n) => adminUnread($n));

/** Switch role AND persist it, so a reload / return to `/mobile-admin` restores
 *  the chosen role (the layout + index page read `df_madmin_role`). Guarded on
 *  `localStorage` so it stays SSR-safe and remains unit-testable. */
export function switchRole(r: Role) {
	role.set(r);
	if (typeof localStorage !== 'undefined') localStorage.setItem('df_madmin_role', r);
}

/** Mark every bell notification read, toast, then close the sheet. The open
 *  NotifSheet renders a snapshot of the notifs array captured when it opened, so
 *  it must close to reflect the change — mirrors the prototype's onReadAll. */
export function closeNotifAfterReadAll(markAllRead: () => void) {
	markAllRead();
	toasts.notify('success', '已全部標為已讀', '');
	overlay.closeSheet();
}
