import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { render, fireEvent } from '@testing-library/svelte';
import ClassEditDialog from './ClassEditDialog.svelte';
import type { ClassRow } from '$lib/admin/data';
import { COACHES } from '$lib/domain/coaches';
import { toasts } from '$lib/admin/stores';
import { COURSE_AGE_FORMAT_ERROR } from './course-request';

/* ClassEditDialog — edit form in an EditModal (admin.jsx ClassEditDialog). It
 * holds a CourseDraft of the class; 儲存課程 runs checkCourseDraft() and fires
 * onSave(ValidCourse) only when valid. R13 Task 4:驗證規則與 body 組裝的逐欄測試
 * 住 course-request.test.ts，這裡只剩接線(欄位、錯誤顯示、onSave、reset)。
 *
 * Task 1(C2 死種子退役):admin/data.ts 的 CLASSES(值)已退役——改為檔內 inline
 * ClassRow fixture(沿用真實種子 k1 的欄位值)。 */
const base: ClassRow = { id: 'k1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', coach: '林雅婷', room: 'A 訓練館', day: '週二 / 週四', time: '19:00–20:30', enrolled: 11, cap: 12, age: '10–16 歲', price: 4800, status: '招生中', wait: 0, term: '2026 春季', sessions: 16, startDate: '2026/03/01', checkinRate: 86, makeup: 0, durationMinutes: 90 };

