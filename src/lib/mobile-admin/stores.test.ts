import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { ApiError, api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { createReadState } from '$lib/stores/read-state';
import {
	adminUnread,
	role,
	overlay,
	switchRole,
	closeNotifAfterReadAll,
	openAdminNotif,
	adminNotifs,
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
	resetOpsForTests,
	messagesHydrated,
	hydrateMessages,
	resetMessagesForTests,
	opsPages,
	searchCapHint,
	addMember,
	saveMember,
	addCourse,
	saveCourse,
	addCoach,
	saveCoach
} from './stores';
import { MEMBERS, CLASSES, ORDERS, ADMIN_NOTIFS } from './data';
import { MESSAGES } from '$lib/testing/seed-fixtures';
import { COACHES } from '$lib/domain/coaches';
import { buildCreateCourseBody, buildUpdateCourseBody, type ValidCourse } from '$lib/admin/components/course-request';
import {
	getOpsCollections,
	getMessages,
	updateOrderStatus,
	createMember,
	updateMember,
	createCourse,
	updateCourse,
	createCoach,
	updateCoach,
	type OpsCollections
} from './api';

// Task 20：getOpsCollections()/getMessages() 現委派桌面 admin/coach seams 真呼叫
// 後端——這裡的測試關心的是 store 自己的水合守衛/樂觀更新機制(與資料來源無關)，
// 故明確 mock 這三支(而非 importOriginal passthrough)，預設解析回舊測試假設的
// MEMBERS/CLASSES/COACHES/ORDERS/MESSAGES 靜態陣列；個別測試仍可用
// mockResolvedValueOnce/mockRejectedValueOnce 覆寫單次行為(race 測試等)。
// R12 Task 3：ops store 自有寫入動詞(addMember/saveCourse/markOrderPaid…)內部呼叫的
// 寫入端點一併 mock——否則 passthrough 會打到真 api()。
// 真 authStore 的 login/logout 走 $lib/api/client 的 api()——只替換這一支(C6 換帳號測試用)。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

vi.mock('./api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('./api')>();
	return {
		...actual,
		getOpsCollections: vi.fn(async () => opsFixture()),
		getMessages: vi.fn(async () => MESSAGES.map((m) => ({ ...m }))),
		updateOrderStatus: vi.fn(),
		createMember: vi.fn(),
		updateMember: vi.fn(),
		createCourse: vi.fn(),
		updateCourse: vi.fn(),
		createCoach: vi.fn(),
		updateCoach: vi.fn()
	};
});

/** getOpsCollections 的預設回傳(含分頁 meta)。function 宣告會被 hoist,vi.mock 工廠可用。 */
function opsFixture(over: Partial<OpsCollections> = {}): OpsCollections {
	return {
		members: MEMBERS,
		classes: CLASSES,
		coaches: COACHES,
		orders: ORDERS,
		pages: {
			members: { total: MEMBERS.length, perPage: 20 },
			classes: { total: CLASSES.length, perPage: 20 },
			orders: { total: ORDERS.length, perPage: 20 }
		},
		...over
	};
}

// createOverlay 的直接單元測試已搬到 $lib/components/mobile/overlay.test.ts
// (Task 1(1.5)：ADR-0010「死值不留死出口」——mobile-admin/stores.ts 的
// createOverlay 轉出已退役，overlay singleton 本身直接 import 自
// $lib/components/mobile/overlay)。

