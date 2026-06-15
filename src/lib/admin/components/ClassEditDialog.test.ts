import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ClassEditDialog from './ClassEditDialog.svelte';
import { CLASSES, type ClassRow } from '$lib/admin/data';

/* ClassEditDialog — edit form in an EditModal (admin.jsx ClassEditDialog). It
 * holds a local copy of the class; 儲存課程 fires onSave(updated) + a success
 * toast. We assert the fields render and the onSave wiring carries the edit. */
const base: ClassRow = CLASSES[0];

describe('ClassEditDialog', () => {
	it('renders open with the class name field and the 儲存課程 primary', () => {
		const { getByDisplayValue, getByText } = render(ClassEditDialog, {
			open: true,
			klass: base
		});
		expect(getByDisplayValue(base.name)).toBeInTheDocument();
		expect(getByText('儲存課程')).toBeInTheDocument();
	});

	it('renders the editable field labels', () => {
		const { getByText } = render(ClassEditDialog, { open: true, klass: base });
		for (const lbl of ['班級名稱', '分級', '課程類別', '授課教練', '教室 / 場地', '招生狀態']) {
			expect(getByText(lbl)).toBeInTheDocument();
		}
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(ClassEditDialog, { open: false, klass: base });
		expect(queryByText('儲存課程')).toBeNull();
	});

	it('fires onSave with the edited name when 儲存課程 is clicked', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(ClassEditDialog, {
			open: true,
			klass: base,
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
		const { getByText } = render(ClassEditDialog, { open: true, klass: base, isNew: true });
		expect(getByText('建立班級')).toBeInTheDocument();
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(ClassEditDialog, { open: true, klass: base, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});
});