describe('ClassEditDialog', () => {
	it('renders open with the class name field and the 儲存課程 primary', () => {
		const { getByDisplayValue, getByText } = render(ClassEditDialog, {
			open: true,
			klass: base,
			coaches: COACHES
		});
		expect(getByDisplayValue(base.name)).toBeInTheDocument();
		expect(getByText('儲存課程')).toBeInTheDocument();
	});

	it('renders the editable field labels; 場地/期別/堂數 inputs are gone and 招生狀態 is a read-only badge', () => {
		const { getByText, queryByLabelText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES });
		for (const lbl of ['班級名稱', '分級', '課程類別', '授課教練', '上課日', '時段', '適合年齡', '人數上限', '季費 (NT$)', '單堂時長（分鐘）']) {
			expect(queryByLabelText(lbl)).toBeInTheDocument();
		}
		for (const lbl of ['教室 / 場地', '本期期別', '本期堂數', '招生狀態']) {
			expect(queryByLabelText(lbl)).toBeNull();
		}
		expect(getByText('招生狀態')).toBeInTheDocument();
		expect(getByText(base.status)).toBeInTheDocument();
	});

	/* Task 8 review fix B (concern #2): parseAgeRange accepts only 3 exact formats
	 * (range uses an EN DASH U+2013, not a hyphen); anything else silently clears
	 * the age restriction. The 適合年齡 Input must show those exact formats as a
	 * placeholder so unparseable input is visible before it's submitted. */
	it('shows the accepted 適合年齡 formats as a placeholder (incl. the EN-DASH range form)', () => {
		const { getByLabelText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES });
		const ageInput = getByLabelText('適合年齡') as HTMLInputElement;
		expect(ageInput.placeholder).toContain('8–14 歲'); // EN DASH U+2013 — matches AGE_RANGE_RE
		expect(ageInput.placeholder).toContain('12 歲以上');
		expect(ageInput.placeholder).toContain('9 歲以下');
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(ClassEditDialog, { open: false, klass: base, coaches: COACHES });
		expect(queryByText('儲存課程')).toBeNull();
	});

	it('fires onSave(ValidCourse) with the edited values when 儲存課程 is clicked', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(ClassEditDialog, {
			open: true,
			klass: base,
			coaches: COACHES,
			onSave
		});

		await fireEvent.input(getByLabelText('班級名稱'), { target: { value: '測試班級' } });
		await fireEvent.input(getByLabelText('人數上限'), { target: { value: '20' } });
		await fireEvent.input(getByLabelText('單堂時長（分鐘）'), { target: { value: '75' } });
		await fireEvent.click(getByText('儲存課程'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0]).toMatchObject({ name: '測試班級', maxStudents: 20, durationMinutes: 75, coachId: COACHES[0].id });
		expect(onSave.mock.calls[0]).toHaveLength(1);
	});

	it('shows the module’s error and does not call onSave when the draft is invalid', async () => {
		const onSave = vi.fn();
		const { getByLabelText, getByText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES, onSave });

		await fireEvent.input(getByLabelText('適合年齡'), { target: { value: '國小以上' } });
		await fireEvent.click(getByText('儲存課程'));

		expect(onSave).not.toHaveBeenCalled();
		expect(getByText(COURSE_AGE_FORMAT_ERROR)).toBeInTheDocument();
	});

	it('uses the 建立班級 primary and label in new mode', () => {
		const { getByText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES, isNew: true });
		expect(getByText('建立班級')).toBeInTheDocument();
	});

	/* 防連點守衛(EditModal 的 handleSave)只有在 onSave() 回傳 promise 時才會鎖住
	 * 主按鈕；save() 過去沒有 `return onSave(...)`，回傳值恆為 undefined，守衛形同
	 * 虛設——連點會重複送出。這裡用一個懸而未決的 promise 卡住 onSave，點兩次，
	 * 斷言只呼叫一次。 */
	it('locks the primary button against a second click while onSave is pending', async () => {
		let resolveSave: () => void;
		const onSave = vi.fn(() => new Promise<void>((resolve) => { resolveSave = resolve; }));
		const { getByText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES, onSave });

		const btn = getByText('儲存課程');
		await fireEvent.click(btn);
		await fireEvent.click(btn);

		expect(onSave).toHaveBeenCalledTimes(1);
		resolveSave!();
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	/* Task 8 piece 1: 儲存改叫真實 POST/PATCH /courses（classes/+page.svelte 非同步），
	 * 這裡不再樂觀丟成功 toast——成功/失敗一律由 page 在 API 呼叫結束後決定。 */
	it('does not show its own toast on save (the page shows one after the API call resolves)', async () => {
		const before = get(toasts).length;
		const { getByText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES });
		await fireEvent.click(getByText('儲存課程'));
		expect(get(toasts).length).toBe(before);
	});

	/* 單堂時長（duration_minutes）— FE#18：新增/編輯兩種模式皆顯示可改。新增模式的
	 * 預設 90 來自 blankClassRow()(呼叫端傳入)，編輯模式帶該課程自己的 durationMinutes。 */
	it('shows 單堂時長（分鐘） in new mode with the blank row’s 90 and sends it through onSave', async () => {
		const onSave = vi.fn();
		const { getByText, getByDisplayValue } = render(ClassEditDialog, {
			open: true,
			klass: base,
			coaches: COACHES,
			isNew: true,
			onSave
		});
		expect(getByDisplayValue('90')).toBeInTheDocument();
		await fireEvent.click(getByText('建立班級'));
		expect(onSave.mock.calls[0][0].durationMinutes).toBe(90);
	});

	it('shows 單堂時長（分鐘） in edit mode too, defaulting to the class’s own duration', () => {
		const klass = { ...base, durationMinutes: 45 };
		const { getByDisplayValue } = render(ClassEditDialog, { open: true, klass, coaches: COACHES, isNew: false });
		expect(getByDisplayValue('45')).toBeInTheDocument();
	});

	/* 卡 7 reset 回歸對（措辭仿 CouponCreateDialog.test.ts 的成對先例）：
	 * ①換實體不殘留——working copy 與 cap/price/duration 文字 buffer 都要跟著新實體(R13 Task 4
	 * 拿掉本期堂數輸入，原 sessions buffer 的那一行斷言隨之刪除，其餘斷言不變)；
	 * ②關閉重開丟棄髒草稿——兼作「初始 working copy 改 clone」修正的回歸釘：初次掛載後的
	 * bind:value 編輯絕不可寫回呼叫端傳入的原實體（別名形會讓取消不救、列表資料已髒）。 */
	it('resets fields when the klass prop changes to a different class (no stale data)', async () => {
		const other: ClassRow = { ...base, id: 'k2', name: '兒童基礎 B 班', cap: 20, price: 5200, sessions: 12, durationMinutes: 60 };
		const { getByLabelText, rerender } = render(ClassEditDialog, { open: true, klass: { ...base }, coaches: COACHES });

		await fireEvent.input(getByLabelText('班級名稱'), { target: { value: '髒草稿' } });
		await fireEvent.input(getByLabelText('人數上限'), { target: { value: '99' } });

		await rerender({ open: true, klass: other, coaches: COACHES });

		expect((getByLabelText('班級名稱') as HTMLInputElement).value).toBe('兒童基礎 B 班');
		expect((getByLabelText('人數上限') as HTMLInputElement).value).toBe('20');
		expect((getByLabelText('季費 (NT$)') as HTMLInputElement).value).toBe('5200');
		expect((getByLabelText('單堂時長（分鐘）') as HTMLInputElement).value).toBe('60');
	});

	it('discards a dirty draft on close/re-open and never pollutes the original class passed in (initial working copy is a clone)', async () => {
		const original: ClassRow = { ...base };
		const { getByLabelText, rerender } = render(ClassEditDialog, { open: true, klass: original, coaches: COACHES });

		await fireEvent.input(getByLabelText('班級名稱'), { target: { value: '髒草稿名稱' } });

		// 關閉（呼叫端 closeEdit 會把實體設回 null）
		await rerender({ open: false, klass: null, coaches: COACHES });
		// 初次掛載的 working copy 必須是 clone——編輯後原實體維持舊值（別名形在此變紅）
		expect(original.name).toBe('競技啦啦隊 進階班');

		// 重開同一實體：畫面回到原值，髒草稿不殘留
		await rerender({ open: true, klass: original, coaches: COACHES });
		expect((getByLabelText('班級名稱') as HTMLInputElement).value).toBe('競技啦啦隊 進階班');
	});
});
