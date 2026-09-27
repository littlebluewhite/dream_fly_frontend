import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CoachesScreen from './CoachesScreen.svelte';
import type { CoachFormValues } from '$lib/admin/data';
import { overlay, coaches, toasts, hydrateOps, resetOpsForTests } from '$lib/mobile-admin/stores';
import type { Coach } from '$lib/domain/coaches';
import type { ApiCoach } from '$lib/public/api';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { OPS_ROUTES } from '$lib/testing/ops-routes';
import { MEMBER_COLORS } from '$lib/admin/data';
import { initialOf } from '$lib/api/wire';

/* CoachesScreen.svelte — C3：教練管理 push screen 接上 $lib/admin/components/
 * coach-save.ts 的 saveNewCoach/saveCoachEdit(取代舊有的 inline 兩步序列重抄)。
 *
 * 驗證策略同桌面 routes/admin/coaches/page.test.ts：只 mock 底層
 * createMember/createCoach/updateMember/updateCoach(+ refreshOps 內部依賴的
 * getOpsCollections)，saveNewCoach/saveCoachEdit 本體吃真實實作跑過一次序列——
 * 這樣才是驗證本頁「呼叫 seam → 依 outcome.kind 翻譯 toast → refreshOps」的真實
 * 接線，而不是把 seam 也一起 mock 掉、只驗證呼叫參數。overlay 是全域 store，直接
 * 呼叫 sheet 帶入的 onSave（頁面自己的閉包），不重新渲染 CoachForm.svelte（同
 * mobile-admin/admin/members/page.test.ts 慣例）。
 *
 * R10：本頁 onMount 加了 hydrateOps() 自保呼叫(水合缺口修補，見 CoachesScreen.svelte
 * 檔頭新增註解)。既有 8 it 驗證的是「使用者互動」觸發的 refreshOps，跟 onMount 的
 * hydrateOps 是兩條不同呼叫路徑，但兩者共用同一個 getOpsCollections mock 與
 * opsHydrated guard——beforeEach 先把 opsHydrated 設為 true，讓 onMount 的
 * hydrateOps() 因 guard 短路直接 return，不會偷打 getOpsCollections，才不會弄假紅
 * 既有斷言（:90/:94/:184/:198 四處呼叫次數斷言）。「開啟即水合」測試則反過來，自己
 * 把 opsHydrated 設回 false 才 render，驗證 guard 開啟時 onMount 真的會呼叫。
 *
 * R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，讓
 * createMember/createCoach/updateMember/updateCoach/getOpsCollections(經
 * $lib/mobile-admin/api 轉手 admin/api.ts 實作)一路走真實 fetch adapter。
 * 教練清單的「預期輸出」改用 expectedFromWire()鏡射 admin/api.ts 私有 mapCoach()
 * 的 color/initial 推導(色票依陣列位置 i%MEMBER_COLORS.length 決定，不能沿用
 * $lib/domain/coaches 的 COACHES 手寫色票——那組色票不是逐位置生成，第 8/9 筆
 * 對不上，見 task-3-report.md「Deviations」)。 */

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/** WIRE_COACHES_BASE 逐欄位對齊 $lib/domain/coaches 的 COACHES 9 筆(姓名/職稱/標籤/
 *  在職狀態)，但用真實 wire 形狀(ApiCoach)表達——真正的顯示值(含 color)一律由
 *  expectedFromWire() 經真實 mapCoach() 推導邏輯算出，不手抄。 */
