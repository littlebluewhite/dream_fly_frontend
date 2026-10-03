import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { resetSessionStores } from '$lib/testing/session-reset';
import { createReadState } from '$lib/stores/read-state';
import {
	adminUnread,
	overlay,
	closeNotifAfterReadAll,
	openAdminNotif,
	openCoachNotif,
	coachNotifs,
	coachUnreadCount,
	adminNotifs,
	orders,
	messages,
	markMessageRead,
	coachMsgUnread,
	members,
	classes,
	coaches,
	hydrateOps,
	refreshOps,
	resetOpsForTests,
	hydrateMessages,
	opsPages,
	searchCapHint,
	addMember,
	saveMember,
	addCourse,
	saveCourse,
	addCoach,
	saveCoach
} from './stores';
import { ADMIN_NOTIFS } from './data';
import { MESSAGES, COACHES } from '$lib/testing/seed-fixtures';
import { buildCreateCourseBody, buildUpdateCourseBody, type ValidCourse } from '$lib/admin/components/course-request';
import { OPS_ROUTES } from '$lib/testing/ops-routes';
import { apiBody, apiCalls } from '$lib/testing/admin-routes';
import { conversationSummary, courseResponse, coachResponse, userResponse } from '$lib/testing/wire-fixtures';

// HTTP seam(W-8，同 admin 頁測試):只換 $lib/api/client 的 api()，./api 與 $lib/admin/api
// 的真 getter/寫入函式照跑真 mapper。store 自己的水合守衛/樂觀更新/重抓機制透過 fakeRouter
// 交代的端點觀察；真 authStore 的 login/logout 也走這支 api()(C6 換帳號測試用)。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** getMessages() 背後的 GET /conversations/me:由 MESSAGES 的 id/from/preview/unread 組出，
 *  水合後的 messages 與 seed 在這四欄一致(色票/時間由 mapper 決定，不在比對範圍)。 */
const CONVERSATIONS = (unreadOf: (id: string) => boolean = (id) => MESSAGES.find((m) => m.id === id)!.unread) =>
	MESSAGES.map((m) =>
		conversationSummary({ id: m.id, peer_name: m.from, last_message_body: m.preview, unread_count: unreadOf(m.id) ? 1 : 0 })
	);
const msgView = (rows: { id: string; from: string; preview: string; unread: boolean }[]) =>
	rows.map(({ id, from, preview, unread }) => ({ id, from, preview, unread }));

const ROUTES: Record<string, unknown> = { ...OPS_ROUTES, 'GET /conversations/me': () => CONVERSATIONS() };
const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter(overrides, ROUTES));
const names = (rows: { name: string }[]) => rows.map((r) => r.name);
/** getOpsCollections() 每次恰打一次 GET /users?page=1——以它計「重抓次數」。 */
const opsFetches = () => apiCalls('GET /users?page=1').length;
/** OPS_ROUTES 水合後各集合的名字(對照 ops-routes.ts 的 wire fixture)。 */
const OPS_MEMBER_NAMES = ['王小明', '陳小華'];
const OPS_ORDER_MEMBERS = ['王小明'];

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

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

describe('openCoachNotif (教練四頁的 bell icon 共用)', () => {
	it("開出 'notif' sheet,props.notifs 帶入 coachNotifs 現值", () => {
		openCoachNotif();
		expect(get(overlay).sheet?.id).toBe('notif');
		expect((get(overlay).sheet?.props as { notifs: unknown }).notifs).toEqual(get(coachNotifs));
		overlay.closeAll();
	});

	it('props.onReadAll → coachNotifs 全部標為已讀且 sheet 關閉', () => {
		const before = get(coachNotifs);
		expect(get(coachUnreadCount), 'seed 應含未讀').toBeGreaterThan(0);
		openCoachNotif();
		(get(overlay).sheet?.props as { onReadAll: () => void }).onReadAll();
		expect(get(coachUnreadCount)).toBe(0);
		expect(get(overlay).sheet).toBe(null);
		coachNotifs.set(before); // restore the shared singleton for other tests
	});
});

