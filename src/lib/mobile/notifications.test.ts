/* Dream Fly — 行動版通知中心模組單測。
 *
 * C3(架構深化 R9):三個 describe 自 `mobile/stores.test.ts` 隨通知段一起搬來(斷言
 * 逐字未變——搬遷的零回歸活證明);只有 import 與模組初始化改指向新檔。原
 * `describe('notifs')`(createNotifs 工廠語意)不隨行:同語意已由
 * `$lib/stores/read-state.test.ts` 覆蓋。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { notifs, notifsHydrated, notifsPageEntry } from './notifications';
import { NOTIFS_SEED, type Notification as NotifItem } from '$lib/domain/member-app';
// C1(session 重置抬升)跨帳號 session 重置釘:用真 authStore.login/logout 驅動 identity。
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import { createLoadGate } from '$lib/load-gate';

/** 手動控時序的 deferred promise——測 in-flight race 不用 fake timers(同 member 側慣用式)。 */
function createDeferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

/** GET /notifications 的後端形狀(ApiNotification),只填 mapNotification 會讀到的欄位。 */
function apiNotif(id: string, read: boolean) {
	return {
		id, type: 'system', title: '系統公告', message: '內容',
		is_read: read, metadata: null, created_at: '2026-01-01T00:00:00Z'
	};
}

// W1:notifs.markRead/markAllRead 會送 PATCH 落庫(見 notifications.ts)——只替換
// $lib/api/client 的 api(),spread 保留 ApiError 等其餘 export(同
// member/notifications.test.ts 既有慣例)。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

describe('notifs singleton — 同步 seed + 水合守衛(notifications 頁 core risk)', () => {
	// 與 member notifications 前例同型:同步 seed(badge 立即有值),首訪通知頁
	// 時經 getNotifications() 水合覆寫一次,notifsHydrated 守衛防重訪重抓。
	it('起始即帶 NOTIFS_SEED(clone,badge 立即有值),notifsHydrated 起始為 false', () => {
		expect(get(notifs)).toEqual(NOTIFS_SEED);
		// clone 而非共享參照:store 上的 mutation 不得污染 seed 常數。
		expect(get(notifs)[0]).not.toBe(NOTIFS_SEED[0]);
		expect(get(notifsHydrated)).toBe(false);
	});

	// K2-c 協定補完:markRead/markAllRead 先前完全沒有翻旗,mutation 後
	// notifsHydrated 仍是 false,重訪通知頁會被 load-gate 判定「尚未水合」而
	// 整包重抓、覆寫掉這裡剛做的已讀 mutation。包裝函式對齊 member 的
	// markMutated 協定,呼叫共用邏輯後翻旗。除了旗標也斷言 read 真的被改寫
	// ——wrapper 若忘了委派共用邏輯,這裡會紅(createNotifs 獨立 instance 的
	// 工廠語意由 read-state.test.ts 覆蓋,蓋不到 export 出去的這顆 singleton wrapper)。
	it('markRead/markAllRead 委派共用邏輯改寫 read,並翻 notifsHydrated 為 true', () => {
		// 直接 seed singleton 已知 fixture,不依賴檔內其他測試的執行順序。
		notifs.set([
			{ id: 'w1', cat: 'class', icon: 'bell', tone: 'info', title: '甲', body: '乙', time: '剛才', read: false },
			{ id: 'w2', cat: 'system', icon: 'bell', tone: 'info', title: '丙', body: '丁', time: '剛才', read: false }
		]);
		notifsHydrated.set(false);

		notifs.markRead('w1');
		expect(get(notifs).find((n) => n.id === 'w1')?.read).toBe(true);
		expect(get(notifsHydrated)).toBe(true);

		notifsHydrated.set(false); // 重置守衛,單獨驗證 markAllRead 這條路徑也會翻旗
		notifs.markAllRead();
		expect(get(notifs).every((n) => n.read)).toBe(true);
		expect(get(notifsHydrated)).toBe(true);
	});
});

