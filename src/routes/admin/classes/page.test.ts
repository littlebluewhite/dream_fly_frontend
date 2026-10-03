import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ClassesPage from './+page.svelte';
import { COACHES } from '$lib/testing/seed-fixtures';
import type { CoachResponse, CourseResponse } from '$lib/api/generated';
import { api, ApiError } from '$lib/api/client';
import { toasts } from '$lib/admin/stores';
import { fakeRouter } from '$lib/testing/fake-router';
import { ADMIN_ROUTES, apiBody, apiCalls } from '$lib/testing/admin-routes';
import { coachResponse, courseResponse } from '$lib/testing/wire-fixtures';

/* W-8：改 mock $lib/api/client 的 api()，getClasses/createCourse/updateCourse 走真
 * mapper(GET /courses?page=n × GET /coaches、POST /courses、PATCH /courses/{id})。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

/* 與真 COACHES 完全不同的自造教練 fixture — 可證偽的關鍵:ClassEditDialog 的
 * coaches prop 預設值是真 COACHES,若頁面漏綁 `{coaches}`,對話框會靜默退回
 * 預設值;用同參照的 COACHES 當 mock payload 就永遠測不出這個漏綁。 */
const FIXTURE_COACHES: CoachResponse[] = [
	coachResponse({ id: 'cx1', user_id: 'ux1', name: '測試教練甲', title: '單元測試專用' }),
	coachResponse({ id: 'cx2', user_id: 'ux2', name: '測試教練乙', title: '單元測試專用', is_active: false })
];

// Task 1(C2 死種子退役):admin/data.ts 的 CLASSES(值)已退役——改為檔內 inline
// fixture(3 筆,沿用真實種子前三列的欄位值)。R13 Task 4:教練綁 FIXTURE_COACHES
// ——對話框現在會驗證「教練在清單裡」,對不上的列存不了。W-8:改為 wire 形狀。
const CLASSES: CourseResponse[] = [
	courseResponse({ id: 'k1', name: '競技啦啦隊 進階班', level: 'advanced', category: '競技啦啦隊', coach_id: 'cx1', schedule_text: '週二、四 19:00-20:30', enrolled_count: 11, max_students: 12, min_age: 10, max_age: 16, price_cents: 480000 }),
	courseResponse({ id: 'k2', name: '兒童基礎 B 班', level: 'intermediate', category: '兒童基礎', coach_id: 'cx2', schedule_text: '週一、三 17:30-18:30', enrolled_count: 8, max_students: 10, min_age: 7, max_age: 9, price_cents: 320000 }),
	courseResponse({ id: 'k3', name: '幼兒體操 啟蒙班', level: 'foundation', category: '幼兒體操', coach_id: 'cx1', schedule_text: '週六 10:00-11:00', enrolled_count: 6, max_students: 8, min_age: 3, max_age: 5, price_cents: 280000 })
];

const page = (courses: CourseResponse[], n: number, total = courses.length) => ({ courses, total, page: n, per_page: 20 });

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter({ 'GET /courses?page=1': page(CLASSES, 1), 'GET /coaches': FIXTURE_COACHES, ...overrides }, ADMIN_ROUTES)
	);

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

/* 課程管理 (admin.jsx ClassesView): PageHead + category chips + a card grid over
 * CLASSES; 編輯 / 新增課程 open the ClassEditDialog (授課教練 Select sourced from
 * the GET /coaches payload). Data now arrives through the seam (async), so every
 * assertion first awaits the ready phase. */
