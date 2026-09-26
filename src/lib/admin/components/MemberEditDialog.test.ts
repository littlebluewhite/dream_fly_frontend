import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MemberEditDialog from './MemberEditDialog.svelte';
import type { MemberAccount } from '$lib/admin/data';
import { MEMBER_NAME_ERROR } from './member-request';

/* MemberEditDialog — edit form inside the shared EditModal (Task 16). 契約 §3.2
 * PATCH /users/{id}。R13 Task 4：body 規則(trim、空白 phone 省略、長度)住
 * member-request.ts(checkMemberEdit)，由 member-request.test.ts 覆蓋；這裡只剩接線。
 * 不可改 email/roles/password——本表單完全不出現這三個欄位（契約明文 v1 範圍外）。 */
const acc: MemberAccount = {
	id: 'u1',
	name: '王小明',
	initial: '王',
	phone: '0912345678',
	joined: '2026-01-15',
	status: 'active',
	points: 1250
};

describe('MemberEditDialog', () => {
	it('renders open with the member name/phone pre-filled and the 儲存 primary', () => {
		const { getByDisplayValue, getByText } = render(MemberEditDialog, { open: true, member: acc });
		expect(getByDisplayValue(acc.name)).toBeInTheDocument();
		expect(getByDisplayValue(acc.phone)).toBeInTheDocument();
		expect(getByText('儲存')).toBeInTheDocument();
	});

	it('renders the 帳號啟用 switch reflecting the active status', () => {
		const { getByRole } = render(MemberEditDialog, { open: true, member: acc });
		const sw = getByRole('switch');
		expect(sw.getAttribute('aria-checked')).toBe('true');
	});

	it('renders the switch OFF for an inactive account', () => {
		const inactive: MemberAccount = { ...acc, status: 'inactive' };
		const { getByRole } = render(MemberEditDialog, { open: true, member: inactive });
		expect(getByRole('switch').getAttribute('aria-checked')).toBe('false');
	});

	it('renders nothing when member is null', () => {
		const { queryByText } = render(MemberEditDialog, { open: true, member: null });
		expect(queryByText('儲存')).toBeNull();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(MemberEditDialog, { open: false, member: acc });
		expect(queryByText('儲存')).toBeNull();
	});

	it('fires onSave(id, { name, phone, is_active }) with the edited values — payload 釘住', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByRole, getByText } = render(MemberEditDialog, {
			open: true,
			member: acc,
			onSave
		});

		await fireEvent.input(getByDisplayValue(acc.name), { target: { value: '王大明' } });
		await fireEvent.click(getByRole('switch')); // toggles active → inactive
		await fireEvent.click(getByText('儲存'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0]).toBe('u1');
		expect(onSave.mock.calls[0][1]).toEqual({ name: '王大明', phone: '0912345678', is_active: false });
	});

	it('不合法時(姓名 1 字)顯示 module 的錯誤、不呼叫 onSave', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(MemberEditDialog, { open: true, member: acc, onSave });

		await fireEvent.input(getByDisplayValue(acc.name), { target: { value: '王' } });
		await fireEvent.click(getByText('儲存'));

		expect(onSave).not.toHaveBeenCalled();
		expect(getByText(MEMBER_NAME_ERROR)).toBeInTheDocument();
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(MemberEditDialog, { open: true, member: acc, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	// Regression guard mirroring CoachEditDialog: the dialog is mounted once with
	// member=null/open=false; opening flips both props together on the SAME
	// instance, so the reset must be a single reactive block (member !== lastMember
	// || (open && !wasOpen)), not a two-stage wasOpen pair.
	it('opens on an already-mounted instance when open and member change together', async () => {
		const { rerender, getByDisplayValue } = render(MemberEditDialog, { open: false, member: null });
		await rerender({ open: true, member: acc });
		expect(getByDisplayValue(acc.name)).toBeInTheDocument();
	});

	it('swaps to a newly-assigned member without leaving stale data from the previous one behind', async () => {
		const other: MemberAccount = { ...acc, id: 'u2', name: '陳小華', phone: '0987654321' };
		const { rerender, getByDisplayValue, queryByDisplayValue } = render(MemberEditDialog, {
			open: true,
			member: acc
		});
		expect(getByDisplayValue(acc.name)).toBeInTheDocument();

		await rerender({ open: true, member: other });

		expect(getByDisplayValue(other.name)).toBeInTheDocument();
		expect(queryByDisplayValue(acc.name)).toBeNull();
	});

	it('re-opening the same member after 取消 discards the abandoned dirty draft', async () => {
		const { rerender, getByDisplayValue, queryByDisplayValue } = render(MemberEditDialog, {
			open: false,
			member: null
		});

		await rerender({ open: true, member: acc });
		await fireEvent.input(getByDisplayValue(acc.name), { target: { value: '髒草稿' } });
		expect(getByDisplayValue('髒草稿')).toBeInTheDocument();

		await rerender({ open: false, member: null }); // 取消 clears both props together
		await rerender({ open: true, member: acc }); // re-open the SAME member

		expect(getByDisplayValue(acc.name)).toBeInTheDocument();
		expect(queryByDisplayValue('髒草稿')).toBeNull();
	});
});
