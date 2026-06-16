import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createOverlay, createAdminNotifs, upsertById, nextId, adminUnread, role, overlay, switchRole, closeNotifAfterReadAll, orders, markOrderPaid, messages, markMessageRead, coachMsgUnread } from './stores';

describe('createOverlay (admin)', () => {
	it('pushes / pops the stack and opens / closes a sheet', () => {
		const o = createOverlay();
		o.push('coaches');
		o.sheet('member', { m: { id: 'GY1' } });
		expect(get(o).stack[0]).toEqual({ id: 'coaches', props: {} });
		expect(get(o).sheet).toEqual({ id: 'member', props: { m: { id: 'GY1' } } });
		o.closeAll();
		expect(get(o).stack).toHaveLength(0);
		expect(get(o).sheet).toBe(null);
	});
});

describe('createAdminNotifs', () => {
	const seed = [
		{ id: 'a', unread: true },
		{ id: 'b', unread: true },
		{ id: 'c', unread: false }
	];
	it('counts unread on the `unread` flag', () => {
		const n = createAdminNotifs(seed);
		expect(adminUnread(get(n))).toBe(2);
	});
	it('markAllRead clears unread without mutating the seed', () => {
		const n = createAdminNotifs(seed);
		n.markAllRead();
		expect(adminUnread(get(n))).toBe(0);
		expect(seed.filter((x) => x.unread)).toHaveLength(2);
	});
});

describe('upsertById', () => {
	it('replaces an existing record in place by id', () => {
		const list = [{ id: '1', v: 'a' }, { id: '2', v: 'b' }];
		expect(upsertById(list, { id: '2', v: 'B' })).toEqual([{ id: '1', v: 'a' }, { id: '2', v: 'B' }]);
	});
	it('prepends a brand-new record', () => {
		const list = [{ id: '1', v: 'a' }];
		expect(upsertById(list, { id: '9', v: 'z' })).toEqual([{ id: '9', v: 'z' }, { id: '1', v: 'a' }]);
	});
});

describe('nextId', () => {
	it('builds the next id from a prefix + (count + 1)', () => {
		expect(nextId('k', [{}, {}])).toBe('k3');
		expect(nextId('c', [{}])).toBe('c2');
	});
	it('zero-pads to a fixed width when asked (member ids)', () => {
		expect(nextId('GY2026', [{}, {}], 3)).toBe('GY2026003');
	});
});

describe('switchRole', () => {
	it('updates the role store AND persists df_madmin_role (survives reload)', () => {
		switchRole('coach');
		expect(get(role)).toBe('coach');
		expect(localStorage.getItem('df_madmin_role')).toBe('coach');
		switchRole('admin'); // restore the shared singleton for other tests
		expect(localStorage.getItem('df_madmin_role')).toBe('admin');
	});
});

describe('closeNotifAfterReadAll', () => {
	it('marks all read then closes the open bell sheet (snapshot would otherwise stay stale)', () => {
		overlay.sheet('notif', {});
		expect(get(overlay).sheet).not.toBe(null);
		let marked = false;
		closeNotifAfterReadAll(() => {
			marked = true;
		});
		expect(marked).toBe(true);
		expect(get(overlay).sheet).toBe(null);
		overlay.closeAll();
	});
});

describe('markOrderPaid', () => {
	// Regression: 標記已付款 used to only toast, leaving the order pending so the
	// orders KPIs (revenue / 待付款 count) and the admin home banner never updated.
	it('flips a pending order to paid and stamps the receipt time', () => {
		const pending = get(orders).find((o) => o.status === 'pending');
		expect(pending, 'seed should contain a pending order').toBeTruthy();
		const pendingBefore = get(orders).filter((o) => o.status === 'pending').length;
		markOrderPaid(pending!.id);
		const after = get(orders).find((o) => o.id === pending!.id)!;
		expect(after.status).toBe('paid');
		expect(after.paidAt).toBe('剛剛');
		expect(get(orders).filter((o) => o.status === 'pending')).toHaveLength(pendingBefore - 1);
	});
});

describe('markMessageRead + coachMsgUnread', () => {
	// Regression: the coach 訊息 badge + row highlight read a static seed, so opening
	// a thread never lowered the unread count — it stayed frozen for the session.
	it('clears a thread unread flag and lowers the derived coach badge count', () => {
		const unread0 = get(coachMsgUnread);
		expect(unread0, 'seed should have unread threads').toBeGreaterThan(0);
		const firstUnread = get(messages).find((m) => m.unread)!;
		markMessageRead(firstUnread.id);
		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false);
		expect(get(coachMsgUnread)).toBe(unread0 - 1);
	});
	it('reading an already-read thread is a no-op for the count', () => {
		const read = get(messages).find((m) => !m.unread)!;
		const before = get(coachMsgUnread);
		markMessageRead(read.id);
		expect(get(coachMsgUnread)).toBe(before);
	});
});
