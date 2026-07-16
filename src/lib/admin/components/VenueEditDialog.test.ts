import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import VenueEditDialog from './VenueEditDialog.svelte';
import { VENUES } from '$lib/domain/venues';
import type { Venue } from '$lib/admin/data';

/* VenueEditDialog — edit form in the shared EditModal (clone of
 * ClassEditDialog / CoachEditDialog). Holds a local copy of the venue; 儲存 fires
 * onSave(updated) (page decides the success/failure toast after the real
 * POST/PATCH /venues round trip — Task F4, same pattern as TicketEditDialog).
 * We assert the fields render, the onSave wiring carries the edit, equip
 * text → string[] round trips, and the 場地代號 field always shows the
 * read-only slug (Task F4：欄位收斂，移除 area/cap/今日排課 裝飾欄位).
 *
 * Task F4 review 修正：欄位標籤由「場地類型」改為「場地簡介」+ helper 提示，對齊
 * buildVenueBody() 把這個值送進後端 description、公開場地頁把 description 渲染成
 * 場館介紹的實際去向(內部欄位名 f.type 未變)。 */
const base: Venue = VENUES[0]; // A 訓練館

describe('VenueEditDialog', () => {
	it('renders open with the venue name field and the 儲存場地 primary', () => {
		const { getByDisplayValue, getByText } = render(VenueEditDialog, {
			open: true,
			venue: base
		});
		expect(getByDisplayValue(base.name)).toBeInTheDocument();
		expect(getByText('儲存場地')).toBeInTheDocument();
	});

	it('renders the editable field labels (area/cap/今日排課 已收斂移除，Task F4)', () => {
		const { getByText, queryByText } = render(VenueEditDialog, { open: true, venue: base });
		for (const lbl of ['場地代號', '場地名稱', '場地簡介', '狀態', '器材配置（以、分隔）']) {
			expect(getByText(lbl)).toBeInTheDocument();
		}
		for (const removed of ['面積', '容納人數', '今日排課']) {
			expect(queryByText(removed)).toBeNull();
		}
	});

	it('場地簡介欄位附一行提示，說明內容會外顯到公開場地頁（Task F4 review 修正）', () => {
		const { getByText } = render(VenueEditDialog, { open: true, venue: base });
		expect(getByText('此內容會顯示在公開的「場館介紹」頁面。')).toBeInTheDocument();
	});

	it('joins equip[] into the 器材配置 text buffer with 、', () => {
		const { getByDisplayValue } = render(VenueEditDialog, { open: true, venue: base });
		expect(getByDisplayValue(base.equip.join('、'))).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(VenueEditDialog, { open: false, venue: base });
		expect(queryByText('儲存場地')).toBeNull();
	});

	it('顯示唯讀 slug 於場地代號欄位（不是內部 id）', () => {
		const { getByLabelText } = render(VenueEditDialog, { open: true, venue: base });
		const slugInput = getByLabelText('場地代號') as HTMLInputElement;
		expect(slugInput.value).toBe(base.slug);
		expect(slugInput.disabled).toBe(true);
	});

	it('場地代號 (slug) 欄位在新增模式下仍維持唯讀（降低誤操作，Task F4 選擇）', () => {
		const { getByLabelText } = render(VenueEditDialog, { open: true, venue: base, isNew: true });
		const slugInput = getByLabelText('場地代號') as HTMLInputElement;
		expect(slugInput.disabled).toBe(true);
	});

	it('fires onSave with the edited name when 儲存場地 is clicked', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(VenueEditDialog, {
			open: true,
			venue: base,
			onSave
		});

		const nameInput = getByDisplayValue(base.name) as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: 'A 主訓練館' } });
		await fireEvent.click(getByText('儲存場地'));

		expect(onSave).toHaveBeenCalledTimes(1);
		const updated = onSave.mock.calls[0][0] as Venue;
		expect(updated.name).toBe('A 主訓練館');
		expect(updated.id).toBe(base.id); // identity preserved (id untouched by any input)
	});

	it('splits the 器材配置 text buffer back into a string[] on save (round-trips)', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(VenueEditDialog, {
			open: true,
			venue: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(base.equip.join('、')), {
			target: { value: '彈翻床、平衡木, 單槓' }
		});
		await fireEvent.click(getByText('儲存場地'));
		expect(onSave.mock.calls[0][0].equip).toEqual(['彈翻床', '平衡木', '單槓']);
	});

	it('uses the 建立場地 primary and 新增場地 title in new mode', () => {
		const { getByText } = render(VenueEditDialog, { open: true, venue: base, isNew: true });
		expect(getByText('建立場地')).toBeInTheDocument();
		expect(getByText('新增場地')).toBeInTheDocument();
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(VenueEditDialog, { open: true, venue: base, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	/* 卡 7 reset 回歸對（措辭仿 CouponCreateDialog.test.ts 的成對先例）：①換實體不殘留
	 * ——working copy 與 equipText buffer（join('、')）都要跟著新實體；②關閉重開丟棄
	 * 髒草稿——同 ClassEditDialog，初始 working copy 是 clone，編輯不可污染原實體。 */
	it('resets fields when the venue prop changes to a different venue (no stale data)', async () => {
		const other: Venue = { ...VENUES[0], id: 'X', slug: 'x', name: 'X 測試館', equip: ['彈翻床', '海綿池'] };
		const { getByLabelText, rerender } = render(VenueEditDialog, { open: true, venue: { ...VENUES[0] } });

		await fireEvent.input(getByLabelText('場地名稱'), { target: { value: '髒草稿' } });
		await fireEvent.input(getByLabelText('器材配置（以、分隔）'), { target: { value: '空手道墊' } });

		await rerender({ open: true, venue: other });

		expect((getByLabelText('場地名稱') as HTMLInputElement).value).toBe('X 測試館');
		expect((getByLabelText('器材配置（以、分隔）') as HTMLInputElement).value).toBe('彈翻床、海綿池');
	});

	it('discards a dirty draft on close/re-open and never pollutes the original venue passed in (initial working copy is a clone)', async () => {
		const original: Venue = { ...VENUES[0] };
		const { getByLabelText, rerender } = render(VenueEditDialog, { open: true, venue: original });

		await fireEvent.input(getByLabelText('場地名稱'), { target: { value: '髒草稿名稱' } });

		await rerender({ open: false, venue: null });
		expect(original.name).toBe('A 訓練館');

		await rerender({ open: true, venue: original });
		expect((getByLabelText('場地名稱') as HTMLInputElement).value).toBe('A 訓練館');
	});
});
