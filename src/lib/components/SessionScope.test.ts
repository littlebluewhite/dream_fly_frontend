/* Dream Fly — 身分範圍 (Session Scope) 元件測試(R21 F3)。
 *
 * member / mobile / coach / mobile-admin 四個身分相依 layout 的守門、暖機准入、頁面壽命與換人關 overlay
 * 只在這裡測一次;各 layout 的測試只留自己特有的宣告(守門函式、暖機清單、結帳接收、分區)。 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { writable, type Writable } from 'svelte/store';
import { tick } from 'svelte';
import { goto } from '$app/navigation';

let mockUrl = new URL('http://localhost/s/home');
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: writable({
		get url() {
			return mockUrl;
		}
	})
}));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/authStore', async () => {
	const { makeAuthMockA, FIXTURE_MEMBER } = await import('$lib/testing/auth-mock');
	return makeAuthMockA({ memberFor: (email) => ({ ...FIXTURE_MEMBER, id: email }) });
});

// describePageLifetime 的探針頁面經 api() 讀資料。
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { page } from '$app/stores';
import { authStore, type AuthState } from '$lib/stores/authStore';
import { describePageLifetime } from '$lib/testing/page-lifetime';
import SessionScope from './SessionScope.svelte';

/** 未登入導去登入頁(帶來源路徑),已登入放行——同 member/mobile 的守門形狀。 */
const loginGuard = (url: URL, auth: AuthState) => (auth.loggedIn ? null : `/s/login?from=${url.pathname}`);

/** 換到另一個網址:$page 送出新值(SvelteKit 每次導頁都會)。 */
function navigate(path: string) {
	mockUrl = new URL(`http://localhost${path}`);
	(page as unknown as Writable<{ url: URL }>).set({
		get url() {
			return mockUrl;
		}
	});
}

beforeEach(() => {
	mockUrl = new URL('http://localhost/s/home');
	authStore.logout();
});
afterEach(() => vi.clearAllMocks());

describe('SessionScope — 守門', () => {
	it('guard 回傳目標 → goto 該目標(guard 拿到目前的 URL 與登入狀態)', () => {
		render(SessionScope, { guard: loginGuard, caller: 'test', warm: [] });
		expect(goto).toHaveBeenCalledWith('/s/login?from=/s/home');
	});

	it('guard 回 null(已登入放行)→ 不導頁', async () => {
		await authStore.login('a', 'pw');
		render(SessionScope, { guard: loginGuard, caller: 'test', warm: [] });
		expect(goto).not.toHaveBeenCalled();
	});

	/** 不看網址、只認角色的守門:沒有 coach 角色一律導去同一個目標。 */
	const coachOnly = (_url: URL, auth: AuthState) => (auth.roles.includes('coach') ? null : '/s/login?blocked=1');

	it.each([
		{ when: '換到另一個受守門的網址', change: async () => navigate('/s/other') },
		{ when: '登入狀態變了(換成另一個同樣被擋的身分)', change: () => authStore.login('b', 'pw') }
	])('目標字串沒變也再 goto:$when(前一次導頁被打斷也導得走)', async ({ change }) => {
		await authStore.login('a', 'pw');
		render(SessionScope, { guard: coachOnly, caller: 'test', warm: [] });
		expect(goto).toHaveBeenCalledTimes(1);
		await change();
		await tick();
		expect(goto).toHaveBeenCalledTimes(2);
		expect(goto).toHaveBeenLastCalledWith('/s/login?blocked=1');
	});
});

describe('SessionScope — 暖機准入', () => {
	const settle = () => new Promise((r) => setTimeout(r, 0));
	const admitAll = () => null;
	const redirectAll = () => '/s/login';
	const inCoachSection = (url: URL) => url.pathname.startsWith('/s/coach');

	it.each([
		{ when: '已登入、守門放行、warmIn 預設', login: true, guard: admitAll, warmIn: undefined, path: '/s/home', gets: 1 },
		{ when: '已登入但守門導走', login: true, guard: redirectAll, warmIn: undefined, path: '/s/home', gets: 0 },
		{ when: '已登入、守門放行但不在暖機分區', login: true, guard: admitAll, warmIn: inCoachSection, path: '/s/admin', gets: 0 },
		{ when: '未登入(守門放行的公開頁)', login: false, guard: admitAll, warmIn: undefined, path: '/s/home', gets: 0 }
	])('$when → 暖機 $gets 次', async ({ login, guard, warmIn, path, gets }) => {
		mockUrl = new URL(`http://localhost${path}`);
		if (login) await authStore.login('a', 'pw');
		const hydrate = vi.fn(async () => {});
		render(SessionScope, { guard, caller: 'test', warm: [['探針', hydrate]], ...(warmIn ? { warmIn } : {}) });
		await settle();
		expect(hydrate).toHaveBeenCalledTimes(gets);
	});

	it('同一個身分再設一次 → 只暖 1 次', async () => {
		await authStore.login('a', 'pw');
		const hydrate = vi.fn(async () => {});
		render(SessionScope, { guard: admitAll, caller: 'test', warm: [['探針', hydrate]] });
		await settle();
		await authStore.login('a', 'pw');
		await settle();
		expect(hydrate).toHaveBeenCalledTimes(1);
	});

	it('A→B → 以 B 再暖一次', async () => {
		await authStore.login('a', 'pw');
		const hydrate = vi.fn(async () => {});
		render(SessionScope, { guard: admitAll, caller: 'test', warm: [['探針', hydrate]] });
		await settle();
		await authStore.login('b', 'pw');
		await settle();
		expect(hydrate).toHaveBeenCalledTimes(2);
	});

	it('登出 → 不暖(不帶著沒有 token 的狀態打 API)', async () => {
		await authStore.login('a', 'pw');
		const hydrate = vi.fn(async () => {});
		render(SessionScope, { guard: loginGuard, caller: 'test', warm: [['探針', hydrate]] });
		await settle();
		await authStore.logout();
		await settle();
		expect(hydrate).toHaveBeenCalledTimes(1);
	});
});

describe('SessionScope — 換人時關 overlay', () => {
	it('A→B → closeAll(overlay 在 slot 外面也會讀個人資料)', async () => {
		await authStore.login('a', 'pw');
		const overlay = { closeAll: vi.fn() };
		render(SessionScope, { guard: loginGuard, caller: 'test', warm: [], overlay });
		overlay.closeAll.mockClear();
		await authStore.login('b', 'pw');
		await tick();
		expect(overlay.closeAll).toHaveBeenCalledTimes(1);
	});

	it('登出 → 不關(導頁交給 guard,overlay 由各 layout 的 afterNavigate 關)', async () => {
		await authStore.login('a', 'pw');
		const overlay = { closeAll: vi.fn() };
		render(SessionScope, { guard: loginGuard, caller: 'test', warm: [], overlay });
		overlay.closeAll.mockClear();
		await authStore.logout();
		await tick();
		expect(overlay.closeAll).not.toHaveBeenCalled();
	});
});

describePageLifetime('SessionScope', SessionScope, {}, { guard: loginGuard, caller: 'test', warm: [] });