const WIRE_COACHES_BASE: ApiCoach[] = [
	{ id: 'c1', user_id: 'u1', name: '林雅婷', title: '資深競技體操教練 · 國家級認證', bio: null, experience: null, specialties: ['競技啦啦隊', '競技體操'], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '' },
	{ id: 'c2', user_id: 'u2', name: '陳冠宇', title: '兒童體操主教練 · 體操C級教練', bio: null, experience: null, specialties: ['兒童基礎', '幼兒體操'], certifications: [], is_active: true, display_order: 2, slug: null, photo_url: null, created_at: '' },
	{ id: 'c3', user_id: 'u3', name: '黃詩涵', title: '幼兒啟蒙教練 · 幼兒體適能認證', bio: null, experience: null, specialties: ['幼兒體操', '親子課'], certifications: [], is_active: true, display_order: 3, slug: null, photo_url: null, created_at: '' },
	{ id: 'c4', user_id: 'u4', name: '王思齊', title: '跑酷與成人體操教練', bio: null, experience: null, specialties: ['跑酷', '成人體操'], certifications: [], is_active: false, display_order: 4, slug: null, photo_url: null, created_at: '' },
	{ id: 'c5', user_id: 'u5', name: '張育誠', title: '競技啦啦隊助理教練', bio: null, experience: null, specialties: ['競技啦啦隊'], certifications: [], is_active: false, display_order: 5, slug: null, photo_url: null, created_at: '' },
	{ id: 'c6', user_id: 'u6', name: '周曉彤', title: '競技啦啦隊編排教練 · 啦啦隊 B 級', bio: null, experience: null, specialties: ['競技啦啦隊'], certifications: [], is_active: true, display_order: 6, slug: null, photo_url: null, created_at: '' },
	{ id: 'c7', user_id: 'u7', name: '蘇建宏', title: '體能與跑酷專項教練 · 體適能C級', bio: null, experience: null, specialties: ['跑酷', '成人體操'], certifications: [], is_active: true, display_order: 7, slug: null, photo_url: null, created_at: '' },
	{ id: 'c8', user_id: 'u8', name: '李孟潔', title: '幼兒啟蒙教練 · 幼兒體適能認證', bio: null, experience: null, specialties: ['幼兒體操', '親子課'], certifications: [], is_active: true, display_order: 8, slug: null, photo_url: null, created_at: '' },
	{ id: 'c9', user_id: 'u9', name: '鄭凱文', title: '成人體操與體能教練 · 重訓專項', bio: null, experience: null, specialties: ['成人體操', '跑酷'], certifications: [], is_active: true, display_order: 9, slug: null, photo_url: null, created_at: '' }
];

/** 鏡射 admin/api.ts 私有 mapCoach()：color 依陣列位置 i % MEMBER_COLORS.length。 */
function expectedFromWire(wire: ApiCoach[]): Coach[] {
	return wire.map((c, i) => ({
		id: c.id,
		userId: c.user_id,
		name: c.name,
		initial: initialOf(c.name),
		title: c.title,
		color: MEMBER_COLORS[i % MEMBER_COLORS.length],
		tags: c.specialties,
		isActive: c.is_active
	}));
}

const SEED_COACHES: Coach[] = expectedFromWire(WIRE_COACHES_BASE);

/** POST/PATCH /users 回應皆是完整 ApiUserAccount(admin/data.ts)——createMember/
 *  updateMember 拿到回應後立刻經 mapMemberAccount() 映射，缺欄位(name/created_at
 *  等)會在映射時炸掉，故 fixture 一律給滿欄位，不只給 id。 */
const apiUserAccount = (over: Partial<{ id: string; name: string }> = {}) => ({
	id: 'u-x', name: '新教練', phone: null, created_at: '2026-01-01T00:00:00Z', is_active: true, points_balance: 0,
	...over
});

/** getOpsCollections() 平行拉取的其餘三路端點沿用 OPS_ROUTES 預設值(內容與本檔
 *  斷言無關)，只覆寫 GET /coaches。 */
const opsRoutes = (wireCoaches: ApiCoach[]) => ({ ...OPS_ROUTES, 'GET /coaches': wireCoaches });

beforeEach(async () => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter(opsRoutes(WIRE_COACHES_BASE)));
	coaches.set(SEED_COACHES);
	overlay.closeAll();
	// R10：先水合(旗標唯讀,R15 起經 fixture 真水合),讓本頁新加的 onMount hydrateOps()
	// 因 guard 短路直接 return，不干擾既有的呼叫次數斷言。
	resetOpsForTests();
	await hydrateOps();
	vi.mocked(api).mockClear();
});

afterEach(() => {
	coaches.set(SEED_COACHES);
	overlay.closeAll();
});

const V: CoachFormValues = {
	email: 'coach@test.com',
	password: 'password123',
	name: '新教練',
	title: '兼任教練',
	tags: ['地板動作'],
	isActive: true
};

/** 從目前開啟的 sheet 取出頁面帶入的 onSave 閉包（同 mobile-admin/admin/members/
 *  page.test.ts 對 sheetProps.onSave 的取用慣例）。 */
function sheetOnSave(): (v: CoachFormValues) => Promise<void> {
	const props = get(overlay).sheet?.props as { onSave: (v: CoachFormValues) => Promise<void> } | undefined;
	if (!props) throw new Error('沒有開啟中的 sheet');
	return props.onSave;
}