describe('課程管理 (+page)', () => {
	it('renders the PageHead title and 新增課程 action', async () => {
		const { container, findByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('課程管理');
		expect(txt).toContain('新增課程');
	});

	it('renders every class name from CLASSES', async () => {
		const { container, findByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		const txt = container.textContent ?? '';
		for (const k of CLASSES) {
			expect(txt).toContain(k.name);
		}
	});

	/* Validates the coaches seam payload actually reaches ClassEditDialog: the
	 * 授課教練 Select must list EXACTLY the mock fixture's names (which exist
	 * nowhere else). If the page forgets to pass `{coaches}`, the dialog falls
	 * back to its default (the real COACHES) and this assertion goes red. */
	it('opens the ClassEditDialog (編輯) with the 授課教練 Select wired to the seam payload', async () => {
		const { getAllByText, getByText, getByLabelText, findByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		await fireEvent.click(getAllByText('編輯')[0]);
		expect(getByText('編輯課程')).toBeInTheDocument();

		const coachSelect = getByLabelText('授課教練') as HTMLSelectElement;
		const optionLabels = [...coachSelect.options].map((o) => o.textContent);
		expect(optionLabels).toEqual(['測試教練甲', '測試教練乙']); // 只可能來自 mock payload
		expect(optionLabels).not.toContain(COACHES[0].name); // 且絕非對話框的預設 COACHES
	});

	it('opens the ClassEditDialog in new mode (新增班級) when the header 新增課程 is clicked', async () => {
		const { getByText, queryByText, findByText } = render(ClassesPage);
		await findByText('新增課程');
		expect(queryByText('建立班級')).toBeNull();
		await fireEvent.click(getByText('新增課程'));
		expect(getByText('建立班級')).toBeInTheDocument();
	});
});

describe('課程管理 — 新增/編輯接真 API（Task 8 piece 1：POST/PATCH /courses）', () => {
	it('新增課程：填寫班級名稱後點擊建立班級，POST /courses 並把回應映射回列表', async () => {
		const created = courseResponse({ id: 'c-new', name: '新班級', level: 'intermediate', category: '兒童基礎' });
		route({ 'POST /courses': created });

		const { getByText, getByLabelText, findByText, queryByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		await fireEvent.click(getByText('新增課程'));
		await fireEvent.input(getByLabelText('班級名稱'), { target: { value: '新班級' } });
		await fireEvent.click(getByText('建立班級'));

		await findByText('新班級'); // 回應映射進列表後才會出現

		expect(apiCalls('POST /courses')).toHaveLength(1);
		const body = apiBody('POST /courses') as Record<string, unknown>;
		expect(body.name).toBe('新班級');
		expect(body.price_cents).toBe(320000); // toCents(3200)，blankClass 預設季費
		expect(body.max_students).toBe(12);
		expect(body.duration_minutes).toBe(90); // 單堂時長預設 90

		// 對話框已關閉（建立班級按鈕消失）
		expect(queryByText('建立班級')).toBeNull();
	});

	it('編輯課程：點擊儲存課程，PATCH /courses/{真實 id} 並把回應映射回該列；FE#18 編輯模式時長欄位可改且會送出新值', async () => {
		const target = CLASSES[0];
		const updated = { ...target, name: '改名後的班級', duration_minutes: 75, price_cents: 500000 };
		route({ [`PATCH /courses/${target.id}`]: updated });

		const { getByText, getAllByText, getByLabelText, findByText } = render(ClassesPage);
		await findByText(target.name);
		await fireEvent.click(getAllByText('編輯')[0]);
		// FE#18：時長欄位過去只在新增模式顯示，編輯模式現在也要看得到、改得到，且
		// 預設值來自這堂課自己的 durationMinutes（不是新增模式的寫死 90）。
		const durationInput = getByLabelText('單堂時長（分鐘）') as HTMLInputElement;
		expect(durationInput).toHaveValue(String(target.duration_minutes));
		await fireEvent.input(getByLabelText('班級名稱'), { target: { value: '改名後的班級' } });
		await fireEvent.input(durationInput, { target: { value: '75' } });
		await fireEvent.click(getByText('儲存課程'));

		await findByText('改名後的班級');

		expect(apiCalls(`PATCH /courses/${target.id}`)).toHaveLength(1); // 真實 id，非 order_number 那種替代鍵
		const body = apiBody(`PATCH /courses/${target.id}`) as Record<string, unknown>;
		expect(body.name).toBe('改名後的班級');
		// FE#18：編輯流程現在也收集單堂時長，並隨 PATCH body 送出（改過的新值）。
		expect(body.duration_minutes).toBe(75);
	});

	it('新增課程失敗（409 課程已存在）→ 顯示繁中錯誤 toast，對話框維持開啟，列表不變', async () => {
		route({ 'POST /courses': new ApiError(409, 'course slug already exists') });
		const before = get(toasts).length;

		const { getByText, getByLabelText, findByText, queryByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		await fireEvent.click(getByText('新增課程'));
		await fireEvent.input(getByLabelText('班級名稱'), { target: { value: '重複班級' } });
		await fireEvent.click(getByText('建立班級'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('已存在');
		expect(queryByText('重複班級')).toBeNull(); // 未進入列表
		expect(getByText('建立班級')).toBeInTheDocument(); // 對話框仍開著，可修正重試
	});

	it('編輯課程失敗（422 驗證）→ 顯示繁中錯誤 toast，列表維持原值', async () => {
		route({ [`PATCH /courses/${CLASSES[0].id}`]: new ApiError(422, 'invalid course level') });
		const before = get(toasts).length;

		const { getByText, getAllByText, findByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		await fireEvent.click(getAllByText('編輯')[0]);
		await fireEvent.click(getByText('儲存課程'));

		await vi.waitFor(() => expect(get(toasts).length).toBe(before + 1));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('不符規則');
		expect(await findByText(CLASSES[0].name)).toBeInTheDocument(); // 原名稱仍在
	});
});

describe('課程管理 — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		route({ 'GET /courses?page=1': new Error('network') });
		const { findByText } = render(ClassesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(ClassesPage);
		expect(getByTestId('classes-skeleton')).toBeTruthy();
	});
});

describe('課程管理 — 分頁（Task 17：PaginationBar 接上 GET /courses 的 total/page/per_page）', () => {
	it('依 GET /courses 回應渲染「第 x 頁，共 M 筆」（含 sub 標題），邊界頁按鈕 disabled', async () => {
		route({ 'GET /courses?page=1': page(CLASSES, 1, 45) });
		const { container, findByText, getByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);

		expect(getByText('第 1 頁，共 45 筆')).toBeInTheDocument();
		expect(container.textContent).toContain('45 個開課班級'); // sub 標題改用 total，不是 classes.length
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('點擊下一頁 → GET /courses?page=2，並依新回應重新渲染清單與頁碼', async () => {
		route({ 'GET /courses?page=1': page(CLASSES, 1, 45), 'GET /courses?page=2': page([CLASSES[0]], 2, 45) });
		const { findByText, getByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);

		await fireEvent.click(getByText('下一頁'));

		await findByText('第 2 頁，共 45 筆');
		expect(apiCalls('GET /courses?page=2')).toHaveLength(1);
	});

	it('最末頁時下一頁 disabled', async () => {
		// ceil(45/20) = 3 頁
		route({ 'GET /courses?page=1': page(CLASSES, 3, 45) });
		const { findByText, getByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);

		expect(getByText('第 3 頁，共 45 筆')).toBeInTheDocument();
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});
});

describe('課程管理 — 複審修復（Finding 1）：搜尋/篩選僅作用於目前頁面的提示', () => {
	const HINT = '搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。';

	it('total > perPage（還有下一頁）時顯示提示', async () => {
		route({ 'GET /courses?page=1': page(CLASSES, 1, 45) });
		const { findByText, getByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		expect(getByText(HINT)).toBeInTheDocument();
	});

	it('total <= perPage（只有一頁）時不顯示提示，避免全部資料一頁裝得下時的多餘雜訊', async () => {
		route({ 'GET /courses?page=1': page(CLASSES, 1, 20) });
		const { findByText, queryByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);
		expect(queryByText(HINT)).toBeNull();
	});
});

describe('課程管理 — 複審修復（Finding 3）：換頁失敗後重試對到正確頁碼', () => {
	it('換到第 2 頁失敗 → 點「重新載入」重試 → 以第 2 頁（而非第 1 頁）重新 GET /courses', async () => {
		let page2Calls = 0;
		route({
			'GET /courses?page=1': page(CLASSES, 1, 45),
			'GET /courses?page=2': () => (++page2Calls === 1 ? new Error('network') : page(CLASSES, 2, 45))
		});
		const { findByText, getByText } = render(ClassesPage);
		await findByText(CLASSES[0].name);

		await fireEvent.click(getByText('下一頁')); // page 1 → 2，此次請求失敗
		await findByText('載入失敗');

		await fireEvent.click(getByText('重新載入')); // 重試

		await findByText('第 2 頁，共 45 筆');
		expect(apiCalls('GET /courses?page=2')).toHaveLength(2); // 重試對到失敗當下的目標頁，不是退回第 1 頁
		expect(apiCalls('GET /courses?page=1')).toHaveLength(1);
	});
});
