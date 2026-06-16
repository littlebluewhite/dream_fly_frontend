import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import VenueEditDialog from './VenueEditDialog.svelte';
import { VENUES, type Venue } from '$lib/admin/data';

/* VenueEditDialog — edit form in the shared EditModal (clone of
 * ClassEditDialog / CoachEditDialog). Holds a local copy of the venue; 儲存 fires
 * onSave(updated) + a success toast. We assert the fields render, the onSave
 * wiring carries the edit, numeric fields coerce, equip text → string[] round
 * trips, and the id field is disabled when editing (protects the keyed id). */
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

	it('renders the editable field labels', () => {
		const { getByText } = render(VenueEditDialog, { open: true, venue: base });
		for (const lbl of ['場地代號', '場地名稱', '場地類型', '面積', '容納人數', '今日排課', '狀態']) {
			expect(getByText(lbl)).toBeInTheDocument();
		}
	});

	it('joins equip[] into the 器材配置 text buffer with 、', () => {
		const { getByDisplayValue } = render(VenueEditDialog, { open: true, venue: base });
		expect(getByDisplayValue(base.equip.join('、'))).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(VenueEditDialog, { open: false, venue: base });
		expect(queryByText('儲存場地')).toBeNull();
	});

	it('disables the 場地代號 (id) field when editing (protects the keyed id)', () => {
		const { getByLabelText } = render(VenueEditDialog, { open: true, venue: base });
		const idInput = getByLabelText('場地代號') as HTMLInputElement;
		expect(idInput.disabled).toBe(true);
	});

	it('leaves the 場地代號 field editable in new mode', () => {
		const { getByLabelText } = render(VenueEditDialog, { open: true, venue: base, isNew: true });
		const idInput = getByLabelText('場地代號') as HTMLInputElement;
		expect(idInput.disabled).toBe(false);
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
		expect(updated.id).toBe(base.id); // identity preserved (id locked when editing)
	});

	it('coerces edited numeric fields (cap/today) back to numbers on save', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(VenueEditDialog, {
			open: true,
			venue: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(String(base.cap)), { target: { value: '20' } });
		await fireEvent.input(getByDisplayValue(String(base.today)), { target: { value: '5' } });
		await fireEvent.click(getByText('儲存場地'));
		const updated = onSave.mock.calls[0][0] as Venue;
		expect(updated.cap).toBe(20);
		expect(updated.today).toBe(5);
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
});