function callCount(method: string, path: string): number {
	return vi.mocked(api).mock.calls.filter(([p, init]) => p === path && (init?.method ?? 'GET') === method).length;
}

describe('CoachesScreen — 新增教練(saveNewCoach 兩步序列：createMember → createCoach)', () => {
	it('兩步皆成功：createCoach 帶正確 user_id 綁定，顯示成功 toast，且 refreshOps 被喚(coaches store 反映最新資料)', async () => {
		const newWire: ApiCoach = { id: 'c-new', user_id: 'u-new', name: '新教練', title: '兼任教練', bio: null, experience: null, specialties: ['地板動作'], certifications: [], is_active: true, display_order: 10, slug: null, photo_url: null, created_at: '' };
		const refreshedWire = [...WIRE_COACHES_BASE, newWire];
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'POST /users': apiUserAccount({ id: 'u-new' }),
				'POST /coaches': {},
				...opsRoutes(refreshedWire)
			})
		);

		const { getByLabelText } = render(CoachesScreen, { props: { onBack: () => {} } });
		await fireEvent.click(getByLabelText('新增教練'));

		await sheetOnSave()(V);

		expect(api).toHaveBeenCalledWith('/users', { method: 'POST', body: JSON.stringify({ email: V.email, name: V.name, password: V.password }) });
		expect(api).toHaveBeenCalledWith('/coaches', { method: 'POST', body: JSON.stringify({ user_id: 'u-new', title: V.title, specialties: V.tags, is_active: V.isActive }) });
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'success', title: '已新增教練' });
		expect(get(toasts).at(-1)?.body).toBe('「新教練」已建立為教練。');
		// refreshOps 被喚：getOpsCollections 重新打過一次(GET /coaches 屬其中一路)，coaches store 反映最新資料。
		expect(callCount('GET', '/coaches')).toBe(1);
		expect(get(coaches)).toEqual(expectedFromWire(refreshedWire));
	});

	it('userCreateFailed：createMember 失敗 → 新增失敗 toast 透傳後端訊息，不呼叫 createCoach，不觸發 refreshOps', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'POST /users': new ApiError(409, 'Email 已被使用'), ...opsRoutes(WIRE_COACHES_BASE) })
		);

		const { getByLabelText } = render(CoachesScreen, { props: { onBack: () => {} } });
		await fireEvent.click(getByLabelText('新增教練'));
		await sheetOnSave()(V);

		expect(callCount('POST', '/coaches')).toBe(0);
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'error', title: '新增失敗' });
		expect(get(toasts).at(-1)?.body).toBe('Email 已被使用');
		expect(callCount('GET', '/coaches')).toBe(0);
	});

	it('coachBindFailed：帳號已建立但綁定失敗 → 教練綁定失敗 toast(逐字含確認學員管理頁文案)，且不打第二步重試(pendingUserId 刻意丟棄，第二次呼叫仍重打 createMember，不是只補打 createCoach)', async () => {
		let createMemberCalls = 0;
		let createCoachCalls = 0;
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'POST /users': () => {
					createMemberCalls += 1;
					return apiUserAccount({ id: createMemberCalls === 1 ? 'u-orphan-1' : 'u-orphan-2' });
				},
				'POST /coaches': () => {
					createCoachCalls += 1;
					if (createCoachCalls === 1) throw new ApiError(404, 'coach bind target not found');
					return {};
				},
				...opsRoutes(WIRE_COACHES_BASE)
			})
		);

		const { getByLabelText } = render(CoachesScreen, { props: { onBack: () => {} } });
		await fireEvent.click(getByLabelText('新增教練'));
		const onSave = sheetOnSave();
		await onSave(V);

		expect(get(toasts).at(-1)).toMatchObject({ tone: 'error', title: '教練綁定失敗' });
		// 文案指引「換一個 email」——本頁沒有 pendingUserId 哨兵，若只說「重新新增一次
		// 教練」不夠明確，使用者拿同一個 email 重試會在 createMember 撞 409(同
		// ADR 0018 該段裁決文字；不可沿用桌面「重新點擊建立教練重試」的語意，桌面有
		// 哨兵可以只補打第二步，本頁沒有)。
		expect(get(toasts).at(-1)?.body).toBe(
			'帳號「coach@test.com」已建立，但綁定教練身分失敗（找不到對應的使用者帳號。）。請至「學員管理」頁確認該帳號，或重新執行一次新增教練（換一個 email）。'
		);
		expect(createMemberCalls).toBe(1);
		expect(createCoachCalls).toBe(1);
		expect(callCount('GET', '/coaches')).toBe(0);

		// 桌面版把這次的 user_id 存回 pendingUserId 哨兵，同一對話框工作階段內重試只
		// 補打第二步(createCoach)；本頁「儲存即關 sheet」沒有這個重試工作階段，
		// pendingUserId 刻意丟棄——同一個 onSave 再呼叫一次仍會從頭重打 createMember。
		await onSave(V);

		expect(createMemberCalls).toBe(2);
		expect(createCoachCalls).toBe(2);
		const secondCoachBody = JSON.parse(
			vi.mocked(api).mock.calls.filter(([p, init]) => p === '/coaches' && init?.method === 'POST')[1][1]!.body as string
		);
		expect(secondCoachBody).toMatchObject({ user_id: 'u-orphan-2' });
	});
});