describe('markMessageRead + coachMsgUnread', () => {
	// R14(候選 F3):messages 開機為 `[]`——本段需要有未讀的串列,先灌夾具。
	beforeEach(async () => {
		await resetSessionStores(); // 訊息閘門:登入→登出走一圈回開機態,不跨 it 洩漏
		messages.set(MESSAGES.map((m) => ({ ...m })));
	});
	// Regression: the coach 訊息 badge + row highlight read a static seed, so opening
	// a thread never lowered the unread count — it stayed frozen for the session.
	it('clears a thread unread flag and lowers the derived coach badge count', async () => {
		await hydrateMessages(); // R17:已水合前提(未水合的寫入會排和解重抓)
		const unread0 = get(coachMsgUnread);
		expect(unread0, 'seed should have unread threads').toBeGreaterThan(0);
		const firstUnread = get(messages).find((m) => m.unread)!;
		await markMessageRead(firstUnread.id, Promise.resolve(true));
		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false);
		expect(get(coachMsgUnread)).toBe(unread0 - 1);
	});

	it('ack 為 false(markRead 失敗)→ 維持未讀', async () => {
		const firstUnread = get(messages).find((m) => m.unread)!;

		await markMessageRead(firstUnread.id, Promise.resolve(false));

		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(true);
	});

	it('ack 落地前換身分 → 不碰新身分的 store(R17:取代 MessageThread 手寫的身分核對)', async () => {
		const coach = (id: string) => ({
			id, email: `${id}@dreamfly.test`, name: '教練' + id, phone: null, phone_verified: false, avatar_url: null,
			is_active: true, created_at: '2024-01-01T00:00:00Z', roles: ['coach']
		});
		const login = async (u: ReturnType<typeof coach>) => {
			vi.mocked(api).mockImplementation(
				fakeRouter({ 'POST /auth/logout': undefined, 'POST /auth/login': { access_token: 'at', refresh_token: 'rt', user: u } }, ROUTES)
			);
			await authStore.login(u.email, 'pw');
		};
		await login(coach('ua'));
		await hydrateMessages();
		const firstUnread = get(messages).find((m) => m.unread)!;
		const ack = createDeferred<boolean>();

		const p = markMessageRead(firstUnread.id, ack.promise); // A 開啟對話串,ack 在飛
		await login(coach('ub')); // 換成 B:訊息閘門重置
		const canary = MESSAGES.map((m) => ({ ...m })); // B 的列表剛好含同 id 的未讀串
		messages.set(canary);
		ack.resolve(true);
		await p;

		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(true);
		await authStore.logout(); // 下一個 it 的 beforeEach 會再重置
	});

	// 接線釘:markMessageRead 繞過 messagesGate.write() 的話,在飛水合的舊快照會把已讀蓋回未讀。
	it('hydrateMessages() 在飛期間 markMessageRead → 舊快照不蓋回未讀,且有一次和解重抓', async () => {
		const d = createDeferred<ReturnType<typeof CONVERSATIONS>>();
		const firstUnread = get(messages).find((m) => m.unread)!;
		const snapshots = [d.promise, CONVERSATIONS((id) => id !== firstUnread.id && MESSAGES.find((m) => m.id === id)!.unread)];
		route({ 'GET /conversations/me': () => snapshots.shift() });

		const hydrating = hydrateMessages();
		await markMessageRead(firstUnread.id, Promise.resolve(true));
		d.resolve(CONVERSATIONS()); // 舊快照:該則仍未讀
		await hydrating;
		await new Promise((r) => setTimeout(r, 0)); // 和解重抓收束

		expect(get(messages).find((m) => m.id === firstUnread.id)?.unread).toBe(false);
		expect(apiCalls('GET /conversations/me')).toHaveLength(2);
	});

	it('reading an already-read thread is a no-op for the count', async () => {
		await hydrateMessages();
		const read = get(messages).find((m) => !m.unread)!;
		const before = get(coachMsgUnread);
		await markMessageRead(read.id, Promise.resolve(true));
		expect(get(coachMsgUnread)).toBe(before);
	});
});

