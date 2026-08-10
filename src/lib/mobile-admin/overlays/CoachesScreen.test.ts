import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CoachesScreen from './CoachesScreen.svelte';
import { createMember, createCoach, updateMember, updateCoach, getOpsCollections } from '$lib/mobile-admin/api';
import type { CoachFormValues } from '$lib/mobile-admin/api';
import { overlay, coaches, toasts, opsHydrated } from '$lib/mobile-admin/stores';
import { COACHES } from '$lib/domain/coaches';
import type { Coach } from '$lib/domain/coaches';
import { ApiError } from '$lib/api/client';

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
 * 把 opsHydrated 設回 false 才 render，驗證 guard 開啟時 onMount 真的會呼叫。 */

vi.mock('$lib/mobile-admin/api', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/mobile-admin/api')>();
	return {
		...actual,
		createMember: vi.fn(),
		createCoach: vi.fn(),
		updateMember: vi.fn(),
		updateCoach: vi.fn(),
		getOpsCollections: vi.fn()
	};
});

const opsFixture = (coachesList: Coach[]) => ({ members: [], classes: [], coaches: coachesList, orders: [] });

beforeEach(() => {
	vi.mocked(createMember).mockReset();
	vi.mocked(createCoach).mockReset();
	vi.mocked(updateMember).mockReset();
	vi.mocked(updateCoach).mockReset();
	vi.mocked(getOpsCollections).mockReset();
	vi.mocked(getOpsCollections).mockResolvedValue(opsFixture(COACHES));
	coaches.set(COACHES);
	overlay.closeAll();
	// R10：opsHydrated 是明文「測試重置縫」(stores.ts)——設為已水合，讓本頁新加的
	// onMount hydrateOps() 因 guard 短路直接 return，不干擾既有的呼叫次數斷言。
	opsHydrated.set(true);
});

afterEach(() => {
	coaches.set(COACHES);
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

describe('CoachesScreen — 新增教練(saveNewCoach 兩步序列：createMember → createCoach)', () => {
	it('兩步皆成功：createCoach 帶正確 user_id 綁定，顯示成功 toast，且 refreshOps 被喚(coaches store 反映最新資料)', async () => {
		vi.mocked(createMember).mockResolvedValue({ id: 'u-new' } as never);
		vi.mocked(createCoach).mockResolvedValue({} as never);
		const refreshed: Coach[] = [
			...COACHES,
			{ id: 'c-new', userId: 'u-new', name: '新教練', initial: '新', title: '兼任教練', color: '#000000', tags: ['地板動作'], isActive: true }
		];
		vi.mocked(getOpsCollections).mockResolvedValue(opsFixture(refreshed));

		const { getByLabelText } = render(CoachesScreen, { props: { onBack: () => {} } });
		await fireEvent.click(getByLabelText('新增教練'));

		await sheetOnSave()(V);

		expect(createMember).toHaveBeenCalledWith({ email: V.email, name: V.name, password: V.password });
		expect(createCoach).toHaveBeenCalledWith({ user_id: 'u-new', title: V.title, specialties: V.tags, is_active: V.isActive });
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'success', title: '已新增教練' });
		expect(get(toasts).at(-1)?.body).toBe('「新教練」已建立為教練。');
		// refreshOps 被喚：getOpsCollections 重新打過一次，coaches store 反映最新資料。
		expect(getOpsCollections).toHaveBeenCalledTimes(1);
		expect(get(coaches)).toEqual(refreshed);
	});

	it('userCreateFailed：createMember 失敗 → 新增失敗 toast 透傳後端訊息，不呼叫 createCoach，不觸發 refreshOps', async () => {
		vi.mocked(createMember).mockRejectedValue(new ApiError(409, 'Email 已被使用'));

		const { getByLabelText } = render(CoachesScreen, { props: { onBack: () => {} } });
		await fireEvent.click(getByLabelText('新增教練'));
		await sheetOnSave()(V);

		expect(createCoach).not.toHaveBeenCalled();
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'error', title: '新增失敗' });
		expect(get(toasts).at(-1)?.body).toBe('Email 已被使用');
		expect(getOpsCollections).not.toHaveBeenCalled();
	});

	it('coachBindFailed：帳號已建立但綁定失敗 → 教練綁定失敗 toast(逐字含確認學員管理頁文案)，且不打第二步重試(pendingUserId 刻意丟棄，第二次呼叫仍重打 createMember，不是只補打 createCoach)', async () => {
		vi.mocked(createMember).mockResolvedValueOnce({ id: 'u-orphan-1' } as never);
		vi.mocked(createCoach).mockRejectedValueOnce(new ApiError(404, 'coach bind target not found'));

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
		expect(createMember).toHaveBeenCalledTimes(1);
		expect(createCoach).toHaveBeenCalledTimes(1);
		expect(getOpsCollections).not.toHaveBeenCalled();

		// 桌面版把這次的 user_id 存回 pendingUserId 哨兵，同一對話框工作階段內重試只
		// 補打第二步(createCoach)；本頁「儲存即關 sheet」沒有這個重試工作階段，
		// pendingUserId 刻意丟棄——同一個 onSave 再呼叫一次仍會從頭重打 createMember。
		vi.mocked(createMember).mockResolvedValueOnce({ id: 'u-orphan-2' } as never);
		vi.mocked(createCoach).mockResolvedValueOnce({} as never);
		await onSave(V);

		expect(createMember).toHaveBeenCalledTimes(2);
		expect(createCoach).toHaveBeenCalledTimes(2);
		expect(vi.mocked(createCoach).mock.calls[1][0]).toMatchObject({ user_id: 'u-orphan-2' });
	});
});

