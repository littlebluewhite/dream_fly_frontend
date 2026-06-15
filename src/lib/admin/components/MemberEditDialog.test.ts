import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MemberEditDialog from './MemberEditDialog.svelte';
import { MEMBERS, type Member } from '$lib/admin/data';

/* MemberEditDialog — edit form in an EditModal (admin.jsx MemberEditDialog). It
 * holds a local copy of the member, and 儲存資料 fires onSave(updated) + a success
 * toast. We assert the onSave wiring and the edited value flowing through. */
const base: Member = MEMBERS[0];

describe('MemberEditDialog', () => {
	it('renders open with the member name and the 儲存資料 primary', () => {
		const { getByDisplayValue, getByText } = render(MemberEditDialog, {
			open: true,
			member: base
		});
		expect(getByDisplayValue(base.name)).toBeInTheDocument();
		expect(getByText('儲存資料')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(MemberEditDialog, { open: false, member: base });
		expect(queryByText('儲存資料')).toBeNull();
	});

	it('fires onSave with the edited name when 儲存資料 is clicked, without throwing', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(MemberEditDialog, {
			open: true,
			member: base,
			onSave
		});

		const nameInput = getByDisplayValue(base.name) as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: '王測試' } });
		await fireEvent.click(getByText('儲存資料'));

		expect(onSave).toHaveBeenCalledTimes(1);
		const updated = onSave.mock.calls[0][0] as Member;
		expect(updated.name).toBe('王測試');
		expect(updated.initial).toBe('王'); // initial re-derived from the new name
		expect(updated.id).toBe(base.id); // identity preserved
	});

	it('coerces an edited age string back to a number on save', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(MemberEditDialog, {
			open: true,
			member: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(String(base.age)), { target: { value: '15' } });
		await fireEvent.click(getByText('儲存資料'));
		expect(onSave.mock.calls[0][0].age).toBe(15);
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(MemberEditDialog, { open: true, member: base, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});
});
