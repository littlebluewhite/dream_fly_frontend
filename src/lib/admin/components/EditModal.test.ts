import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import EditModal from './EditModal.svelte';

/* Generic 560px form-modal shell from admin.jsx EditModal — overlay + card with
 * a header (title + close X), a scrollable body (default slot) and a footer
 * (取消 secondary + primary primaryLabel). Downstream dialogs wrap it, so the
 * body is fully slotted and the primary label is overridable.
 *
 * Slot content can't be injected through the bare render(Component, props)
 * form the repo uses, so per the agent brief we assert the footer buttons +
 * title + the onSave/onClose wiring instead. */
describe('EditModal', () => {
	it('renders the title when open', () => {
		const { getByText } = render(EditModal, { open: true, title: '編輯班級' });
		expect(getByText('編輯班級')).toBeTruthy();
	});

	it('renders the default 儲存 primary label and the 取消 secondary', () => {
		const { getByText } = render(EditModal, { open: true, title: '編輯班級' });
		expect(getByText('儲存')).toBeTruthy();
		expect(getByText('取消')).toBeTruthy();
	});

	it('overrides the primary label when primaryLabel is supplied', () => {
		const { getByText, queryByText } = render(EditModal, {
			open: true,
			title: '新增班級',
			primaryLabel: '建立班級'
		});
		expect(getByText('建立班級')).toBeTruthy();
		expect(queryByText('儲存')).toBeNull();
	});

	it('calls onSave when the primary button is clicked', async () => {
		const onSave = vi.fn();
		const { getByText } = render(EditModal, { open: true, title: '編輯班級', onSave });
		await fireEvent.click(getByText('儲存'));
		expect(onSave).toHaveBeenCalled();
	});

	it('calls onClose when the 取消 secondary button is clicked', async () => {
		const onClose = vi.fn();
		const { getByText } = render(EditModal, { open: true, title: '編輯班級', onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	it('calls onClose when the header close button is clicked', async () => {
		const onClose = vi.fn();
		const { getByLabelText } = render(EditModal, { open: true, title: '編輯班級', onClose });
		await fireEvent.click(getByLabelText('關閉'));
		expect(onClose).toHaveBeenCalled();
	});

	it('renders nothing when open is false', () => {
		const { queryByText } = render(EditModal, { open: false, title: '編輯班級' });
		expect(queryByText('編輯班級')).toBeNull();
		expect(queryByText('儲存')).toBeNull();
	});
});
