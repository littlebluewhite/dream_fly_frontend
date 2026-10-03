import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ClassesPage from './+page.svelte';
import { overlay, resetOpsForTests, toasts } from '$lib/mobile-admin/stores';
import type { ValidCourse } from '$lib/admin/components/course-request';
import { mapCourse } from '$lib/admin/api';
import type { CourseResponse, CoachResponse } from '$lib/api/generated';
import { COACHES } from '$lib/testing/seed-fixtures';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { OPS_ROUTES } from '$lib/testing/ops-routes';

/* R15 Task 3a(候選 轉手退役)：改 mock $lib/api/client 的 api()，讓 getOpsCollections/
 * createCourse/updateCourse(stores.ts 直取 $lib/admin/api)走真實
 * fetch adapter。FIXTURE_CLASS 改為 wire 形狀(CourseResponse)，經真實 mapCourse() 映射，
 * 而非手造已映射的 ClassRow。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const WIRE_COACH: CoachResponse = { id: 'co-fixture', user_id: 'u-fixture', name: COACHES[0].name, title: COACHES[0].title, bio: null, experience: null, specialties: COACHES[0].tags, certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '' };
const WIRE_CLASS: CourseResponse = {
	id: 'zz1', name: '測試班級甲', slug: 'zz1', level: 'intermediate', description: null,
	duration_minutes: 90, price_cents: 100000, max_students: 10, min_age: 3, max_age: 5,
	features: [], is_active: true, coach_id: WIRE_COACH.id, category: '幼兒體操',
	schedule_text: '一 10:00', is_highlighted: false, created_at: '', updated_at: '',
	enrolled_count: 5, waitlist_count: 0
};
const FIXTURE_CLASSES = [mapCourse(WIRE_CLASS, new Map([[WIRE_COACH.id, WIRE_COACH.name]]))];

const opsRoutes = (wireClasses: CourseResponse[], wireCoaches: CoachResponse[] = [WIRE_COACH]) => ({
	...OPS_ROUTES,
	'GET /courses?page=1': { courses: wireClasses, total: wireClasses.length, page: 1, per_page: 100 },
	'GET /coaches': wireCoaches
});

beforeEach(() => {
	vi.mocked(api).mockReset();
	vi.mocked(api).mockImplementation(fakeRouter(opsRoutes([WIRE_CLASS])));
	resetOpsForTests();
	overlay.closeAll();
});

afterEach(() => {
	resetOpsForTests();
});

describe('mobile-admin/admin/classes 頁', () => {
	it('loading 分支顯示骨架(data-testid="classes-skeleton")', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
		const { container } = render(ClassesPage);
		expect(container.querySelector('[data-testid="classes-skeleton"]')).not.toBeNull();
	});

	it('async 水合後顯示 $classes store 的班級(相異 fixture)', async () => {
		const { findByText } = render(ClassesPage);
		expect(await findByText('測試班級甲')).toBeInTheDocument();
		expect(await findByText('1 個開課班級 · 本季招生中')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState,且重試會真正重新 fetch(不受 hydrated 守衛短路)', async () => {
		let call = 0;
		vi.mocked(api).mockImplementation(
			fakeRouter({
				...opsRoutes([WIRE_CLASS]),
				'GET /courses?page=1': () => {
					call += 1;
					if (call === 1) throw new Error('boom');
					return { courses: [WIRE_CLASS], total: 1, page: 1, per_page: 100 };
				}
			})
		);
		const { findByText } = render(ClassesPage);
		await findByText('載入失敗');

		await fireEvent.click(await findByText('重新載入'));
		expect(await findByText('測試班級甲')).toBeInTheDocument();
	});

	it('classes 空集合不當機,顯示找不到符合的課程', async () => {
		vi.mocked(api).mockImplementation(fakeRouter(opsRoutes([])));
		const { findByText } = render(ClassesPage);
		expect(await findByText('找不到符合的課程')).toBeInTheDocument();
	});

	/* Task 20 — 新增/編輯班級改接真 POST/PATCH /courses，不再是 saveClass 本地假寫入。
	 * mobile 的 overlay 是全域 store（非頁面自己的元件樹），ClassForm 由另一個
	 * OverlayHost 渲染——這裡不重新渲染 ClassForm，改為直接呼叫「新增班級」按鈕開出的
	 * sheet 所帶入的 onCreate/onUpdate（即頁面自己的 create/update 閉包），驗證它真的打 createCourse/
	 * updateCourse，同 OrderSheet.test.ts 對 mobile overlay 架構的驗證慣例。
	 * R13 Task 4:onCreate/onUpdate 收 ClassForm 驗證過的 ValidCourse。 */
	const COURSE: ValidCourse = {
		name: '新班級', level: '基礎', category: '幼兒體操', coachId: COACHES[0].id, scheduleText: null,
		minAge: null, maxAge: null, maxStudents: 10, price: 1000, durationMinutes: 60
	};
	type SheetSave = {
		onCreate: (c: ValidCourse) => Promise<boolean>;
		onUpdate: (c: ValidCourse) => Promise<boolean>;
	};

	function callCount(method: string, path: string): number {
		return vi.mocked(api).mock.calls.filter(([p, init]) => p === path && (init?.method ?? 'GET') === method).length;
	}

	it('「新增班級」開出的 sheet 帶入真正呼叫 createCourse 的 onCreate（不是本地假寫入）', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...opsRoutes([WIRE_CLASS]), 'POST /courses': { id: 'new-1' } }));
		const { findByText, getByLabelText } = render(ClassesPage);
		await findByText('測試班級甲');

		await fireEvent.click(getByLabelText('新增班級'));
		const sheetProps = get(overlay).sheet?.props as SheetSave;
		expect(sheetProps).toBeTruthy();

		expect(await sheetProps.onCreate(COURSE)).toBe(true);

		expect(callCount('POST', '/courses')).toBe(1);
		const body = JSON.parse(vi.mocked(api).mock.calls.find(([p, init]) => p === '/courses' && init?.method === 'POST')![1]!.body as string);
		expect(body).toMatchObject({ name: '新班級', duration_minutes: 60 });
		expect(callCount('PATCH', `/courses/${FIXTURE_CLASSES[0].id}`)).toBe(0);
	});

	it('編輯既有班級的 sheet 帶入呼叫 updateCourse(id, …) 的 onUpdate', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...opsRoutes([WIRE_CLASS]), [`PATCH /courses/${FIXTURE_CLASSES[0].id}`]: { id: FIXTURE_CLASSES[0].id } })
		);
		const { findByText } = render(ClassesPage);
		await findByText('測試班級甲');

		await fireEvent.click(await findByText('編輯'));
		const sheetProps = get(overlay).sheet?.props as SheetSave;
		expect(sheetProps).toBeTruthy();

		expect(await sheetProps.onUpdate({ ...COURSE, name: '改名後的班級' })).toBe(true);

		expect(callCount('PATCH', `/courses/${FIXTURE_CLASSES[0].id}`)).toBe(1);
		expect(api).toHaveBeenCalledWith(`/courses/${FIXTURE_CLASSES[0].id}`, {
			method: 'PATCH',
			body: expect.stringContaining('"name":"改名後的班級"')
		});
		expect(callCount('POST', '/courses')).toBe(0);
	});

	it('儲存失敗時顯示錯誤 toast，不吞掉例外', async () => {
		vi.mocked(api).mockImplementation(fakeRouter({ ...opsRoutes([WIRE_CLASS]), 'POST /courses': new Error('boom') }));
		const { findByText, getByLabelText } = render(ClassesPage);
		await findByText('測試班級甲');

		await fireEvent.click(getByLabelText('新增班級'));
		const sheetProps = get(overlay).sheet?.props as SheetSave;
		expect(await sheetProps.onCreate(COURSE)).toBe(false);

		expect(get(toasts).some((t) => t.title === '新增失敗')).toBe(true);
	});

	/* trim 回歸釘子若只釘桌面 filter 純函式層,頁面斷開共用 filter 退回舊 inline
	 * 不 trim 邏輯時仍會全綠——這筆測「頁面已接線」本身(同 orders 頁的釘法)。
	 * 共用 fixture 只有一筆,無法區分「過濾後剩一筆」與「沒過濾」,故本 it 局部
	 * mock 兩筆。 */
	it('搜尋框退化查詢走桌面 filterClasses 的 trim 語意:padded 命中、純空白回全部', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter(opsRoutes([WIRE_CLASS, { ...WIRE_CLASS, id: 'zz2', name: '測試班級乙' }]))
		);
		const { findByText, queryByText, getByPlaceholderText } = render(ClassesPage);
		await findByText('測試班級甲');

		const input = getByPlaceholderText('搜尋班級、教練…');
		await fireEvent.input(input, { target: { value: ' 測試班級甲 ' } });
		expect(await findByText('測試班級甲')).toBeInTheDocument();
		expect(queryByText('測試班級乙')).toBeNull();

		await fireEvent.input(input, { target: { value: '   ' } });
		expect(await findByText('測試班級乙')).toBeInTheDocument();
	});
});

describe('mobile-admin/admin/classes 頁 — 分頁誠實(R12 Task 3)', () => {
	it('header 顯示後端 total;total > perPage 時搜尋區提示僅搜尋前 N 筆', async () => {
		vi.mocked(api).mockImplementation(
			fakeRouter({ ...opsRoutes([WIRE_CLASS]), 'GET /courses?page=1': { courses: [WIRE_CLASS], total: 33, page: 1, per_page: 20 } })
		);
		const { findByText } = render(ClassesPage);
		expect(await findByText('33 個開課班級 · 本季招生中')).toBeInTheDocument();
		expect(await findByText('僅搜尋前 20 筆，完整清單請至桌面後台')).toBeInTheDocument();
	});
	it('total <= perPage 時不顯示提示', async () => {
		const { findByText, queryByText } = render(ClassesPage);
		await findByText('1 個開課班級 · 本季招生中');
		expect(queryByText('僅搜尋前 20 筆，完整清單請至桌面後台')).toBeNull();
	});
});
