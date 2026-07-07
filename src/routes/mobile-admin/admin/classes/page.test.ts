import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ClassesPage from './+page.svelte';
import { getOpsCollections, createCourse, updateCourse } from '$lib/mobile-admin/api';
import { classes, members, coaches, orders, overlay, opsHydrated, saveClass, toasts } from '$lib/mobile-admin/stores';
import { CLASSES, MEMBERS, COACHES, ORDERS } from '$lib/mobile-admin/data';
import type { ClassRow } from '$lib/mobile-admin/data';

vi.mock('$lib/mobile-admin/api', () => ({
	getOpsCollections: vi.fn(),
	createCourse: vi.fn(),
	updateCourse: vi.fn()
}));

// 與 seed 相異的 fixture(班級名稱皆改過),證明頁面讀 hydrateOps() 水合後的
// $classes store,而非殘留的同步 seed 巧合通過。
const FIXTURE_CLASSES: ClassRow[] = [
	{
		id: 'zz1', name: '測試班級甲', level: '基礎', cat: '幼兒體操', coach: '測試教練', room: '測試教室',
		day: '一', time: '10:00', enrolled: 5, cap: 10, age: '3-5', price: 1000, status: '招生中',
		wait: 0, term: '2026 春季', sessions: 12, startDate: '2026/03/01', checkinRate: 90, makeup: 0,
		durationMinutes: 90
	}
];
const OPS_FIXTURE = { members: MEMBERS, classes: FIXTURE_CLASSES, coaches: COACHES, orders: ORDERS };

beforeEach(() => {
	vi.mocked(getOpsCollections).mockReset();
	vi.mocked(getOpsCollections).mockResolvedValue(OPS_FIXTURE);
	vi.mocked(createCourse).mockReset();
	vi.mocked(updateCourse).mockReset();
	opsHydrated.set(false);
	members.set(MEMBERS);
	classes.set(CLASSES);
	coaches.set(COACHES);
	orders.set(ORDERS);
	overlay.closeAll();
});

afterEach(() => {
	opsHydrated.set(false);
	members.set(MEMBERS);
	classes.set(CLASSES);
	coaches.set(COACHES);
	orders.set(ORDERS);
});

describe('mobile-admin/admin/classes 頁', () => {
	it('loading 分支顯示骨架(data-testid="classes-skeleton")', () => {
		vi.mocked(getOpsCollections).mockReturnValue(new Promise(() => {}));
		const { container } = render(ClassesPage);
		expect(container.querySelector('[data-testid="classes-skeleton"]')).not.toBeNull();
	});

	it('async 水合後顯示 $classes store 的班級(相異 fixture)', async () => {
		const { findByText } = render(ClassesPage);
		expect(await findByText('測試班級甲')).toBeInTheDocument();
		expect(await findByText('1 個開課班級 · 本季招生中')).toBeInTheDocument();
	});

	it('載入失敗顯示 ErrorState,且重試會真正重新 fetch(不受 hydrated 守衛短路)', async () => {
		vi.mocked(getOpsCollections).mockRejectedValueOnce(new Error('boom'));
		const { findByText } = render(ClassesPage);
		await findByText('載入失敗');

		vi.mocked(getOpsCollections).mockResolvedValueOnce(OPS_FIXTURE);
		await fireEvent.click(await findByText('重新載入'));
		expect(await findByText('測試班級甲')).toBeInTheDocument();
	});

	it('classes 空集合不當機,顯示找不到符合的課程', async () => {
		vi.mocked(getOpsCollections).mockResolvedValue({ members: MEMBERS, classes: [], coaches: COACHES, orders: ORDERS });
		const { findByText } = render(ClassesPage);
		expect(await findByText('找不到符合的課程')).toBeInTheDocument();
	});

	it('水合後的 overlay 新增(saveClass)在「第二次進頁」不被清掉(guard 保護)', async () => {
		const { findByText, unmount } = render(ClassesPage);
		await findByText('測試班級甲');
		expect(get(opsHydrated)).toBe(true);

		saveClass({ ...FIXTURE_CLASSES[0], id: '', name: '使用者剛新增的班級' }, true);
		unmount();

		// 模擬重新進頁:onMount 再次呼叫 hydrateOps(),guard 已 true 應短路。
		const { findByText: findByText2 } = render(ClassesPage);
		expect(await findByText2('使用者剛新增的班級')).toBeInTheDocument();
	});

	/* Task 20 — 新增/編輯班級改接真 POST/PATCH /courses，不再是 saveClass 本地假寫入。
	 * mobile 的 overlay 是全域 store（非頁面自己的元件樹），ClassForm 由另一個
	 * OverlayHost 渲染——這裡不重新渲染 ClassForm，改為直接呼叫「新增班級」按鈕開出的
	 * sheet 所帶入的 onSave（即頁面自己的 save() 閉包），驗證它真的打 createCourse/
	 * updateCourse，同 OrderSheet.test.ts 對 mobile overlay 架構的驗證慣例。 */
	it('「新增班級」開出的 sheet 帶入真正呼叫 createCourse 的 onSave（不是本地假寫入）', async () => {
		vi.mocked(createCourse).mockResolvedValue({ id: 'new-1' } as never);
		const { findByText, getByLabelText } = render(ClassesPage);
		await findByText('測試班級甲');

		await fireEvent.click(getByLabelText('新增班級'));
		const sheetProps = get(overlay).sheet?.props as { onSave: (r: ClassRow, d: number, isNew: boolean) => Promise<void> };
		expect(sheetProps).toBeTruthy();

		await sheetProps.onSave({ ...FIXTURE_CLASSES[0], id: '', name: '新班級' }, 60, true);

		expect(createCourse).toHaveBeenCalledTimes(1);
		expect(vi.mocked(createCourse).mock.calls[0][0]).toMatchObject({ name: '新班級', duration_minutes: 60 });
		expect(updateCourse).not.toHaveBeenCalled();
	});

	it('編輯既有班級的 sheet 帶入呼叫 updateCourse(id, …) 的 onSave', async () => {
		vi.mocked(updateCourse).mockResolvedValue({ id: FIXTURE_CLASSES[0].id } as never);
		const { findByText } = render(ClassesPage);
		await findByText('測試班級甲');

		await fireEvent.click(await findByText('編輯'));
		const sheetProps = get(overlay).sheet?.props as { onSave: (r: ClassRow, d: number, isNew: boolean) => Promise<void> };
		expect(sheetProps).toBeTruthy();

		await sheetProps.onSave({ ...FIXTURE_CLASSES[0], name: '改名後的班級' }, 90, false);

		expect(updateCourse).toHaveBeenCalledTimes(1);
		expect(updateCourse).toHaveBeenCalledWith(FIXTURE_CLASSES[0].id, expect.objectContaining({ name: '改名後的班級' }));
		expect(createCourse).not.toHaveBeenCalled();
	});

	it('儲存失敗時顯示錯誤 toast，不吞掉例外', async () => {
		vi.mocked(createCourse).mockRejectedValue(new Error('boom'));
		const { findByText, getByLabelText } = render(ClassesPage);
		await findByText('測試班級甲');

		await fireEvent.click(getByLabelText('新增班級'));
		const sheetProps = get(overlay).sheet?.props as { onSave: (r: ClassRow, d: number, isNew: boolean) => Promise<void> };
		await sheetProps.onSave({ ...FIXTURE_CLASSES[0], id: '', name: '新班級' }, 60, true);

		expect(get(toasts).some((t) => t.title === '新增失敗')).toBe(true);
	});
});
