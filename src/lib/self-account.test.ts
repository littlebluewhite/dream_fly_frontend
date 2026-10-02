/* Dream Fly — self-account.ts 單測(R13 Task 3·候選 C1:會員資料 module)。
 *
 * 只替換 $lib/api/client 的 api()(fakeRouter 依 "METHOD path" 回應);authStore 用真的
 * ——identity 由真 login/logout 驅動,syncUser 也是真的(ADR-0022 通知合一的前例)。
 * 三種 setPref outcome 與交錯競態自 mobile/pref-sync.test.ts 移植,斷言語意不變,只是
 * body 改成後端的 snake_case 整包、且多保住後端原有的未知鍵。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { authStore } from '$lib/stores/authStore';
import { selfAccount, prefs, hydrateSelfAccount, setPref, saveSelfAccount, type Prefs } from './self-account';

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const DEFAULT_PREFS: Prefs = { classReminder: true, coachMsg: true, promo: false, dark: false };

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const USER_A = {
	id: 'u-a', email: 'a@dreamfly.test', name: '王小明', phone: '0912345678', phone_verified: false,
	avatar_url: null, is_active: true, created_at: '2024-03-15T08:00:00Z', roles: ['member']
};

/** GET /users/me 的完整形狀(authStore 的 ApiUser + preferences + birth_date)。 */
function me(over: Record<string, unknown> = {}, user: Record<string, unknown> = USER_A) {
	return { ...user, birth_date: null, preferences: null, ...over };
}

type Routes = Record<string, unknown>;
let routes: Routes;
function route(extra: Routes) {
	routes = { ...routes, ...extra };
}
/** 只對 /users/me 的 PATCH body 做斷言用。 */
function patchBodies(): Record<string, unknown>[] {
	return vi.mocked(api).mock.calls
		.filter(([path, init]) => path === '/users/me' && init?.method === 'PATCH')
		.map(([, init]) => JSON.parse(String(init!.body)));
}
function getCount(): number {
	return vi.mocked(api).mock.calls.filter(([path, init]) => path === '/users/me' && !init?.method).length;
}

async function loginAs(user: typeof USER_A) {
	route({ 'POST /auth/login': { access_token: 'at', refresh_token: 'rt', user } });
	await authStore.login(user.email, 'pw');
}

beforeEach(async () => {
	vi.mocked(api).mockReset();
	routes = { 'POST /auth/logout': undefined };
	vi.mocked(api).mockImplementation((path, init) => fakeRouter(routes)(path, init));
	await authStore.logout(); // identity → null:閘門重置(prefs 回預設、profile 清空)
	await loginAs(USER_A);
	vi.mocked(api).mockClear();
});

describe('hydrateSelfAccount', () => {
	it('GET 失敗:hydrateSelfAccount 拋出,下次可重試', async () => {
		route({ 'GET /users/me': new Error('offline') });
		await expect(hydrateSelfAccount()).rejects.toThrow('offline');

		route({ 'GET /users/me': me() });
		await hydrateSelfAccount();
		expect(get(selfAccount)?.name).toBe('王小明');
	});
});

describe('mapping', () => {
	it('birth 為 null → 空字串;phone 為 null → 空字串;since 是 YYYY/MM;lastLogin 是 YYYY-MM-DD HH:MM', async () => {
		route({ 'GET /users/me': me({ phone: null, last_login: '2026-07-04T08:42:00Z' }) });
		await hydrateSelfAccount();

		expect(get(selfAccount)).toEqual({
			id: 'u-a', name: '王小明', initial: '王', email: 'a@dreamfly.test', phone: '', birth: '', since: '2024/03',
			lastLogin: '2026-07-04 08:42'
		});
	});

	it('last_login 缺或為 null → lastLogin 空字串', async () => {
		route({ 'GET /users/me': me() });
		await hydrateSelfAccount();

		expect(get(selfAccount)?.lastLogin).toBe('');
	});

	it('birth_date 原樣沿用 YYYY-MM-DD;preferences 缺鍵走預設', async () => {
		route({ 'GET /users/me': me({ birth_date: '2013-05-18', preferences: { promo: true } }) });
		await hydrateSelfAccount();

		expect(get(selfAccount)?.birth).toBe('2013-05-18');
		expect(get(prefs)).toEqual({ ...DEFAULT_PREFS, promo: true });
	});
});

