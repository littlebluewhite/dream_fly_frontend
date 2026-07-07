import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import {
	createOverlay,
	createAdminNotifs,
	upsertById,
	nextId,
	adminUnread,
	role,
	overlay,
	switchRole,
	closeNotifAfterReadAll,
	orders,
	markOrderPaid,
	messages,
	markMessageRead,
	coachMsgUnread,
	members,
	classes,
	coaches,
	opsHydrated,
	hydrateOps,
	refreshOps,
	saveMember,
	saveClass,
	messagesHydrated,
	hydrateMessages,
	refreshMessages
} from './stores';
import { MEMBERS, CLASSES, COACHES, ORDERS, MESSAGES } from './data';
import { getOpsCollections, getMessages, markRead, type OpsCollections } from './api';

// Task 20：getOpsCollections()/getMessages() 現委派桌面 admin/coach seams 真呼叫
// 後端——這裡的測試關心的是 store 自己的水合守衛/樂觀更新機制(與資料來源無關)，
// 故明確 mock 這三支(而非 importOriginal passthrough)，預設解析回舊測試假設的
// MEMBERS/CLASSES/COACHES/ORDERS/MESSAGES 靜態陣列；個別測試仍可用
// mockResolvedValueOnce/mockRejectedValueOnce 覆寫單次行為(race 測試等)。
vi.mock('./api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./api')>();
	return {
		...actual,
		getOpsCollections: vi.fn(async () => ({ members: MEMBERS, classes: CLASSES, coaches: COACHES, orders: ORDERS })),
		getMessages: vi.fn(async () => MESSAGES.map((m) => ({ ...m }))),
		markRead: vi.fn(async () => ({ updated: 0 }))
	};
});

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
	it('updates the role store (Task 20: no longer persists df_madmin_role — that demo flag is gone)', () => {
		switchRole('coach');
		expect(get(role)).toBe('coach');
		expect(localStorage.getItem('df_madmin_role')).toBeNull();
		switchRole('admin'); // restore the shared singleton for other tests
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
		orders.set(ORDERS); // restore the shared singleton for other tests
		opsHydrated.set(false); // markOrderPaid now also flips this (C1) — reset for other tests
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
		messages.set(MESSAGES.map((m) => ({ ...m }))); // restore the shared singleton for other tests
		messagesHydrated.set(false); // markMessageRead now also flips this (C1) — reset for other tests
	});

	// Task 20：markMessageRead 除本地樂觀更新外，也 best-effort 打真
	// PATCH /conversations/{id}/read(markRead)——這裡驗證真的有呼叫到，而失敗
	// 不影響本地已讀狀態(fire-and-forget，見 stores.ts 附註)。
	it('best-effort 呼叫真 markRead(id)；該呼叫失敗也不影響本地已讀狀態', async () => {
		vi.mocked(markRead).mockReset();
		vi.mocked(markRead).mockRejectedValueOnce(new Error('network'));
		const firstUnread = get(messages).find((m) => m.unread)!;

		markMessageRead(firstUnread.id);

		expect(markRead).toHaveBeenCalledWith(firstUnread.id);
		await new Promise((r) => setTimeout(r, 0)); // let the rejected promise's .catch flush
		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false);
		messages.set(MESSAGES.map((m) => ({ ...m }))); // restore the shared singleton for other tests
		messagesHydrated.set(false);
		vi.mocked(markRead).mockReset();
		vi.mocked(markRead).mockResolvedValue({ updated: 0 });
	});
	it('reading an already-read thread is a no-op for the count', () => {
		const read = get(messages).find((m) => !m.unread)!;
		const before = get(coachMsgUnread);
		markMessageRead(read.id);
		expect(get(coachMsgUnread)).toBe(before);
		messagesHydrated.set(false); // markMessageRead now also flips this (C1) — reset for other tests
	});
});

