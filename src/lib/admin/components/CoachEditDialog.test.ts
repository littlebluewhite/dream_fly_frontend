import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CoachEditDialog from './CoachEditDialog.svelte';
import { COACHES, type Coach } from '$lib/admin/data';

/* CoachEditDialog — edit form in the shared EditModal (admin.jsx
 * CoachEditDialog). Holds a local copy of the coach; 儲存 fires onSave(updated) +
 * a success toast. We assert the field render, the onSave wiring, the edited
 * value flowing through, and tags-text → tags[] normalisation. */
const base: Coach = COACHES[0]; // 林雅婷

describe('CoachEditDialog', () => {
	it('renders open with the coach name and the 儲存 primary', () => {
		const { getByDisplayValue, getByText } = render(CoachEditDialog, {
			open: true,
			coach: base
		});
		expect(getByDisplayValue(base.name)).toBeInTheDocument();
		expect(getByText('儲存')).toBeInTheDocument();
	});

	it('renders the editable fields (職稱 / 專長標籤 / 聯絡電話)', () => {
		const { getByDisplayValue, getByLabelText } = render(CoachEditDialog, {
			open: true,
			coach: base
		});
		expect(getByDisplayValue(base.title)).toBeInTheDocument();
		expect(getByDisplayValue(base.phone)).toBeInTheDocument();
		// tags joined with 、 into the text buffer
		expect(getByDisplayValue(base.tags.join('、'))).toBeInTheDocument();
		expect(getByLabelText('目前狀態')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(CoachEditDialog, { open: false, coach: base });
		expect(queryByText('儲存')).toBeNull();
	});

	it('uses the 新增教練 title + 建立教練 primary in new mode', () => {
		const { getByText } = render(CoachEditDialog, { open: true, coach: base, isNew: true });
		expect(getByText('新增教練')).toBeInTheDocument();
		expect(getByText('建立教練')).toBeInTheDocument();
	});

	it('fires onSave with the edited name + re-derived initial when 儲存 clicked', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(CoachEditDialog, {
			open: true,
			coach: base,
			onSave
		});

		const nameInput = getByDisplayValue(base.name) as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: '陳測試' } });
		await fireEvent.click(getByText('儲存'));

		expect(onSave).toHaveBeenCalledTimes(1);
		const updated = onSave.mock.calls[0][0] as Coach;
		expect(updated.name).toBe('陳測試');
		expect(updated.initial).toBe('陳'); // initial re-derived from the new name
		expect(updated.id).toBe(base.id); // identity preserved
	});

	it('splits the 專長標籤 text buffer back into a tags[] array on save', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(CoachEditDialog, {
			open: true,
			coach: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(base.tags.join('、')), {
			target: { value: '競技體操、跑酷, 成人體操' }
		});
		await fireEvent.click(getByText('儲存'));
		expect(onSave.mock.calls[0][0].tags).toEqual(['競技體操', '跑酷', '成人體操']);
	});

	it('coerces edited numeric fields (年資) back to a number on save', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(CoachEditDialog, {
			open: true,
			coach: base,
			onSave
		});
		// the 年資 field shows the coach's years; edit it then save
		await fireEvent.input(getByDisplayValue(String(base.years)), { target: { value: '15' } });
		await fireEvent.click(getByText('儲存'));
		expect(onSave.mock.calls[0][0].years).toBe(15);
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(CoachEditDialog, { open: true, coach: base, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	// Regression (bug found while wiring the seam layer): the dialog is mounted
	// once, up front, with open=false/coach=null; 編輯/新增教練 then flips both
	// props on that already-mounted instance. A two-stage `wasOpen` reactive
	// pair never picked this up, so the dialog silently stayed shut.
	//
	// These two use COACHES[2]/[3] rather than the shared `base` (COACHES[0]):
	// `base` gets mutated in place by the 儲存-name test above (bind:value={f.name}
	// aliases the coach object directly on this component's first open), so
	// asserting against it here would depend on suite execution order.
	it('opens on an already-mounted instance when open and coach change together', async () => {
		const target: Coach = COACHES[2]; // 黃詩涵
		const { rerender, getByDisplayValue } = render(CoachEditDialog, {
			open: false,
			coach: null
		});

		await rerender({ open: true, coach: target });

		expect(getByDisplayValue(target.name)).toBeInTheDocument();
	});

	it('swaps the form to a newly-assigned coach without leaving stale data from the previous coach behind', async () => {
		const first: Coach = COACHES[2]; // 黃詩涵
		const second: Coach = COACHES[3]; // 王思齊
		const { rerender, getByDisplayValue, queryByDisplayValue } = render(CoachEditDialog, {
			open: true,
			coach: first
		});
		expect(getByDisplayValue(first.name)).toBeInTheDocument();

		await rerender({ open: true, coach: second });

		expect(getByDisplayValue(second.name)).toBeInTheDocument();
		expect(queryByDisplayValue(first.name)).toBeNull();
	});

	// Regression #2: the CLOSE transition must update the guard's bookkeeping
	// too. The parent (admin/coaches +page) clears BOTH props on 取消
	// (open:false + coach:null); a `coach && (…)` short-circuit skipped that
	// transition, freezing `wasOpen`/`lastCoach`/`f` at their open-time values —
	// so re-opening the SAME coach (same reference: open && !wasOpen false,
	// coach !== lastCoach false) re-fired nothing and the form showed the
	// abandoned dirty draft (and 儲存 would write it back).
	it('re-opening the same coach after 取消 discards the abandoned dirty draft', async () => {
		const target: Coach = COACHES[4]; // 張育誠 — untouched by any other case
		const { rerender, getByDisplayValue, queryByDisplayValue } = render(CoachEditDialog, {
			open: false,
			coach: null
		});

		// open → dirty-edit the name (never saved)
		await rerender({ open: true, coach: target });
		await fireEvent.input(getByDisplayValue(target.name), { target: { value: '髒草稿' } });
		expect(getByDisplayValue('髒草稿')).toBeInTheDocument();

		// 取消 — the parent clears both props together
		await rerender({ open: false, coach: null });

		// re-open the same coach (same reference) → true values back, draft gone
		await rerender({ open: true, coach: target });
		expect(getByDisplayValue(target.name)).toBeInTheDocument();
		expect(queryByDisplayValue('髒草稿')).toBeNull();
	});
});
