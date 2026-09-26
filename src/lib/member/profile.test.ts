/* Dream Fly — member/profile.ts 單測(R13 Task 3·候選 C1:會員資料 module)。
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
import { memberProfile, prefs, hydrateProfile, setPref, saveProfile, type Prefs } from './profile';

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
const USER_B = { ...USER_A, id: 'u-b', email: 'b@dreamfly.test', name: '李大華', phone: null };

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

async function loginAs(user: typeof USER_A | typeof USER_B) {
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

describe('水合:每個 identity 只 GET 一次', () => {
	it('同一 identity 重複 / 併發呼叫 hydrateProfile() 只 GET 一次', async () => {
		route({ 'GET /users/me': me() });

		await Promise.all([hydrateProfile(), hydrateProfile()]);
		await hydrateProfile();

		expect(getCount()).toBe(1);
	});

	it('A → B 直接換帳號:立即清空、B 重新 GET', async () => {
		route({ 'GET /users/me': me({ preferences: { promo: true } }) });
		await hydrateProfile();
		expect(get(memberProfile)?.name).toBe('王小明');

		await loginAs(USER_B);
		expect(get(memberProfile)).toBeNull();
		expect(get(prefs)).toEqual(DEFAULT_PREFS);

		route({ 'GET /users/me': me({}, USER_B) });
		await hydrateProfile();
		expect(getCount()).toBe(2);
		expect(get(memberProfile)?.name).toBe('李大華');
	});

	it('登出即重置;再登入重新 GET', async () => {
		route({ 'GET /users/me': me({ preferences: { dark: true } }) });
		await hydrateProfile();
		expect(get(prefs).dark).toBe(true);

		await authStore.logout();
		expect(get(memberProfile)).toBeNull();
		expect(get(prefs)).toEqual(DEFAULT_PREFS);

		await loginAs(USER_A);
		await hydrateProfile();
		expect(getCount()).toBe(2);
	});

	it('GET 失敗:hydrateProfile 拋出,下次可重試', async () => {
		route({ 'GET /users/me': new Error('offline') });
		await expect(hydrateProfile()).rejects.toThrow('offline');

		route({ 'GET /users/me': me() });
		await hydrateProfile();
		expect(get(memberProfile)?.name).toBe('王小明');
	});
});

describe('mapping', () => {
	it('birth 為 null → 空字串;phone 為 null → 空字串;since 是 YYYY/MM', async () => {
		route({ 'GET /users/me': me({ phone: null }) });
		await hydrateProfile();

		expect(get(memberProfile)).toEqual({
			name: '王小明', initial: '王', email: 'a@dreamfly.test', phone: '', birth: '', since: '2024/03'
		});
	});

	it('birth_date 原樣沿用 YYYY-MM-DD;preferences 缺鍵走預設', async () => {
		route({ 'GET /users/me': me({ birth_date: '2013-05-18', preferences: { promo: true } }) });
		await hydrateProfile();

		expect(get(memberProfile)?.birth).toBe('2013-05-18');
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

		const hydrating = hydrateProfile(); // 例如帳戶頁進場
		const outcome = setPref('promo', true); // 使用者手快,GET 還在飛
		expect(get(prefs).promo).toBe(true); // 樂觀更新

		getMe.resolve(me({ preferences: { class_reminder: false, promo: false, legacy_key: 'x' } }));
		await hydrating;

		expect(await outcome).toEqual({ kind: 'saved' });
		expect(patchBodies()).toEqual([
			{ preferences: { class_reminder: false, coach_msg: true, promo: true, dark: false, legacy_key: 'x' } }
		]);
		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });

		await hydrateProfile(); // 已水合:不再 GET,不會蓋回
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

describe('setPref 三種 outcome(移植自 pref-sync.test.ts)', () => {
	beforeEach(async () => {
		route({ 'GET /users/me': me() });
		await hydrateProfile();
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
		await hydrateProfile();
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

describe('saveProfile', () => {
	beforeEach(async () => {
		route({ 'GET /users/me': me({ birth_date: '2013-05-18', preferences: { legacy_key: 'x' } }) });
		await hydrateProfile();
		vi.mocked(api).mockClear();
	});

	it('只送改過的欄位;成功後 memberProfile 與 Topbar 讀的 authStore 名字同步更新', async () => {
		route({ 'PATCH /users/me': me({ name: '王大明', birth_date: '2013-05-18', preferences: { legacy_key: 'x' } }) });

		const outcome = await saveProfile({ name: ' 王大明 ', phone: '0912345678', birth: '2013-05-18' });

		expect(outcome).toEqual({ kind: 'saved' });
		expect(patchBodies()).toEqual([{ name: '王大明' }]);
		expect(get(memberProfile)?.name).toBe('王大明');
		expect(get(authStore).member?.name).toBe('王大明');
	});

	it('沒有改動就不發請求', async () => {
		expect(await saveProfile({ name: '王小明', phone: '0912345678', birth: '2013-05-18', prefs: { promo: false } })).toEqual({ kind: 'saved' });
		expect(patchBodies()).toEqual([]);
	});

	it('birth 清空 → 送 null;prefs 有改 → 送整包(保住未知鍵)並寫回 prefs', async () => {
		route({ 'PATCH /users/me': (init: RequestInit) => me({ ...JSON.parse(String(init.body)) }) });

		await saveProfile({ birth: '', prefs: { classReminder: false, promo: true } });

		expect(patchBodies()).toEqual([
			{ birth_date: null, preferences: { legacy_key: 'x', class_reminder: false, coach_msg: true, promo: true, dark: false } }
		]);
		expect(get(memberProfile)?.birth).toBe('');
		expect(get(prefs)).toEqual({ classReminder: false, coachMsg: true, promo: true, dark: false });
	});

	it('不做樂觀更新;PATCH 失敗 → failed{error},資料不動', async () => {
		const err = new Error('422');
		route({ 'PATCH /users/me': err });

		const outcome = await saveProfile({ name: '王大明', prefs: { promo: true } });

		expect(outcome).toEqual({ kind: 'failed', error: err });
		expect(get(memberProfile)?.name).toBe('王小明');
		expect(get(prefs).promo).toBe(false);
		expect(get(authStore).member?.name).toBe('王小明');
	});

	it('表單規則照後端:姓名 2–100、電話 8–20、原本有電話不能清空 → failed 且不發請求', async () => {
		for (const edit of [{ name: '王' }, { name: 'x'.repeat(101) }, { phone: '1234567' }, { phone: '1'.repeat(21) }, { phone: '' }]) {
			const outcome = await saveProfile(edit);
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

		const outcome = await saveProfile({ name: 'J', phone: USER_A.phone, birth: '2013-05-18' });

		expect(outcome).toEqual({ kind: 'saved' });
		expect(patchBodies()).toEqual([{ birth_date: '2013-05-18' }]);
	});
});

describe('換帳號:A 排隊的寫入跳過', () => {
	it('A 的寫入在飛時排進的第二筆,換成 B 之後輪到時直接跳過,不送出', async () => {
		route({ 'GET /users/me': me() });
		await hydrateProfile();
		vi.mocked(api).mockClear();

		const first = deferred<unknown>();
		route({ 'PATCH /users/me': () => first.promise });
		const a1 = setPref('dark', true);
		const a2 = saveProfile({ name: '王大明' });
		await new Promise((r) => setTimeout(r, 0));
		expect(patchBodies()).toHaveLength(1);

		await loginAs(USER_B); // 無登出,直接換帳號
		first.resolve(me({ preferences: { dark: true } }));
		await a1;

		expect((await a2).kind).toBe('failed');
		expect(patchBodies()).toHaveLength(1); // 第二筆沒送
		expect(get(memberProfile)).toBeNull(); // A 的回應也沒寫進 B
		expect(get(authStore).member?.name).toBe('李大華');
	});
});