describe('回歸:GET 還沒落地就 setPref', () => {
	it('送出的是後端值 + 這次切換(未知鍵也保住),之後不會被 GET 蓋回去', async () => {
		const getMe = deferred<unknown>();
		route({
			'GET /users/me': () => getMe.promise,
			'PATCH /users/me': (init: RequestInit) => me({ preferences: JSON.parse(String(init.body)).preferences })
		});

		const hydrating = hydrateSelfAccount(); // 例如帳戶頁進場
		const outcome = setPref('promo', true); // 使用者手快,GET 還在飛
		expect(get(prefs).promo).toBe(true); // 樂觀更新

		getMe.resolve(me({ preferences: { class_reminder: false, promo: false, legacy_key: 'x' } }));
		await hydrating;

		expect(await outcome).toEqual({ kind: 'saved' });
		expect(patchBodies()).toEqual([
			{ preferences: { class_reminder: false, coach_msg: true, promo: true, dark: false, legacy_key: 'x' } }
		]);
		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });

		await hydrateSelfAccount(); // 已水合:不再 GET,不會蓋回
		expect(getCount()).toBe(1);
		expect(get(prefs).promo).toBe(true);
	});

	it('沒有人先水合時,setPref 自己先水合再寫(寫前先水合由結構保證)', async () => {
		route({
			'GET /users/me': me({ preferences: { legacy_key: 1 } }),
			'PATCH /users/me': (init: RequestInit) => me({ preferences: JSON.parse(String(init.body)).preferences })
		});

		expect(await setPref('dark', true)).toEqual({ kind: 'saved' });

		expect(getCount()).toBe(1);
		expect(patchBodies()).toEqual([
			{ preferences: { class_reminder: true, coach_msg: true, promo: false, dark: true, legacy_key: 1 } }
		]);
	});
});

describe('setPref 寫前水合失敗', () => {
	it("水合失敗、resync 成功 → { kind: 'resynced' };store 是伺服器真值,不送 PATCH", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		let gets = 0;
		route({
			'GET /users/me': () =>
				++gets === 1 ? new Error('offline') : me({ preferences: { class_reminder: false, coach_msg: false, promo: true, dark: true } })
		});

		const outcome = await setPref('dark', false);

		expect(outcome).toEqual({ kind: 'resynced' });
		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: false, promo: true, dark: true });
		expect(patchBodies()).toEqual([]);
	});

	it("水合與 resync 都失敗 → { kind: 'rolledBack' };僅該鍵回滾", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		route({ 'GET /users/me': new Error('offline') });

		const outcome = await setPref('dark', true);

		expect(outcome).toEqual({ kind: 'rolledBack' });
		expect(get(prefs)).toEqual(DEFAULT_PREFS);
		expect(getCount()).toBe(2); // 水合一次 + resync 一次
	});
});

describe('setPref 三種 outcome(移植自 pref-sync.test.ts)', () => {
	beforeEach(async () => {
		route({ 'GET /users/me': me() });
		await hydrateSelfAccount();
		vi.mocked(api).mockClear();
	});

	it("送出成功 → { kind: 'saved' };store 維持樂觀更新後的值", async () => {
		route({ 'PATCH /users/me': (init: RequestInit) => me({ preferences: JSON.parse(String(init.body)).preferences }) });

		const outcome = await setPref('classReminder', false);

		expect(outcome).toEqual({ kind: 'saved' });
		expect(get(prefs)).toEqual({ ...DEFAULT_PREFS, classReminder: false });
		expect(patchBodies()).toEqual([{ preferences: { class_reminder: false, coach_msg: true, promo: false, dark: false } }]);
	});

	it("送出失敗、resync 成功 → { kind: 'resynced' };store 被伺服器真值整包覆蓋(非單鍵回滾)", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		// 4 個 key 都刻意與「切換前」的本地值不同,證明整包蓋掉的是 GET 的回應。
		route({
			'PATCH /users/me': new Error('network'),
			'GET /users/me': me({ preferences: { class_reminder: false, coach_msg: false, promo: true, dark: true } })
		});

		const outcome = await setPref('coachMsg', false);

		expect(outcome).toEqual({ kind: 'resynced' });
		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: false, promo: true, dark: true });
	});

	it("送出與 resync 都失敗 → { kind: 'rolledBack' };僅該鍵回滾,其餘 key 不受影響", async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		route({ 'PATCH /users/me': (init: RequestInit) => me({ preferences: JSON.parse(String(init.body)).preferences }) });
		await setPref('classReminder', false);
		await setPref('promo', true); // 已偏離預設值(非首次水合狀態)
		route({ 'PATCH /users/me': new Error('network'), 'GET /users/me': new Error('offline') });

		const outcome = await setPref('coachMsg', false); // true→false,稍後回滾

		expect(outcome).toEqual({ kind: 'rolledBack' });
		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });
	});
});