describe('hydrateOps / refreshOps', () => {
	// R15(候選 F-3，誠實開機)：取代原「fresh import 後 members/classes/coaches/orders keep
	// the synchronous seed at module load」釘——四個集合開機值改為 `[]`,opsPages 全為
	// 0/0,不再有「同步 seed、水合只是覆寫一次」的假資料。fresh import(同 hydrateMessages
	// 區塊既有寫法)避開本檔其他 it 已對共享 singleton 動過手腳的殘留狀態。
	it('fresh import 後 members/classes/coaches/orders 皆為 []、opsPages 全為 0(誠實開機)', async () => {
		vi.resetModules();
		const fresh = await import('./stores');
		expect(get(fresh.members)).toEqual([]);
		expect(get(fresh.classes)).toEqual([]);
		expect(get(fresh.coaches)).toEqual([]);
		expect(get(fresh.orders)).toEqual([]);
		expect(get(fresh.opsPages)).toEqual({
			members: { total: 0, perPage: 0 },
			classes: { total: 0, perPage: 0 },
			orders: { total: 0, perPage: 0 }
		});
	});

	it('hydrateOps() 在 guard 為 false 時實際觸發水合(覆寫先前的假資料)', async () => {
		resetOpsForTests();
		members.set([{ id: 'x', name: '水合前的假資料', initial: '水', phone: '', joined: '', status: 'active', points: 0 }]);
		await hydrateOps();
		expect(names(get(members))).toEqual(OPS_MEMBER_NAMES);
		resetOpsForTests();
	});

	it('refreshOps() 一律重新 fetch,不受 guard 短路(供重試使用)', async () => {
		resetOpsForTests();
		await hydrateOps();
		orders.set(get(orders).map((o) => ({ ...o, member: '水合前的假資料' })));
		await refreshOps();
		expect(get(orders).map((o) => o.member)).toEqual(OPS_ORDER_MEMBERS);
		resetOpsForTests();
	});

	it('hydrateOps()/refreshOps() 把分頁 meta 寫進 opsPages', async () => {
		const pages = { members: { total: 57, perPage: 20 }, classes: { total: 3, perPage: 20 }, orders: { total: 120, perPage: 20 } };
		route({
			'GET /users?page=1': { users: [], total: 57, page: 1, per_page: 20 },
			'GET /courses?page=1': { courses: [], total: 3, page: 1, per_page: 20 },
			'GET /orders?page=1': { orders: [], total: 120, page: 1, per_page: 20 }
		});
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

describe('hydrateMessages', () => {
	beforeEach(async () => {
		await resetSessionStores(); // 訊息閘門回開機態(前面的 it 可能已水合)
	});

	// R14(候選 F3)誠實開機:開機值 = reset 值 = `[]`(本檔其他 it 會 set 夾具,重新載入模組
	// 才照得到開機那一刻)。
	it('messages 開機為 [](誠實開機)', async () => {
		vi.resetModules();
		const fresh = await import('./stores');
		expect(get(fresh.messages)).toEqual([]);
	});

	it('hydrateMessages() 在 guard 為 false 時實際觸發水合(覆寫先前的假資料)', async () => {
		messages.set([{ ...MESSAGES[0], from: '水合前的假資料' }]);
		await hydrateMessages();
		expect(msgView(get(messages))).toEqual(msgView(MESSAGES));
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

/* R12 Task 3:ops store 自有寫入動詞(逐 entity、新增/編輯分兩支,不做通用 CRUD——ADR-0018 C6)。
 * 每支三條:寫入成功 → getOpsCollections 恰一次、store 反映重抓結果;寫入失敗 → 丟出
 * (coach 系列回 outcome)、不重抓;重抓失敗 → 不丟出(console.error)。錯誤/toast 文案留頁面。
 * 寫入端點與重抓都經 HTTP seam 交代:寫入 body 以 apiBody() 斷言，重抓次數以 opsFetches() 計。 */
describe('ops 寫入動詞', () => {
	/** 寫入成功後的重抓:三個集合各換成一筆「重抓回來的」wire 資料。 */
	const REFRESHED: Record<string, unknown> = {
		'GET /users?page=1': { users: [userResponse({ id: 'zz-new', name: '重抓回來的學員' })], total: 1, page: 1, per_page: 20 },
		'GET /courses?page=1': { courses: [courseResponse({ id: 'zz-k', name: '重抓回來的班級', coach_id: 'zz-c' })], total: 1, page: 1, per_page: 20 },
		'GET /coaches': [coachResponse({ id: 'zz-c', name: '重抓回來的教練' })]
	};

	// R15(候選 F-3，誠實開機):resetOpsForTests() 現在會把內容還原成開機值(`[]`),
	// 不必再靠這裡手動 .set() 四個集合(見 hydration-gate.ts opts.reset)。
	function reset(writes: Record<string, unknown> = {}, refetch: Record<string, unknown> = REFRESHED) {
		resetOpsForTests();
		vi.mocked(api).mockClear();
		route({ ...refetch, ...writes });
	}

	/** 寫入成功但重抓失敗:動詞 resolve(不丟出)、console.error 被叫。 */
	async function expectRefreshFailureSwallowed(writes: Record<string, unknown>, run: () => Promise<unknown>) {
		reset(writes, { 'GET /users?page=1': new Error('refetch boom') });
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		await expect(run()).resolves.not.toThrow();
		expect(opsFetches()).toBe(1);
		expect(err).toHaveBeenCalled();
		err.mockRestore();
		resetOpsForTests();
	}

	describe('addMember(body)', () => {
		const body = { email: 'a@test.com', name: '新學員', password: 'password123' };
		const ok = { 'POST /users': userResponse() };
		it('成功 → createMember(body) → 重抓恰一次,members 反映結果', async () => {
			reset(ok);
			await addMember(body);
			expect(apiBody('POST /users')).toEqual(body);
			expect(opsFetches()).toBe(1);
			expect(names(get(members))).toEqual(['重抓回來的學員']);
			resetOpsForTests();
		});
		it('寫入失敗 → 丟出、不重抓', async () => {
			reset({ 'POST /users': new Error('Email 已被使用') });
			await expect(addMember(body)).rejects.toThrow('Email 已被使用');
			expect(opsFetches()).toBe(0);
		});
		it('重抓失敗 → 不丟出', async () => {
			await expectRefreshFailureSwallowed(ok, () => addMember(body));
		});
	});

	describe('saveMember(id, body)', () => {
		const body = { name: '改名學員' };
		const ok = { 'PATCH /users/m-1': userResponse({ id: 'm-1' }) };
		it('成功 → updateMember(id, body) → 重抓恰一次,members 反映結果', async () => {
			reset(ok);
			await saveMember('m-1', body);
			expect(apiBody('PATCH /users/m-1')).toEqual(body);
			expect(opsFetches()).toBe(1);
			expect(names(get(members))).toEqual(['重抓回來的學員']);
			resetOpsForTests();
		});
		it('寫入失敗 → 丟出、不重抓', async () => {
			reset({ 'PATCH /users/m-1': new Error('422') });
			await expect(saveMember('m-1', body)).rejects.toThrow('422');
			expect(opsFetches()).toBe(0);
		});
		it('重抓失敗 → 不丟出', async () => {
			await expectRefreshFailureSwallowed(ok, () => saveMember('m-1', body));
		});
	});

	// R13 Task 4:課程動詞吃 ClassForm 驗證過的 ValidCourse(coach_id 已在表單端解出)，
	// body 組裝的逐欄規則由 course-request.test.ts 覆蓋，這裡只驗接線與重抓語意。
	const COURSE: ValidCourse = {
		name: '新班級', level: '基礎', category: '兒童基礎', coachId: COACHES[0].id, scheduleText: null,
		minAge: 8, maxAge: null, maxStudents: 12, price: 3200, durationMinutes: 75
	};
	/** JSON 線上形狀(undefined 欄位不上線)。 */
	const wire = (body: unknown) => JSON.parse(JSON.stringify(body));

	describe('addCourse(course)', () => {
		const ok = { 'POST /courses': courseResponse() };
		it('成功 → createCourse(buildCreateCourseBody(course)) → 重抓恰一次,classes 反映結果', async () => {
			reset(ok);
			await addCourse(COURSE);
			expect(apiBody('POST /courses')).toEqual(wire(buildCreateCourseBody(COURSE)));
			expect(opsFetches()).toBe(1);
			expect(names(get(classes))).toEqual(['重抓回來的班級']);
			resetOpsForTests();
		});
		it('寫入失敗 → 丟出、不重抓', async () => {
			reset({ 'POST /courses': new Error('409') });
			await expect(addCourse(COURSE)).rejects.toThrow('409');
			expect(opsFetches()).toBe(0);
		});
		it('重抓失敗 → 不丟出', async () => {
			await expectRefreshFailureSwallowed(ok, () => addCourse(COURSE));
		});
	});

	describe('saveCourse(id, course)', () => {
		const ok = { 'PATCH /courses/k-1': courseResponse({ id: 'k-1' }) };
		it('成功 → updateCourse(id, buildUpdateCourseBody(course)) → 重抓恰一次,classes 反映結果', async () => {
			reset(ok);
			await saveCourse('k-1', COURSE);
			expect(apiBody('PATCH /courses/k-1')).toEqual(wire(buildUpdateCourseBody(COURSE)));
			expect(opsFetches()).toBe(1);
			expect(names(get(classes))).toEqual(['重抓回來的班級']);
			resetOpsForTests();
		});
		it('寫入失敗 → 丟出、不重抓', async () => {
			reset({ 'PATCH /courses/k-1': new Error('403') });
			await expect(saveCourse('k-1', COURSE)).rejects.toThrow('403');
			expect(opsFetches()).toBe(0);
		});
		it('重抓失敗 → 不丟出', async () => {
			await expectRefreshFailureSwallowed(ok, () => saveCourse('k-1', COURSE));
		});
	});

	describe('addCoach(values)', () => {
		const V = { name: '新教練', email: 'c@test.com', password: 'password123', title: '主教練', tags: ['體操'], isActive: true };
		const ok = { 'POST /users': userResponse({ id: 'u-new' }), 'POST /coaches': coachResponse() };
		it('成功 → createMember → createCoach(user_id) → 回 created、重抓恰一次,coaches 反映結果', async () => {
			reset(ok);
			const outcome = await addCoach(V, null);
			expect(outcome).toEqual({ kind: 'created' });
			expect(apiBody('POST /coaches')).toEqual({ user_id: 'u-new', title: V.title, specialties: V.tags, is_active: V.isActive });
			expect(opsFetches()).toBe(1);
			expect(names(get(coaches))).toEqual(['重抓回來的教練']);
			resetOpsForTests();
		});
		it('寫入失敗 → 原樣回失敗 outcome(不丟出)、不重抓', async () => {
			const error = new Error('bind');
			reset({ 'POST /users': userResponse({ id: 'u-x' }), 'POST /coaches': error });
			const outcome = await addCoach(V, null);
			expect(outcome).toEqual({ kind: 'coachBindFailed', pendingUserId: 'u-x', error });
			expect(opsFetches()).toBe(0);
		});
		it('帶 pendingUserId → 不再 createMember,只用同一個 user id 打 createCoach', async () => {
			reset({ 'POST /coaches': coachResponse() });
			expect(await addCoach(V, 'u-pending')).toEqual({ kind: 'created' });
			expect(apiCalls('POST /users')).toHaveLength(0);
			expect(apiBody('POST /coaches')).toEqual({ user_id: 'u-pending', title: V.title, specialties: V.tags, is_active: V.isActive });
			resetOpsForTests();
		});
		it('重抓失敗 → 不丟出,仍回 created', async () => {
			await expectRefreshFailureSwallowed(ok, async () => expect(await addCoach(V, null)).toEqual({ kind: 'created' }));
		});
	});

	describe('saveCoach(values, target)', () => {
		const target = COACHES[0];
		const V = { name: target.name, email: '', password: '', title: '改職稱', tags: target.tags, isActive: target.isActive };
		const ok = { [`PATCH /coaches/${target.id}`]: coachResponse({ id: target.id }) };
		it('成功 → updateCoach(target.id, …) → 回 saved、重抓恰一次,coaches 反映結果', async () => {
			reset(ok);
			const outcome = await saveCoach(V, target);
			expect(outcome).toEqual({ kind: 'saved' });
			expect(apiBody(`PATCH /coaches/${target.id}`)).toEqual({ title: '改職稱', specialties: target.tags, is_active: target.isActive });
			expect(opsFetches()).toBe(1);
			expect(names(get(coaches))).toEqual(['重抓回來的教練']);
			resetOpsForTests();
		});
		it('寫入失敗 → 原樣回失敗 outcome(不丟出)、不重抓', async () => {
			const error = new Error('422');
			reset({ [`PATCH /coaches/${target.id}`]: error });
			const outcome = await saveCoach(V, target);
			expect(outcome).toEqual({ kind: 'coachUpdateFailed', error });
			expect(opsFetches()).toBe(0);
		});
		it('重抓失敗 → 不丟出,仍回 saved', async () => {
			await expectRefreshFailureSwallowed(ok, async () => expect(await saveCoach(V, target)).toEqual({ kind: 'saved' }));
		});
	});
});
