import { vi } from 'vitest';
import { writable, derived } from 'svelte/store';

/* authStore mock 兩個家族的升格出處：
 * - 家族 A(方法驅動)：CartDropdown/Header/member Sidebar·Topbar/cart 頁/member 版
 *   layout 等 6 個 canonical 檔 + 3 個偏差檔（courses 頁 register no-op、mobile
 *   layout 無 register、mobile-admin layout 角色感知 login）逐字手抄的本地 mock。
 * - 家族 B(__set 後門)：admin/coach Sidebar·Topbar 等 3 個 canonical 檔 + 1 個偏差檔
 *   （mobile-admin/page 多帶 isLoggedIn）逐字手抄的本地 mock。
 * 兩家族零交集，分別對應下面的 makeAuthMockA / makeAuthMockB。 */

export type MockMember = {
	id: string;
	name: string;
	initial: string;
	since: string;
	points: number;
	color: string;
	age: number;
};

export type MockAuthState = { loggedIn: boolean; member: MockMember | null; roles: string[] };

/** 家族 B 消費檔對已 mock 的 authStore 取用 __set 後門用的斷言型別
 *  （`(authStore as TestAuthStore).__set(...)`)——與真 authStore 型別交集，讓斷言在
 *  「窄化到具備 __set」的方向合法。 */
export type TestAuthStore = typeof import('$lib/stores/authStore').authStore & {
	__set: (s: MockAuthState) => void;
};

/** 家族 B 共用 fixture member（王小明）。 */
export const FIXTURE_MEMBER: MockMember = {
	id: 'u1',
	name: '王小明',
	initial: '王',
	since: '2024-01-01',
	points: 0,
	color: 'var(--df-primary)',
	age: 0
};

/** 家族 A(方法驅動)：login/register 直接把登入態寫入 store，logout 重置，hydrate
 *  no-op。roleFor 供角色感知的 login(mobile-admin/layout 依 email 判斷 admin/coach)；
 *  未帶入時 login 一律回 ['member']。 */
export function makeAuthMockA(opts?: { roleFor?: (email: string) => string[] }) {
	const roleFor = opts?.roleFor ?? (() => ['member']);
	const state = writable<MockAuthState>({ loggedIn: false, member: null, roles: [] });
	const authStore = {
		subscribe: state.subscribe,
		login: vi.fn(async (email: string, _password: string) => {
			state.set({ loggedIn: true, member: null, roles: roleFor(email) });
		}),
		register: vi.fn(async () => {
			state.set({ loggedIn: true, member: null, roles: ['member'] });
		}),
		logout: vi.fn(async () => state.set({ loggedIn: false, member: null, roles: [] })),
		hydrate: vi.fn(async () => {})
	};
	return { authStore, isLoggedIn: derived(state, ($s) => $s.loggedIn) };
}

/** 家族 B(__set 後門)：測試直接灌任意 auth state，不經過 login/register 流程——用於
 *  只關心「已登入 + 特定 fixture member」渲染結果的元件測試。withIsLoggedIn 供需要
 *  isLoggedIn 具名 export 的偏差檔(mobile-admin/page)。 */
export function makeAuthMockB(opts?: { withIsLoggedIn?: boolean }) {
	const state = writable<MockAuthState>({ loggedIn: false, member: null, roles: [] });
	const authStore = { subscribe: state.subscribe, __set: state.set };
	return opts?.withIsLoggedIn
		? { authStore, isLoggedIn: derived(state, ($s) => $s.loggedIn) }
		: { authStore };
}