describe('交錯競態(移植自 pref-sync.test.ts)', () => {
	it('切 A 在飛又切 B → 序列化:call2 在 call1 的失敗處理(含 resync)完成後才送出,且 body 是「輪到時」的最新整包', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		route({ 'GET /users/me': me() });
		await hydrateSelfAccount();
		vi.mocked(api).mockClear();

		const call1Save = deferred<unknown>();
		let patches = 0;
		route({
			'PATCH /users/me': (init: RequestInit) =>
				++patches === 1 ? call1Save.promise : me({ preferences: JSON.parse(String(init.body)).preferences }),
			'GET /users/me': me() // call1 失敗後的整包 resync(伺服器從未收到 call1 的變更)
		});

		const call1 = setPref('classReminder', false);
		expect(get(prefs).classReminder).toBe(false);

		const call2 = setPref('promo', true);
		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });

		await new Promise((r) => setTimeout(r, 0));
		expect(patches).toBe(1); // 序列化:call2 尚未送出

		call1Save.reject(new Error('network'));
		expect(await call1).toEqual({ kind: 'resynced' });
		expect(getCount()).toBe(1); // 觸發整包 resync

		expect(await call2).toEqual({ kind: 'saved' });
		expect(patches).toBe(2);
		// call2 的 body:classReminder 已是 resync 後的正確值(true);promo 因整包 resync
		// 一併回到伺服器真值 false(同 pref-sync 的刻意取捨:不讓本地顯示與伺服器悄悄分歧)。
		expect(patchBodies().at(-1)).toEqual({ preferences: { class_reminder: true, coach_msg: true, promo: false, dark: false } });
		expect(get(prefs)).toEqual({ classReminder: true, coachMsg: true, promo: false, dark: false });
	});
});

describe('saveSelfAccount', () => {
	beforeEach(async () => {
		route({ 'GET /users/me': me({ birth_date: '2013-05-18', preferences: { legacy_key: 'x' } }) });
		await hydrateSelfAccount();
		vi.mocked(api).mockClear();
	});

	it('只送改過的欄位;成功後 selfAccount 與 Topbar 讀的 authStore 名字同步更新', async () => {
		route({ 'PATCH /users/me': me({ name: '王大明', birth_date: '2013-05-18', preferences: { legacy_key: 'x' } }) });

		const outcome = await saveSelfAccount({ name: ' 王大明 ', phone: '0912345678', birth: '2013-05-18' });

		expect(outcome).toEqual({ kind: 'saved' });
		expect(patchBodies()).toEqual([{ name: '王大明' }]);
		expect(get(selfAccount)?.name).toBe('王大明');
		expect(get(authStore).member?.name).toBe('王大明');
	});

	it('沒有改動就不發請求', async () => {
		expect(await saveSelfAccount({ name: '王小明', phone: '0912345678', birth: '2013-05-18', prefs: { promo: false } })).toEqual({ kind: 'saved' });
		expect(patchBodies()).toEqual([]);
	});

	it('birth 清空 → 送 null;prefs 有改 → 送整包(保住未知鍵)並寫回 prefs', async () => {
		route({ 'PATCH /users/me': (init: RequestInit) => me({ ...JSON.parse(String(init.body)) }) });

		await saveSelfAccount({ birth: '', prefs: { classReminder: false, promo: true } });

		expect(patchBodies()).toEqual([
			{ birth_date: null, preferences: { legacy_key: 'x', class_reminder: false, coach_msg: true, promo: true, dark: false } }
		]);
		expect(get(selfAccount)?.birth).toBe('');
		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });
	});

	it('不做樂觀更新;PATCH 失敗 → failed{error},資料不動', async () => {
		const err = new Error('422');
		route({ 'PATCH /users/me': err });

		const outcome = await saveSelfAccount({ name: '王大明', prefs: { promo: true } });

		expect(outcome).toEqual({ kind: 'failed', error: err });
		expect(get(selfAccount)?.name).toBe('王小明');
		expect(get(prefs).promo).toBe(false);
		expect(get(authStore).member?.name).toBe('王小明');
	});

	it('表單規則照後端:姓名 2–100、電話 8–20、原本有電話不能清空 → failed 且不發請求', async () => {
		for (const edit of [{ name: '王' }, { name: 'x'.repeat(101) }, { phone: '1234567' }, { phone: '1'.repeat(21) }, { phone: '' }]) {
			const outcome = await saveSelfAccount(edit);
			expect(outcome.kind).toBe('failed');
		}
		expect(patchBodies()).toEqual([]);
	});

	it('未改動的姓名/電話即使不合法也不擋其他欄位的存檔(F3:Google 註冊姓名可能落在 2–100 之外)', async () => {
		route({ 'GET /users/me': me({}, { ...USER_A, name: 'J' }) });
		await authStore.logout();
		await loginAs({ ...USER_A, name: 'J' });
		vi.mocked(api).mockClear();
		route({
			'GET /users/me': me({}, { ...USER_A, name: 'J' }),
			'PATCH /users/me': me({ birth_date: '2013-05-18' }, { ...USER_A, name: 'J' })
		});

		const outcome = await saveSelfAccount({ name: 'J', phone: USER_A.phone, birth: '2013-05-18' });

		expect(outcome).toEqual({ kind: 'saved' });
		expect(patchBodies()).toEqual([{ birth_date: '2013-05-18' }]);
	});
});