describe('CoachesScreen — 編輯教練(saveCoachEdit)', () => {
	it('姓名未變：只呼叫 updateCoach(不呼叫 updateMember)，成功後顯示 toast 且 refreshOps 被喚', async () => {
		const target = SEED_COACHES[0];
		const refreshedWire = WIRE_COACHES_BASE.map((c) => (c.id === target.id ? { ...c, title: '改職稱' } : c));
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PATCH /coaches/c1': {}, ...opsRoutes(refreshedWire) })
		);

		const { container } = render(CoachesScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBeGreaterThan(0));
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[0]);

		await sheetOnSave()({ email: '', password: '', name: target.name, title: '改職稱', tags: target.tags, isActive: target.isActive });

		expect(callCount('PATCH', '/users/u1')).toBe(0);
		expect(api).toHaveBeenCalledWith('/coaches/c1', { method: 'PATCH', body: JSON.stringify({ title: '改職稱', specialties: target.tags, is_active: target.isActive }) });
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'success', title: '已儲存' });
		expect(get(toasts).at(-1)?.body).toBe(`${target.name} 教練資料已更新。`);
		expect(callCount('GET', '/coaches')).toBe(1);
		expect(get(coaches)).toEqual(expectedFromWire(refreshedWire));
	});

	it('姓名有變：依序呼叫 updateMember(userId,{name}) 再 updateCoach(id,...)', async () => {
		const target = SEED_COACHES[1];
		const callOrder: string[] = [];
		vi.mocked(api).mockImplementation(
			fakeRouter({
				'PATCH /users/u2': () => {
					callOrder.push('updateMember');
					return apiUserAccount({ id: 'u2', name: '改名教練' });
				},
				'PATCH /coaches/c2': () => {
					callOrder.push('updateCoach');
					return {};
				},
				...opsRoutes(WIRE_COACHES_BASE)
			})
		);

		const { container } = render(CoachesScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBeGreaterThan(0));
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[1]);
		await sheetOnSave()({ email: '', password: '', name: '改名教練', title: target.title, tags: target.tags, isActive: target.isActive });

		expect(callOrder).toEqual(['updateMember', 'updateCoach']);
		expect(api).toHaveBeenCalledWith('/users/u2', { method: 'PATCH', body: JSON.stringify({ name: '改名教練' }) });
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'success', title: '已儲存' });
	});

	it('coachUpdateFailed：updateCoach 失敗(422)→ 儲存失敗 toast 查表文案，不觸發 refreshOps', async () => {
		const target = SEED_COACHES[2];
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PATCH /coaches/c3': new ApiError(422, 'invalid coach payload'), ...opsRoutes(WIRE_COACHES_BASE) })
		);

		const { container } = render(CoachesScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBeGreaterThan(0));
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[2]);
		await sheetOnSave()({ email: '', password: '', name: target.name, title: target.title, tags: target.tags, isActive: target.isActive });

		expect(get(toasts).at(-1)).toMatchObject({ tone: 'error', title: '儲存失敗' });
		expect(get(toasts).at(-1)?.body).toBe('輸入資料不符規則，請確認後再試。');
		expect(callCount('GET', '/coaches')).toBe(0);
	});

	it('nameUpdateFailed：updateMember 失敗 → 儲存失敗 toast 透傳訊息，不繼續打 updateCoach', async () => {
		const target = SEED_COACHES[3];
		vi.mocked(api).mockImplementation(
			fakeRouter({ 'PATCH /users/u4': new ApiError(422, '姓名不符規則'), ...opsRoutes(WIRE_COACHES_BASE) })
		);

		const { container } = render(CoachesScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBeGreaterThan(0));
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[3]);
		await sheetOnSave()({ email: '', password: '', name: '改名教練', title: target.title, tags: target.tags, isActive: target.isActive });

		expect(callCount('PATCH', '/coaches/c4')).toBe(0);
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'error', title: '儲存失敗' });
		expect(get(toasts).at(-1)?.body).toBe('姓名不符規則');
		expect(callCount('GET', '/coaches')).toBe(0);
	});
});

