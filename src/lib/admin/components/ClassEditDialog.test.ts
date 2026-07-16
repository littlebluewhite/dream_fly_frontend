import { describe, it, expect, vi } from 'vitest';
import { get } from 'svelte/store';
import { render, fireEvent } from '@testing-library/svelte';
import ClassEditDialog from './ClassEditDialog.svelte';
import type { ClassRow } from '$lib/admin/data';
import { COACHES } from '$lib/domain/coaches';
import { toasts } from '$lib/admin/stores';

/* ClassEditDialog — edit form in an EditModal (admin.jsx ClassEditDialog). It
 * holds a local copy of the class; 儲存課程 fires onSave(updated) + a success
 * toast. We assert the fields render and the onSave wiring carries the edit.
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

	it('renders the editable field labels', () => {
		const { getByText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES });
		for (const lbl of ['班級名稱', '分級', '課程類別', '授課教練', '教室 / 場地', '招生狀態']) {
			expect(getByText(lbl)).toBeInTheDocument();
		}
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

	it('fires onSave with the edited name when 儲存課程 is clicked', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(ClassEditDialog, {
			open: true,
			klass: base,
			coaches: COACHES,
			onSave
		});

		const nameInput = getByDisplayValue(base.name) as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: '測試班級' } });
		await fireEvent.click(getByText('儲存課程'));

		expect(onSave).toHaveBeenCalledTimes(1);
		const updated = onSave.mock.calls[0][0] as ClassRow;
		expect(updated.name).toBe('測試班級');
		expect(updated.id).toBe(base.id); // identity preserved
	});

	it('coerces edited numeric fields (cap/price) back to numbers on save', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(ClassEditDialog, {
			open: true,
			klass: base,
			coaches: COACHES,
			onSave
		});
		await fireEvent.input(getByDisplayValue(String(base.cap)), { target: { value: '20' } });
		await fireEvent.input(getByDisplayValue(String(base.price)), { target: { value: '5000' } });
		await fireEvent.click(getByText('儲存課程'));
		const updated = onSave.mock.calls[0][0] as ClassRow;
		expect(updated.cap).toBe(20);
		expect(updated.price).toBe(5000);
	});

	it('uses the 建立班級 primary and label in new mode', () => {
		const { getByText } = render(ClassEditDialog, { open: true, klass: base, coaches: COACHES, isNew: true });
		expect(getByText('建立班級')).toBeInTheDocument();
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

	/* 單堂時長（duration_minutes）— FE#18：ClassRow 現有 durationMinutes 欄位，
	 * 時長欄位新增/編輯兩種模式皆顯示可改，並隨 onSave 的第二個參數送出。 */
	it('shows 單堂時長（分鐘） in new mode, defaulting to 90, and passes it as onSave’s 2nd arg', async () => {
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
		expect(onSave.mock.calls[0][1]).toBe(90);
	});

	/* FE#18: 時長欄位過去只在 isNew 顯示（{#if isNew}），編輯模式看不到也改不到
	 * 既有課程的單堂時長。現在編輯模式也要顯示，且預設值來自該課程自己的
	 * durationMinutes（不是新增模式的寫死 90）。 */
	it('shows 單堂時長（分鐘） in edit mode too, defaulting to the class’s own duration', () => {
		const klass = { ...base, durationMinutes: 45 };
		const { getByDisplayValue } = render(ClassEditDialog, { open: true, klass, coaches: COACHES, isNew: false });
		expect(getByDisplayValue('45')).toBeInTheDocument();
	});

	it('parses an edited 單堂時長 value back to a number on save (new mode)', async () => {
		const onSave = vi.fn();
		const { getByText, getByDisplayValue } = render(ClassEditDialog, {
			open: true,
			klass: base,
			coaches: COACHES,
			isNew: true,
			onSave
		});
		await fireEvent.input(getByDisplayValue('90'), { target: { value: '60' } });
		await fireEvent.click(getByText('建立班級'));
		expect(onSave.mock.calls[0][1]).toBe(60);
	});

	it('parses an edited 單堂時長 value back to a number on save (edit mode)', async () => {
		const onSave = vi.fn();
		const klass = { ...base, durationMinutes: 45 };
		const { getByText, getByDisplayValue } = render(ClassEditDialog, {
			open: true,
			klass,
			coaches: COACHES,
			isNew: false,
			onSave
		});
		await fireEvent.input(getByDisplayValue('45'), { target: { value: '75' } });
		await fireEvent.click(getByText('儲存課程'));
		expect(onSave.mock.calls[0][1]).toBe(75);
	});

	/* 卡 7 reset 回歸對（措辭仿 CouponCreateDialog.test.ts 的成對先例）：
	 * ①換實體不殘留——working copy 與 cap/price/sessions/duration 四個文字 buffer 都要跟著新實體；
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
		expect((getByLabelText('本期堂數') as HTMLInputElement).value).toBe('12');
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