describe('notifs singleton — 已讀落庫(W1:PATCH /notifications/{id}/read)', () => {
	// 與 $lib/member/notifications.ts 的 markRead/markAllRead 行為同構(PATCH 端點、
	// 樂觀更新失敗不還原、allSettled 併發送出、全部成功回 'ok' 否則 'partial' 四點
	// 對齊),結構刻意不同——member 走 gate.markMutated + notifications.update,這裡
	// 走 notifsBase + gate.markMutated(見 notifications.ts 的 notifs 宣告)。
	const seed: NotifItem[] = [
		{ id: 'w1', cat: 'class', icon: 'bell', tone: 'info', title: '甲', body: '乙', time: '剛才', read: false },
		{ id: 'w2', cat: 'system', icon: 'bell', tone: 'info', title: '丙', body: '丁', time: '剛才', read: false },
		{ id: 'w3', cat: 'system', icon: 'bell', tone: 'info', title: '戊', body: '己', time: '剛才', read: true }
	];

	beforeEach(() => {
		vi.mocked(api).mockReset();
		vi.mocked(api).mockResolvedValue(undefined);
		notifs.set(seed.map((n) => ({ ...n })));
		notifsHydrated.set(false);
	});

	it('markRead 樂觀更新後送 PATCH /notifications/{id}/read 落庫，並翻 notifsHydrated', async () => {
		await notifs.markRead('w1');

		expect(api).toHaveBeenCalledWith('/notifications/w1/read', { method: 'PATCH' });
		expect(get(notifs).find((n) => n.id === 'w1')?.read).toBe(true);
		expect(get(notifsHydrated)).toBe(true);
	});

	it('markRead 的 PATCH 失敗只記錄錯誤，樂觀更新的已讀狀態不還原', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api).mockRejectedValue(new Error('network error'));

		await notifs.markRead('w1');

		expect(get(notifs).find((n) => n.id === 'w1')?.read).toBe(true);
		expect(console.error).toHaveBeenCalledWith('Failed to mark notification as read:', expect.any(Error));
	});

	it("markAllRead 只對未讀各發一次 PATCH(已讀的 w3 不重發)，全部成功回 'ok'", async () => {
		const result = await notifs.markAllRead();

		expect(result).toBe('ok');
		const patchCalls = vi.mocked(api).mock.calls.filter(([, init]) => (init as RequestInit)?.method === 'PATCH');
		const patchPaths = patchCalls.map(([path]) => path).sort();
		expect(patchPaths).toEqual(['/notifications/w1/read', '/notifications/w2/read']);
		expect(patchPaths).not.toContain('/notifications/w3/read'); // w3 已讀，不重發
	});

	it("markAllRead 任一 PATCH 失敗回 'partial'，本地已讀狀態不還原", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		vi.mocked(api).mockImplementation(async (path: string) => {
			if (path === '/notifications/w2/read') throw new Error('network error');
			return undefined;
		});

		const result = await notifs.markAllRead();

		expect(result).toBe('partial');
		expect(get(notifs).every((n) => n.read)).toBe(true);
	});

	it("無未讀時零 PATCH 仍回 'ok'——unreadIds 必須在 notifsBase.markAllRead() 前捕捉，不是事後從已被翻成全已讀的 store 反查", async () => {
		notifs.set(seed.map((n) => ({ ...n, read: true })));

		const p = notifs.markAllRead();
		/* 補強(R11 終審修波 F4):空集路徑零記帳。舊碼照樣把 allSettled([]) 當一筆尾流入帳,
		 * 同拍呼叫的頁面 refresh 要多等三個 microtask 才出發 GET——純時序雜訊。必須在 await
		 * 之前同步取讀,await 之後那筆空帳早已歸零、照不到。 */
		expect(notifsPageEntry.hydrate.pendingSettle?.()).toBeUndefined();
		const result = await p;

		expect(api).not.toHaveBeenCalled();
		expect(result).toBe('ok');
	});
});