describe('createReadState (adminNotifs/coachNotifs 的底層 factory)', () => {
	const seed = [
		{ id: 'a', read: false },
		{ id: 'b', read: false },
		{ id: 'c', read: true }
	];
	it('adminUnread 依 `read` 旗標計數(內部委派 unreadCount)', () => {
		const n = createReadState(seed);
		expect(adminUnread(get(n))).toBe(2);
	});
	it('markAllRead clears unread without mutating the seed', () => {
		const n = createReadState(seed);
		n.markAllRead();
		expect(adminUnread(get(n))).toBe(0);
		expect(seed.filter((x) => !x.read)).toHaveLength(2);
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

describe('openAdminNotif (mobile-admin 四頁 dashboard/orders/classes/members 的 bell icon 共用同一顆函式)', () => {
	it('開出 id 為 \'notif\' 的 sheet,props.notifs 帶入 adminNotifs store 的現值', () => {
		openAdminNotif();
		expect(get(overlay).sheet?.id).toBe('notif');
		expect((get(overlay).sheet?.props as { notifs: unknown }).notifs).toEqual(get(adminNotifs));
		overlay.closeAll();
	});

	it('觸發 props.onReadAll → adminNotifs 全部標為已讀且 sheet 關閉(同 closeNotifAfterReadAll 全鏈:markAllRead + 關閉)', () => {
		expect(adminUnread(get(adminNotifs)), 'seed 應含未讀項目,onReadAll 前才有東西可標').toBeGreaterThan(0);
		openAdminNotif();
		const props = get(overlay).sheet?.props as { onReadAll: () => void };
		props.onReadAll();
		expect(adminUnread(get(adminNotifs))).toBe(0);
		expect(get(overlay).sheet).toBe(null);
		adminNotifs.set(ADMIN_NOTIFS); // restore the shared singleton for other tests
	});
});

describe('markOrderPaid', () => {
	// Regression: 標記已付款 used to only toast, leaving the order pending so the
	// orders KPIs (revenue / 待付款 count) and the admin home banner never updated.
	// R12 Task 3:先寫後改——PATCH 成功才經 applyStatusChange(桌面同一支)套回 store,
	// paidAt 用訂單日期(同 mapAdminOrder 讀取規則),不再是「剛剛」。
	it('PATCH 成功 → 該筆翻為 paid、paidAt 為訂單日期,且不重抓(無 refreshOps)', async () => {
		const pending = get(orders).find((o) => o.status === 'pending');
		expect(pending, 'seed should contain a pending order').toBeTruthy();
		const pendingBefore = get(orders).filter((o) => o.status === 'pending').length;
		vi.mocked(updateOrderStatus).mockResolvedValueOnce({ id: pending!.orderId, order_number: pending!.id, status: 'paid' });
		vi.mocked(getOpsCollections).mockClear();

		await markOrderPaid(pending!);

		expect(updateOrderStatus).toHaveBeenCalledWith(pending!.orderId, 'paid');
		const after = get(orders).find((o) => o.id === pending!.id)!;
		expect(after.status).toBe('paid');
		expect(after.paidAt).toBe(pending!.date);
		expect(get(orders).filter((o) => o.status === 'pending')).toHaveLength(pendingBefore - 1);
		expect(get(opsHydrated)).toBe(true); // opsGate.markMutated()
		expect(getOpsCollections).not.toHaveBeenCalled();
		orders.set(ORDERS); // restore the shared singleton for other tests
		resetOpsForTests();
	});

	// R13 Task 5(C4):markOrderPaid 改共用 changeOrderStatus,PATCH 失敗不再 throw
	// ——回傳 illegalTransition(400,已對過後端:非法轉換/並發衝突一律 400),
	// store 與 opsHydrated 皆不動(同舊行為的「不動」語意,只是不再用 throw 表達)。
	it('PATCH 400 → 回傳 illegalTransition,store 與 opsHydrated 皆不動', async () => {
		const pending = ORDERS.find((o) => o.status === 'pending')!;
		vi.mocked(updateOrderStatus).mockRejectedValueOnce(new ApiError(400, 'cannot transition order'));
		resetOpsForTests();

		const outcome = await markOrderPaid(pending);

		expect(outcome).toEqual({ kind: 'illegalTransition' });
		expect(get(orders)).toEqual(ORDERS);
		expect(get(opsHydrated)).toBe(false);
	});

	it('store 以 server 回的 status 為準(不硬寫 paid)', async () => {
		const pending = ORDERS.find((o) => o.status === 'pending')!;
		vi.mocked(updateOrderStatus).mockResolvedValueOnce({ id: pending.orderId, order_number: pending.id, status: 'processing' });

		await markOrderPaid(pending);

		expect(get(orders).find((o) => o.id === pending.id)?.status).toBe('processing');
		orders.set(ORDERS);
		resetOpsForTests();
	});
});

describe('markMessageRead + coachMsgUnread', () => {
	// R14(候選 F3):messages 開機為 `[]`——本段需要有未讀的串列,先灌夾具。
	beforeEach(() => messages.set(MESSAGES.map((m) => ({ ...m }))));
	// Regression: the coach 訊息 badge + row highlight read a static seed, so opening
	// a thread never lowered the unread count — it stayed frozen for the session.
	it('clears a thread unread flag and lowers the derived coach badge count', () => {
		const unread0 = get(coachMsgUnread);
		expect(unread0, 'seed should have unread threads').toBeGreaterThan(0);
		const firstUnread = get(messages).find((m) => m.unread)!;
		markMessageRead(firstUnread.id);
		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false);
		expect(get(coachMsgUnread)).toBe(unread0 - 1);
		resetMessagesForTests(); // markMessageRead now also flips the flag (C1) — reset for other tests
		messages.set(MESSAGES.map((m) => ({ ...m }))); // restore the shared singleton for other tests
	});

	it('reading an already-read thread is a no-op for the count', () => {
		const read = get(messages).find((m) => !m.unread)!;
		const before = get(coachMsgUnread);
		markMessageRead(read.id);
		expect(get(coachMsgUnread)).toBe(before);
		resetMessagesForTests(); // markMessageRead now also flips the flag (C1) — reset for other tests
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
		resetOpsForTests();
	});

	it('hydrateOps() 在 guard 為 true 時短路,不會再次覆寫(保護 overlay mutation)', async () => {
		await hydrateOps();
		expect(get(opsHydrated)).toBe(true);
		classes.set([{ ...CLASSES[0], name: '使用者剛新增的班級' }]);
		await hydrateOps();
		expect(get(classes)).toEqual([{ ...CLASSES[0], name: '使用者剛新增的班級' }]);
		// restore for other tests
		classes.set(CLASSES);
		resetOpsForTests();
	});

	it('refreshOps() 一律重新 fetch,不受 guard 短路(供重試使用)', async () => {
		await hydrateOps();
		expect(get(opsHydrated)).toBe(true);
		orders.set([{ ...ORDERS[0], member: '水合前的假資料' }]);
		await refreshOps();
		expect(get(orders)).toEqual(ORDERS);
		// restore for other tests
		orders.set(ORDERS);
		resetOpsForTests();
	});

	/* R10 關鍵判準守恆釘(ADR-0020 點名;R12 Task 3 改寫成 markOrderPaid(order) 新簽名,
	 * 判準不變)。「寫入 → markMutated → await refreshOps()」是 mobile-admin 的正常序列:
	 * mutation 發生在 refresh **進場之前**,旗標當下雖為 true,快照仍必須套用、且 fetch
	 * 恰一次。若把丟棄條件誤寫成「旗標/mutated 當下值為真」,這條釘會炸成無限重抓或永不套用。
	 * markOrderPaid 現為先寫後改(await PATCH → 套回 → markMutated() 無尾流,ADR-0021),
	 * 所以 refresh 也不會因尾流帳而等待。 */
	it('判準守恆:await markOrderPaid(order) → await refreshOps() → 快照照常套用且 fetch 恰一次(丟棄條件是「進場之後」的 mutation,不是旗標當下值)', async () => {
		resetOpsForTests();
		const pending = ORDERS.find((o) => o.status === 'pending')!;
		vi.mocked(updateOrderStatus).mockResolvedValueOnce({ id: pending.orderId, order_number: pending.id, status: 'paid' });
		await markOrderPaid(pending); // refresh 進場「之前」的 mutation
		expect(get(opsHydrated)).toBe(true); // 旗標當下為 true——誤用旗標當判準即誤丟
		expect(get(orders).find((o) => o.id === pending.id)?.status).toBe('paid');

		vi.mocked(getOpsCollections).mockClear();
		await refreshOps();

		expect(vi.mocked(getOpsCollections)).toHaveBeenCalledTimes(1); // 無在飛 mutation → 零額外重抓
		expect(get(orders)).toEqual(ORDERS); // 顯式新鮮度:server 快照照常套用(該筆回到 pending)
		expect(get(opsHydrated)).toBe(true);

		// restore for other tests
		orders.set(ORDERS);
		resetOpsForTests();
	});

	it('hydrateOps()/refreshOps() 把分頁 meta 寫進 opsPages', async () => {
		const pages = { members: { total: 57, perPage: 20 }, classes: { total: 3, perPage: 20 }, orders: { total: 120, perPage: 20 } };
		vi.mocked(getOpsCollections).mockResolvedValueOnce(opsFixture({ pages }));
		await refreshOps();
		expect(get(opsPages)).toEqual(pages);
		resetOpsForTests();
	});
});

describe('searchCapHint(僅抓第 1 頁時的搜尋範圍提示)', () => {
	it('total > perPage → 提示僅搜尋前 N 筆(N = perPage)', () => {
		expect(searchCapHint({ total: 57, perPage: 20 })).toBe('僅搜尋前 20 筆，完整清單請至桌面後台');
	});
	it('total <= perPage → 無提示', () => {
		expect(searchCapHint({ total: 20, perPage: 20 })).toBeNull();
		expect(searchCapHint({ total: 3, perPage: 20 })).toBeNull();
	});
});

describe('ORDERS builder — 5% 內含稅顯示反推（taxFromGross 站點級 pin）', () => {
	it('ORDERS[0]（amount 4800）→ tax 229 / net 4571', () => {
		expect(ORDERS[0].amount).toBe(4800);
		expect(ORDERS[0].tax).toBe(229);
		expect(ORDERS[0].net).toBe(4571);
		expect(ORDERS[0].net + ORDERS[0].tax).toBe(ORDERS[0].amount);
	});
});

describe('hydrateMessages / messagesHydrated', () => {
	// R14(候選 F3)誠實開機:開機值 = reset 值 = `[]`(本檔其他 it 會 set 夾具,重新載入模組
	// 才照得到開機那一刻)。
	it('messages 開機為 [](誠實開機);messagesHydrated 起始為 false', async () => {
		vi.resetModules();
		const fresh = await import('./stores');
		expect(get(fresh.messages)).toEqual([]);
		expect(get(fresh.messagesHydrated)).toBe(false);
	});

	it('hydrateMessages() 在 guard 為 false 時實際觸發水合(覆寫先前的假資料)', async () => {
		messages.set([{ ...MESSAGES[0], from: '水合前的假資料' }]);
		await hydrateMessages();
		expect(get(messages)).toEqual(MESSAGES);
		expect(get(messagesHydrated)).toBe(true);
		// restore for other tests
		resetMessagesForTests();
		messages.set(MESSAGES.map((m) => ({ ...m })));
	});

	it('hydrateMessages() 在 guard 為 true 時短路,不會覆寫 markMessageRead 的結果', async () => {
		await hydrateMessages();
		expect(get(messagesHydrated)).toBe(true);
		const firstUnread = get(messages).find((m) => m.unread)!;
		markMessageRead(firstUnread.id);
		await hydrateMessages();
		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false);
		// restore for other tests
		resetMessagesForTests();
		messages.set(MESSAGES.map((m) => ({ ...m })));
	});

	it('教練 A 水合 → 換教練 B 登入 → 對話列表重置為 `[]`、旗標翻回 false,B 會重新水合(C6:不再看到 A 的對話)', async () => {
		const user = (id: string, email: string) => ({
			id, email, name: '教練' + id, phone: null, phone_verified: false, avatar_url: null,
			is_active: true, created_at: '2024-01-01T00:00:00Z', roles: ['coach']
		});
		const login = async (u: ReturnType<typeof user>) => {
			vi.mocked(api).mockImplementation(
				fakeRouter({ 'POST /auth/logout': undefined, 'POST /auth/login': { access_token: 'at', refresh_token: 'rt', user: u } })
			);
			await authStore.login(u.email, 'pw');
		};
		await login(user('ua', 'a@dreamfly.test'));
		const A_THREADS = [{ ...MESSAGES[0], id: 'a-thread', from: '教練 A 的學員家長' }];
		vi.mocked(getMessages).mockResolvedValueOnce(A_THREADS);
		await hydrateMessages();
		expect(get(messages)).toEqual(A_THREADS);
		expect(get(messagesHydrated)).toBe(true);

		await login(user('ub', 'b@dreamfly.test'));

		expect(get(messages)).toEqual([]);
		expect(get(messagesHydrated)).toBe(false);
		const calls = vi.mocked(getMessages).mock.calls.length;
		await hydrateMessages();
		expect(vi.mocked(getMessages).mock.calls.length).toBe(calls + 1);
		expect(get(messagesHydrated)).toBe(true);
		// restore for other tests
		await authStore.logout();
		resetMessagesForTests();
		messages.set(MESSAGES.map((m) => ({ ...m })));
	});
});

/** 手動控時序的 deferred promise（抄 hydration-gate.test.ts 開頭寫法，測 in-flight
 *  水合競態不用 fake timers）。 */
function createDeferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

describe('mutator → markMutated 接線(regression:防止未來悄悄拿掉某支 .markMutated() 呼叫仍測試全綠)', () => {
	// hydration-gate.test.ts 已經泛用地測過 factory 本身的競態語意(in-flight 期間
	// markMutated() → apply 不被呼叫);這裡改成從 stores.ts 實際匯出的兩支 mutator
	// 出發,直接斷言「接線」本身還在——如果之後有人手滑拿掉 markOrderPaid／
	// markMessageRead 裡任一個 .markMutated() 呼叫,上面既有的 describe 都不會發現
	// (因為都在水合已完成後才呼叫 mutator),只有這裡的 in-flight 情境會炸。
	// (saveCoach 的本地寫入版本已隨 Round 4 Task F5 coaches/users 兩步真寫入移除——
	// 真寫入成功後改呼叫 refreshOps() 整包重抓,不再是 markMutated 站點。)
	it('markOrderPaid() 在 hydrateOps() in-flight 期間呼叫 → mutation 勝出,水合 resolve 後不覆寫剛標記的付款狀態,opsHydrated 為 true', async () => {
		resetOpsForTests();
		const d = createDeferred<OpsCollections>();
		vi.mocked(getOpsCollections).mockReturnValueOnce(d.promise);

		const hydrating = hydrateOps();
		expect(get(opsHydrated)).toBe(false); // in-flight,尚未水合

		const pending = ORDERS.find((o) => o.status === 'pending')!;
		vi.mocked(updateOrderStatus).mockResolvedValueOnce({ id: pending.orderId, order_number: pending.id, status: 'paid' });
		await markOrderPaid(pending); // R12 Task 3 新簽名:先寫後改,PATCH 落定後才 markMutated
		expect(get(opsHydrated)).toBe(true); // markOrderPaid 已呼叫 opsGate.markMutated()

		d.resolve(opsFixture()); // 模擬水合帶回「該筆仍 pending」的舊資料
		await hydrating;

		expect(get(orders).find((o) => o.id === pending.id)?.status).toBe('paid'); // mutation 保留,沒被水合覆寫
		expect(get(opsHydrated)).toBe(true);

		// restore for other tests
		orders.set(ORDERS);
		resetOpsForTests();
	});

	it('markMessageRead() 在 hydrateMessages() in-flight 期間呼叫 → mutation 勝出,水合 resolve 後訊息維持已讀,messagesHydrated 為 true', async () => {
		resetMessagesForTests();
		messages.set(MESSAGES.map((m) => ({ ...m }))); // reset 還原開機值 [];本段需要有未讀的串列
		const d = createDeferred<typeof MESSAGES>();
		vi.mocked(getMessages).mockReturnValueOnce(d.promise);

		const hydrating = hydrateMessages();
		expect(get(messagesHydrated)).toBe(false); // in-flight,尚未水合

		const firstUnread = get(messages).find((m) => m.unread)!;
		markMessageRead(firstUnread.id);
		expect(get(messagesHydrated)).toBe(true); // markMessageRead 已呼叫 messagesGate.markMutated()

		d.resolve(MESSAGES.map((m) => ({ ...m }))); // 模擬水合帶回「該則仍未讀」的舊資料
		await hydrating;

		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false); // mutation 保留,沒被水合覆寫
		expect(get(messagesHydrated)).toBe(true);

		// restore for other tests
		resetMessagesForTests();
		messages.set(MESSAGES.map((m) => ({ ...m })));
	});
});

/* R12 Task 3:ops store 自有寫入動詞(逐 entity、新增/編輯分兩支,不做通用 CRUD——ADR-0018 C6)。
 * 每支三條:寫入成功 → getOpsCollections 恰一次、store 反映重抓結果;寫入失敗 → 丟出
 * (coach 系列回 outcome)、不重抓;重抓失敗 → 不丟出(console.error)。錯誤/toast 文案留頁面。 */
describe('ops 寫入動詞', () => {
	const REFRESHED_MEMBER = { ...MEMBERS[0], id: 'zz-new', name: '重抓回來的學員' };
	const REFRESHED_CLASS = { ...CLASSES[0], id: 'zz-k', name: '重抓回來的班級' };
	const REFRESHED_COACH = { ...COACHES[0], id: 'zz-c', name: '重抓回來的教練' };
	const refreshedOps = () =>
		opsFixture({ members: [REFRESHED_MEMBER], classes: [REFRESHED_CLASS], coaches: [REFRESHED_COACH] });

	function reset() {
		members.set(MEMBERS);
		classes.set(CLASSES);
		coaches.set(COACHES);
		orders.set(ORDERS);
		resetOpsForTests();
		vi.mocked(getOpsCollections).mockClear();
	}

	/** 寫入成功但重抓失敗:動詞 resolve(不丟出)、console.error 被叫。 */
	async function expectRefreshFailureSwallowed(run: () => Promise<unknown>) {
		reset();
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(getOpsCollections).mockRejectedValueOnce(new Error('refetch boom'));
		await expect(run()).resolves.not.toThrow();
		expect(getOpsCollections).toHaveBeenCalledTimes(1);
		expect(err).toHaveBeenCalled();
		err.mockRestore();
		reset();
	}

	describe('addMember(body)', () => {
		const body = { email: 'a@test.com', name: '新學員', password: 'password123' };
		it('成功 → createMember(body) → 重抓恰一次,members 反映結果', async () => {
			reset();
			vi.mocked(createMember).mockResolvedValueOnce({} as never);
			vi.mocked(getOpsCollections).mockResolvedValueOnce(refreshedOps());
			await addMember(body);
			expect(createMember).toHaveBeenCalledWith(body);
			expect(getOpsCollections).toHaveBeenCalledTimes(1);
			expect(get(members)).toEqual([REFRESHED_MEMBER]);
			reset();
		});
		it('寫入失敗 → 丟出、不重抓', async () => {
			reset();
			vi.mocked(createMember).mockRejectedValueOnce(new Error('Email 已被使用'));
			await expect(addMember(body)).rejects.toThrow('Email 已被使用');
			expect(getOpsCollections).not.toHaveBeenCalled();
		});
		it('重抓失敗 → 不丟出', async () => {
			vi.mocked(createMember).mockResolvedValueOnce({} as never);
			await expectRefreshFailureSwallowed(() => addMember(body));
		});
	});

	describe('saveMember(id, body)', () => {
		const body = { name: '改名學員' };
		it('成功 → updateMember(id, body) → 重抓恰一次,members 反映結果', async () => {
			reset();
			vi.mocked(updateMember).mockResolvedValueOnce({} as never);
			vi.mocked(getOpsCollections).mockResolvedValueOnce(refreshedOps());
			await saveMember('m-1', body);
			expect(updateMember).toHaveBeenCalledWith('m-1', body);
			expect(getOpsCollections).toHaveBeenCalledTimes(1);
			expect(get(members)).toEqual([REFRESHED_MEMBER]);
			reset();
		});
		it('寫入失敗 → 丟出、不重抓', async () => {
			reset();
			vi.mocked(updateMember).mockRejectedValueOnce(new Error('422'));
			await expect(saveMember('m-1', body)).rejects.toThrow('422');
			expect(getOpsCollections).not.toHaveBeenCalled();
		});
		it('重抓失敗 → 不丟出', async () => {
			vi.mocked(updateMember).mockResolvedValueOnce({} as never);
			await expectRefreshFailureSwallowed(() => saveMember('m-1', body));
		});
	});

	// R13 Task 4:課程動詞吃 ClassForm 驗證過的 ValidCourse(coach_id 已在表單端解出)，
	// body 組裝的逐欄規則由 course-request.test.ts 覆蓋，這裡只驗接線與重抓語意。
	const COURSE: ValidCourse = {
		name: '新班級', level: '基礎', category: '兒童基礎', coachId: COACHES[0].id, scheduleText: null,
		minAge: 8, maxAge: null, maxStudents: 12, price: 3200, durationMinutes: 75
	};

	describe('addCourse(course)', () => {
		it('成功 → createCourse(buildCreateCourseBody(course)) → 重抓恰一次,classes 反映結果', async () => {
			reset();
			vi.mocked(createCourse).mockResolvedValueOnce({} as never);
			vi.mocked(getOpsCollections).mockResolvedValueOnce(refreshedOps());
			await addCourse(COURSE);
			expect(createCourse).toHaveBeenCalledWith(buildCreateCourseBody(COURSE));
			expect(getOpsCollections).toHaveBeenCalledTimes(1);
			expect(get(classes)).toEqual([REFRESHED_CLASS]);
			reset();
		});
		it('寫入失敗 → 丟出、不重抓', async () => {
			reset();
			vi.mocked(createCourse).mockRejectedValueOnce(new Error('409'));
			await expect(addCourse(COURSE)).rejects.toThrow('409');
			expect(getOpsCollections).not.toHaveBeenCalled();
		});
		it('重抓失敗 → 不丟出', async () => {
			vi.mocked(createCourse).mockResolvedValueOnce({} as never);
			await expectRefreshFailureSwallowed(() => addCourse(COURSE));
		});
	});

	describe('saveCourse(id, course)', () => {
		it('成功 → updateCourse(id, buildUpdateCourseBody(course)) → 重抓恰一次,classes 反映結果', async () => {
			reset();
			vi.mocked(updateCourse).mockResolvedValueOnce({} as never);
			vi.mocked(getOpsCollections).mockResolvedValueOnce(refreshedOps());
			await saveCourse('k-1', COURSE);
			expect(updateCourse).toHaveBeenCalledWith('k-1', buildUpdateCourseBody(COURSE));
			expect(getOpsCollections).toHaveBeenCalledTimes(1);
			expect(get(classes)).toEqual([REFRESHED_CLASS]);
			reset();
		});
		it('寫入失敗 → 丟出、不重抓', async () => {
			reset();
			vi.mocked(updateCourse).mockRejectedValueOnce(new Error('403'));
			await expect(saveCourse('k-1', COURSE)).rejects.toThrow('403');
			expect(getOpsCollections).not.toHaveBeenCalled();
		});
		it('重抓失敗 → 不丟出', async () => {
			vi.mocked(updateCourse).mockResolvedValueOnce({} as never);
			await expectRefreshFailureSwallowed(() => saveCourse('k-1', COURSE));
		});
	});

	describe('addCoach(values)', () => {
		const V = { name: '新教練', email: 'c@test.com', password: 'password123', title: '主教練', tags: ['體操'], isActive: true };
		it('成功 → createMember → createCoach(user_id) → 回 created、重抓恰一次,coaches 反映結果', async () => {
			reset();
			vi.mocked(createMember).mockResolvedValueOnce({ id: 'u-new' } as never);
			vi.mocked(createCoach).mockResolvedValueOnce({} as never);
			vi.mocked(getOpsCollections).mockResolvedValueOnce(refreshedOps());
			const outcome = await addCoach(V);
			expect(outcome).toEqual({ kind: 'created' });
			expect(createCoach).toHaveBeenCalledWith({ user_id: 'u-new', title: V.title, specialties: V.tags, is_active: V.isActive });
			expect(getOpsCollections).toHaveBeenCalledTimes(1);
			expect(get(coaches)).toEqual([REFRESHED_COACH]);
			reset();
		});
		it('寫入失敗 → 原樣回失敗 outcome(不丟出)、不重抓', async () => {
			reset();
			const error = new Error('bind');
			vi.mocked(createMember).mockResolvedValueOnce({ id: 'u-x' } as never);
			vi.mocked(createCoach).mockRejectedValueOnce(error);
			const outcome = await addCoach(V);
			expect(outcome).toEqual({ kind: 'coachBindFailed', pendingUserId: 'u-x', error });
			expect(getOpsCollections).not.toHaveBeenCalled();
		});
		it('重抓失敗 → 不丟出,仍回 created', async () => {
			vi.mocked(createMember).mockResolvedValueOnce({ id: 'u-new' } as never);
			vi.mocked(createCoach).mockResolvedValueOnce({} as never);
			await expectRefreshFailureSwallowed(async () => expect(await addCoach(V)).toEqual({ kind: 'created' }));
		});
	});

	describe('saveCoach(values, target)', () => {
		const target = COACHES[0];
		const V = { name: target.name, email: '', password: '', title: '改職稱', tags: target.tags, isActive: target.isActive };
		it('成功 → updateCoach(target.id, …) → 回 saved、重抓恰一次,coaches 反映結果', async () => {
			reset();
			vi.mocked(updateCoach).mockResolvedValueOnce({} as never);
			vi.mocked(getOpsCollections).mockResolvedValueOnce(refreshedOps());
			const outcome = await saveCoach(V, target);
			expect(outcome).toEqual({ kind: 'saved' });
			expect(updateCoach).toHaveBeenCalledWith(target.id, { title: '改職稱', specialties: target.tags, is_active: target.isActive });
			expect(getOpsCollections).toHaveBeenCalledTimes(1);
			expect(get(coaches)).toEqual([REFRESHED_COACH]);
			reset();
		});
		it('寫入失敗 → 原樣回失敗 outcome(不丟出)、不重抓', async () => {
			reset();
			const error = new Error('422');
			vi.mocked(updateCoach).mockRejectedValueOnce(error);
			const outcome = await saveCoach(V, target);
			expect(outcome).toEqual({ kind: 'coachUpdateFailed', error });
			expect(getOpsCollections).not.toHaveBeenCalled();
		});
		it('重抓失敗 → 不丟出,仍回 saved', async () => {
			vi.mocked(updateCoach).mockResolvedValueOnce({} as never);
			await expectRefreshFailureSwallowed(async () => expect(await saveCoach(V, target)).toEqual({ kind: 'saved' }));
		});
	});
});