describe('CoachesScreen — 進場水合(R10 修補：admin 首頁→更多頁→本 overlay 動線上此前無人呼叫 hydrateOps，$coachesStore 只見 domain seed)', () => {
	it('opsHydrated 為 false 時開啟即觸發 onMount 的 hydrateOps()：getOpsCollections 被呼叫一次，水合後的教練資料反映到畫面上', async () => {
		resetOpsForTests();
		const hydratedWire: ApiCoach = { id: 'c-hydrated', user_id: 'u-hydrated', name: '水合教練', title: '主任教練', bio: null, experience: null, specialties: ['地板動作'], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '' };
		vi.mocked(api).mockImplementation(fakeRouter(opsRoutes([hydratedWire])));

		const { getByText } = render(CoachesScreen, { props: { onBack: () => {} } });

		await waitFor(() => {
			expect(callCount('GET', '/coaches')).toBe(1);
			expect(getByText('水合教練')).toBeInTheDocument();
		});
	});
});

/** 手動控時序的 deferred promise(抄 mobile-admin/stores.test.ts 的 createDeferred 寫法)——
 *  下面的 loading 態測試需要「先掛住斷言骨架、再 resolve 斷言列表現身」兩階段，VenuesScreen
 *  既有 loading 測試用的 `new Promise(() => {})`(永不 resolve)不夠用。 */
function createDeferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((res) => {
		resolve = res;
	});
	return { promise, resolve };
}

describe('CoachesScreen — 載入(createLoadGate 三態,fetch=hydrateOps 經 getOpsCollections)', () => {
	it('loading：opsHydrated 為 false 時顯示骨架、無編輯鉛筆按鈕；resolve 後列表現身、骨架消失', async () => {
		resetOpsForTests();
		const d = createDeferred<ApiCoach[]>();
		vi.mocked(api).mockImplementation(fakeRouter({ ...opsRoutes(WIRE_COACHES_BASE), 'GET /coaches': () => d.promise }));

		const { getByTestId, queryByTestId, container, findByText } = render(CoachesScreen, {
			props: { onBack: () => {} }
		});

		expect(getByTestId('coaches-skeleton')).toBeTruthy();
		expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBe(0);

		d.resolve(WIRE_COACHES_BASE);
		await findByText(SEED_COACHES[0].name);

		expect(queryByTestId('coaches-skeleton')).toBeNull();
		expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBe(SEED_COACHES.length);
	});

	it('error:getOpsCollections 失敗 → ErrorState「載入失敗」、無編輯鉛筆;點「重新載入」→ refreshOps 重打,成功後列表恢復', async () => {
		resetOpsForTests();
		// 第一打(hydrateOps)失敗;重試的第二打落回正常的 WIRE_COACHES_BASE。
		let call = 0;
		vi.mocked(api).mockImplementation(
			fakeRouter({
				...opsRoutes(WIRE_COACHES_BASE),
				'GET /coaches': () => {
					call += 1;
					if (call === 1) throw new Error('network');
					return WIRE_COACHES_BASE;
				}
			})
		);

		const { findByText, getByRole, queryByTestId, container } = render(CoachesScreen, {
			props: { onBack: () => {} }
		});

		await findByText('載入失敗');
		expect(queryByTestId('coaches-skeleton')).toBeNull();
		expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBe(0);

		await fireEvent.click(getByRole('button', { name: /重新載入/ }));
		await findByText(SEED_COACHES[0].name);

		expect(call).toBe(2);
		expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBe(SEED_COACHES.length);
	});
});