describe('hydrateOps / refreshOps / opsHydrated', () => {
	it('members/classes/coaches/orders keep the synchronous seed at module load (no empty-array flash)', () => {
		// 對齊 mobile notifs 前例:空起始會造成跨頁讀值的行為回歸,集合 store 一律
		// 同步 seed,水合只是之後再覆寫一次(clone)。
		expect(get(members)).toEqual(MEMBERS);
		expect(get(classes)).toEqual(CLASSES);
		expect(get(coaches)).toEqual(COACHES);
		expect(get(orders)).toEqual(ORDERS);
		expect(get(opsHydrated)).toBe(false);
	});

	it('hydrateOps() 在 guard 為 false 時實際觸發水合(覆寫先前的假資料)', async () => {
		members.set([{ ...MEMBERS[0], name: '水合前的假資料' }]);
		await hydrateOps();
		expect(get(members)).toEqual(MEMBERS);
		expect(get(opsHydrated)).toBe(true);
		// restore for other tests
		members.set(MEMBERS);
		opsHydrated.set(false);
	});

	it('hydrateOps() 在 guard 為 true 時短路,不會再次覆寫(保護 overlay mutation)', async () => {
		await hydrateOps();
		expect(get(opsHydrated)).toBe(true);
		classes.set([{ ...CLASSES[0], name: '使用者剛新增的班級' }]);
		await hydrateOps();
		expect(get(classes)).toEqual([{ ...CLASSES[0], name: '使用者剛新增的班級' }]);
		// restore for other tests
		classes.set(CLASSES);
		opsHydrated.set(false);
	});

	it('refreshOps() 一律重新 fetch,不受 guard 短路(供重試使用)', async () => {
		await hydrateOps();
		expect(get(opsHydrated)).toBe(true);
		orders.set([{ ...ORDERS[0], member: '水合前的假資料' }]);
		await refreshOps();
		expect(get(orders)).toEqual(ORDERS);
		// restore for other tests
		orders.set(ORDERS);
		opsHydrated.set(false);
	});

	it('mutation 存活:hydrate 後的 overlay 新增/編輯,第二次進頁(guard 已 true)不被清掉', async () => {
		await hydrateOps();
		const before = get(classes).length;
		saveClass({ ...CLASSES[0], id: '', name: '新班級(使用者剛新增)' }, true);
		expect(get(classes).length).toBe(before + 1);
		// 模擬「第二次進頁」再次觸發 hydrateOps(guard 已是 true)。
		await hydrateOps();
		expect(get(classes).some((c) => c.name === '新班級(使用者剛新增)')).toBe(true);
		// restore for other tests
		classes.set(CLASSES);
		opsHydrated.set(false);
	});

	// Regression(C1):admin 首頁快速操作「新增學員」在使用者第一次造訪 classes/
	// members/orders 任一頁之前就寫入 members store。反轉 :186 既有測試的順序 ——
	// mutation 先發生、hydrateOps() 才第一次觸發 —— 修法前 refreshOps() 會用 seed
	// clone 無條件覆寫四個 store,讓新學員無聲消失。
	it('mutate-before-first-hydrate:首次 hydrateOps() 前的 saveMember 不被覆寫', async () => {
		opsHydrated.set(false);
		members.set(MEMBERS);
		saveMember({ ...MEMBERS[0], id: '', name: '水合前新增的學員(regression)' }, true);
		expect(get(members).length).toBe(MEMBERS.length + 1);
		await hydrateOps();
		expect(get(members).length).toBe(MEMBERS.length + 1);
		expect(get(members).some((m) => m.name === '水合前新增的學員(regression)')).toBe(true);
		// restore for other tests
		members.set(MEMBERS);
		opsHydrated.set(false);
	});

	// Regression(C1 in-flight 邊窗):hydrateOps() 的 fetch 尚未 resolve 時發生的
	// mutation,resolve 後不該被覆寫。用可控 deferred promise 模擬「fetch 掛著、
	// mutation 先到」的race。
	it('in-flight:hydrateOps() fetch 尚未 resolve 時發生的 saveClass,resolve 後不被覆寫', async () => {
		opsHydrated.set(false);
		classes.set(CLASSES);
		let resolveFetch!: (v: OpsCollections) => void;
		vi.mocked(getOpsCollections).mockReturnValueOnce(
			new Promise((resolve) => {
				resolveFetch = resolve;
			})
		);
		const pending = hydrateOps();
		saveClass({ ...CLASSES[0], id: '', name: '水合進行中新增的班級(in-flight)' }, true);
		resolveFetch({
			members: MEMBERS.map((m) => ({ ...m })),
			classes: CLASSES.map((c) => ({ ...c })),
			coaches: COACHES.map((c) => ({ ...c })),
			orders: ORDERS.map((o) => ({ ...o }))
		});
		await pending;
		expect(get(classes).some((c) => c.name === '水合進行中新增的班級(in-flight)')).toBe(true);
		// restore for other tests
		classes.set(CLASSES);
		opsHydrated.set(false);
	});
});

describe('hydrateMessages / refreshMessages / messagesHydrated', () => {
	it('messages 保留同步 seed(不因獨立水合而清空);messagesHydrated 起始為 false', () => {
		expect(get(messages)).toEqual(MESSAGES);
		expect(get(messagesHydrated)).toBe(false);
	});

	it('hydrateMessages() 在 guard 為 false 時實際觸發水合(覆寫先前的假資料)', async () => {
		messages.set([{ ...MESSAGES[0], from: '水合前的假資料' }]);
		await hydrateMessages();
		expect(get(messages)).toEqual(MESSAGES);
		expect(get(messagesHydrated)).toBe(true);
		// restore for other tests
		messages.set(MESSAGES.map((m) => ({ ...m })));
		messagesHydrated.set(false);
	});

	it('hydrateMessages() 在 guard 為 true 時短路,不會覆寫 markMessageRead 的結果', async () => {
		await hydrateMessages();
		expect(get(messagesHydrated)).toBe(true);
		const firstUnread = get(messages).find((m) => m.unread)!;
		markMessageRead(firstUnread.id);
		await hydrateMessages();
		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false);
		// restore for other tests
		messages.set(MESSAGES.map((m) => ({ ...m })));
		messagesHydrated.set(false);
	});

	it('refreshMessages() 一律重新 fetch,不受 guard 短路(供重試使用)', async () => {
		await hydrateMessages();
		expect(get(messagesHydrated)).toBe(true);
		messages.set([{ ...MESSAGES[0], from: '水合前的假資料' }]);
		await refreshMessages();
		expect(get(messages)).toEqual(MESSAGES);
		// restore for other tests
		messages.set(MESSAGES.map((m) => ({ ...m })));
		messagesHydrated.set(false);
	});
});
