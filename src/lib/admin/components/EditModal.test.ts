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

	/* Important #1 (終審)：五個真寫入呼叫端(tickets/venues/coupons/coaches/members)的
	 * onSave 最終都是 async 的 page-level save()，連點主按鈕會送出兩次 POST/PATCH。
	 * EditModal 在 onSave() 回傳 promise 時自動鎖住主按鈕(busy)，落定後才解鎖——
	 * 呼叫端不需要各自管理 saving 狀態，也不會漏接。onSave 同步回傳(如表單驗證失敗
	 * 提早 return)則不鎖，不影響既有同步呼叫端。 */
	it('連點主按鈕：onSave 回傳的 promise 落定前再次點擊不會重複呼叫 onSave，按鈕停用並顯示處理中', async () => {
		let resolveSave!: () => void;
		const pending = new Promise<void>((resolve) => {
			resolveSave = resolve;
		});
		const onSave = vi.fn(() => pending);
		const { getByText } = render(EditModal, { open: true, title: '編輯班級', onSave });

		const btn = getByText('儲存').closest('button') as HTMLButtonElement;
		await fireEvent.click(btn);
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(btn.disabled).toBe(true);
		expect(btn.textContent).toContain('處理中');

		// 連點第二次：promise 尚未落定，busy 鎖仍在，onSave 不應再被呼叫。
		await fireEvent.click(btn);
		expect(onSave).toHaveBeenCalledTimes(1);

		resolveSave();
		await pending;
		await Promise.resolve(); // flush the finally{} that clears busy
	});

	it('onSave 同步回傳(非 promise)時不鎖按鈕——不影響既有同步呼叫端', async () => {
		const onSave = vi.fn();
		const { getByText } = render(EditModal, { open: true, title: '編輯班級', onSave });
		const btn = getByText('儲存').closest('button') as HTMLButtonElement;
		await fireEvent.click(btn);
		expect(onSave).toHaveBeenCalledTimes(1);
		expect(btn.disabled).toBe(false);
	});
});