describe('notifs singleton — 跨帳號 session 重置(C1 抬升 → C3 改建完整 session 閘門)', () => {
	// notifsHydrated 原本跨帳號存活是真缺陷:SPA 登出無整頁重載,B 帳號重訪通知頁被
	// load-gate 判「已水合」而讀到 A 的已讀/通知。createSessionGate(見 notifications.ts)
	// 在 identity 變更時重置為 boot 態。用真 authStore 驅動,auth 端點經 fakeRouter。
	const AUTH_RES = {
		access_token: 'at-m', refresh_token: 'rt-m',
		user: { id: 'u-m1', email: 'a@dreamfly.test', name: '甲', phone: null, phone_verified: false, avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member'] }
	};
	const AUTH_RES_B = { ...AUTH_RES, access_token: 'at-mb', refresh_token: 'rt-mb', user: { ...AUTH_RES.user, id: 'u-m2', email: 'b@dreamfly.test', name: '乙' } };

	beforeEach(async () => {
		vi.mocked(api).mockReset();
		vi.mocked(api).mockResolvedValue(undefined); // logout best-effort revoke .catch 安全
		await authStore.logout(); // 每個 it 從登出態起跑:立即回呼身分 null == baseline,不誤觸
		notifs.set(NOTIFS_SEED.map((n) => ({ ...n })));
		notifsHydrated.set(false);
	});

	it('F1 跨登入洩漏釘:hydrate + 已讀後登出 → notifsHydrated 翻 false + notifs 重置為 seed,B 不繼承 A 的已讀', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': AUTH_RES, 'POST /auth/logout': undefined }));

		await authStore.login('a@dreamfly.test', 'pw');
		// 模擬通知頁 load-gate 水合 + 已讀 mutation。
		notifs.set([{ id: 'a1', cat: 'system', icon: 'bell', tone: 'info', title: 'A 的通知', body: '', time: '剛才', read: true }]);
		notifsHydrated.set(true);

		await authStore.logout(); // 「登入 → 登出」邊沿

		expect(get(notifsHydrated)).toBe(false); // 旗標重置,重訪不會被判「已水合」而讀到 A 的
		expect(get(notifs)).toEqual(NOTIFS_SEED); // A 的已讀不留給 B,重置為 seed(boot 態)
		expect(get(notifs)[0]).not.toBe(NOTIFS_SEED[0]); // clone,非共享參照
	});

	it('P1″ 換帳號釘:A hydrate 後 B 直接登入(無登出)→ identity 變更即 reset,B 不繼承 A 的通知', async () => {
		let logins = 0;
		vi.mocked(api).mockImplementation(fakeRouter({ 'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B) }));

		await authStore.login('a@dreamfly.test', 'pw');
		notifs.set([{ id: 'a1', cat: 'system', icon: 'bell', tone: 'info', title: 'A 的通知', body: '', time: '剛才', read: true }]);
		notifsHydrated.set(true);

		await authStore.login('b@dreamfly.test', 'pw'); // B 直接登入,無登出邊沿

		expect(get(notifsHydrated)).toBe(false);
		expect(get(notifs)).toEqual(NOTIFS_SEED); // A 的通知即刻清空為 seed
	});
});

describe('notifs singleton — mutation settle 訊號(架構深化 R11 第五決策點)', () => {
	/* markAllRead 是 mark-before-await(先寫 store、markMutated,才 await 那批 PATCH)。
	 * 舊碼的 refresh 只看世代穩定,對「PATCH 群還在飛」是盲的:GET 在落庫前出發 → server
	 * 回未讀、而世代此刻已穩定 → 舊快照照套,已讀被打回未讀(ADR 0020 誠實界線記載的
	 * GET/PATCH server-race;member 側是 markRead 的鏡射)。allSettled 的尾流「含失敗也
	 * settle」,不得因為某一筆 PATCH 失敗就永久卡住 refresh。 */
	const seed: NotifItem[] = [
		{ id: 'w1', cat: 'system', icon: 'bell', tone: 'info', title: '甲', body: '乙', time: '剛才', read: false },
		{ id: 'w2', cat: 'system', icon: 'bell', tone: 'info', title: '丙', body: '丁', time: '剛才', read: false }
	];

	beforeEach(() => {
		vi.mocked(api).mockReset();
		notifs.set(seed.map((n) => ({ ...n })));
		notifsHydrated.set(false);
	});

	it('markAllRead 的 PATCH 群未 settle → 頁面 refresh 的 GET 不出發;含失敗的 allSettled settle 後照出發', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const okPatch = createDeferred<unknown>();
		const badPatch = createDeferred<unknown>();
		let gets = 0;
		let serverReadW1 = false; // 後端真相:w1 落庫後才翻已讀;w2 的 PATCH 失敗,始終未讀
		vi.mocked(api).mockImplementation(fakeRouter({
			'GET /notifications': () => { gets += 1; return [apiNotif('w1', serverReadW1), apiNotif('w2', false)]; },
			'PATCH /notifications/w1/read': () => okPatch.promise,
			'PATCH /notifications/w2/read': () => badPatch.promise
		}));

		const page = createLoadGate({ ...notifsPageEntry });
		const allP = notifs.markAllRead(); // 樂觀全已讀 + markMutated(allSettled 尾流)
		const refreshP = page.refresh(); // 使用者同時按「重新整理」
		await new Promise((r) => setTimeout(r, 0));

		expect(gets).toBe(0); // PATCH 群仍在飛 → GET 一律不出發

		serverReadW1 = true;
		okPatch.resolve(undefined);
		badPatch.reject(new Error('network error'));
		const result = await allP;
		await refreshP;

		expect(result).toBe('partial');
		expect(gets).toBe(1); // 尾流(含失敗那筆)settle 後才出發,且只一次
		expect(get(notifs).find((n) => n.id === 'w1')?.read).toBe(true); // 落庫成功的已讀不回退
		// 已知殘餘(誠實界線):w2 的 PATCH 失敗,重新整理顯示 server 真相(未讀)——這是顯式
		// 新鮮度契約,不是回歸(見 markAllRead 的「失敗不還原」不閃爍原則)。
		expect(get(notifs).find((n) => n.id === 'w2')?.read).toBe(false);

		page.destroy();
	});
});