describe('CoachesScreen — 編輯教練(saveCoachEdit)', () => {
	it('姓名未變：只呼叫 updateCoach(不呼叫 updateMember)，成功後顯示 toast 且 refreshOps 被喚', async () => {
		const target = COACHES[0];
		vi.mocked(updateCoach).mockResolvedValue({} as never);
		const refreshed: Coach[] = COACHES.map((c) => (c.id === target.id ? { ...c, title: '改職稱' } : c));
		vi.mocked(getOpsCollections).mockResolvedValue(opsFixture(refreshed));

		const { container } = render(CoachesScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBeGreaterThan(0));
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[0]);

		await sheetOnSave()({ email: '', password: '', name: target.name, title: '改職稱', tags: target.tags, isActive: target.isActive });

		expect(updateMember).not.toHaveBeenCalled();
		expect(updateCoach).toHaveBeenCalledWith(target.id, { title: '改職稱', specialties: target.tags, is_active: target.isActive });
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'success', title: '已儲存' });
		expect(get(toasts).at(-1)?.body).toBe(`${target.name} 教練資料已更新。`);
		expect(getOpsCollections).toHaveBeenCalledTimes(1);
		expect(get(coaches)).toEqual(refreshed);
	});

	it('姓名有變：依序呼叫 updateMember(userId,{name}) 再 updateCoach(id,...)', async () => {
		const target = COACHES[1];
		const callOrder: string[] = [];
		vi.mocked(updateMember).mockImplementation(async () => {
			callOrder.push('updateMember');
			return {} as never;
		});
		vi.mocked(updateCoach).mockImplementation(async () => {
			callOrder.push('updateCoach');
			return {} as never;
		});

		const { container } = render(CoachesScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBeGreaterThan(0));
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[1]);
		await sheetOnSave()({ email: '', password: '', name: '改名教練', title: target.title, tags: target.tags, isActive: target.isActive });

		expect(callOrder).toEqual(['updateMember', 'updateCoach']);
		expect(updateMember).toHaveBeenCalledWith(target.userId, { name: '改名教練' });
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'success', title: '已儲存' });
	});

	it('coachUpdateFailed：updateCoach 失敗(422)→ 儲存失敗 toast 查表文案，不觸發 refreshOps', async () => {
		const target = COACHES[2];
		vi.mocked(updateCoach).mockRejectedValue(new ApiError(422, 'invalid coach payload'));

		const { container } = render(CoachesScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBeGreaterThan(0));
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[2]);
		await sheetOnSave()({ email: '', password: '', name: target.name, title: target.title, tags: target.tags, isActive: target.isActive });

		expect(get(toasts).at(-1)).toMatchObject({ tone: 'error', title: '儲存失敗' });
		expect(get(toasts).at(-1)?.body).toBe('輸入資料不符規則，請確認後再試。');
		expect(getOpsCollections).not.toHaveBeenCalled();
	});

	it('nameUpdateFailed：updateMember 失敗 → 儲存失敗 toast 透傳訊息，不繼續打 updateCoach', async () => {
		const target = COACHES[3];
		vi.mocked(updateMember).mockRejectedValue(new ApiError(422, '姓名不符規則'));

		const { container } = render(CoachesScreen, { props: { onBack: () => {} } });
		await waitFor(() => expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBeGreaterThan(0));
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[3]);
		await sheetOnSave()({ email: '', password: '', name: '改名教練', title: target.title, tags: target.tags, isActive: target.isActive });

		expect(updateCoach).not.toHaveBeenCalled();
		expect(get(toasts).at(-1)).toMatchObject({ tone: 'error', title: '儲存失敗' });
		expect(get(toasts).at(-1)?.body).toBe('姓名不符規則');
		expect(getOpsCollections).not.toHaveBeenCalled();
	});
});

describe('CoachesScreen — 進場水合(R10 修補：admin 首頁→更多頁→本 overlay 動線上此前無人呼叫 hydrateOps，$coachesStore 只見 domain seed)', () => {
	it('opsHydrated 為 false 時開啟即觸發 onMount 的 hydrateOps()：getOpsCollections 被呼叫一次，水合後的教練資料反映到畫面上', async () => {
		opsHydrated.set(false);
		const hydratedCoach: Coach = {
			id: 'c-hydrated',
			userId: 'u-hydrated',
			name: '水合教練',
			initial: '水',
			title: '主任教練',
			color: '#123456',
			tags: ['地板動作'],
			isActive: true
		};
		vi.mocked(getOpsCollections).mockResolvedValue(opsFixture([hydratedCoach]));

		const { getByText } = render(CoachesScreen, { props: { onBack: () => {} } });

		await waitFor(() => {
			expect(getOpsCollections).toHaveBeenCalledTimes(1);
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
		opsHydrated.set(false);
		const d = createDeferred<ReturnType<typeof opsFixture>>();
		vi.mocked(getOpsCollections).mockReturnValue(d.promise);

		const { getByTestId, queryByTestId, container, findByText } = render(CoachesScreen, {
			props: { onBack: () => {} }
		});

		expect(getByTestId('coaches-skeleton')).toBeTruthy();
		expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBe(0);

		d.resolve(opsFixture(COACHES));
		await findByText(COACHES[0].name);

		expect(queryByTestId('coaches-skeleton')).toBeNull();
		expect(container.querySelectorAll('button[aria-label="編輯教練"]').length).toBe(COACHES.length);
	});
});
