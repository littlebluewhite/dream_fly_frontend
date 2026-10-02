import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import MemberForm from './MemberForm.svelte';
import type { MemberAccount as MemberRow } from '$lib/admin/data';
import { MEMBER_NAME_ERROR, MEMBER_PASSWORD_ERROR } from '$lib/admin/components/member-request';

/* Task 20：學員新增/編輯改接真 POST /users、PATCH /users/{id}（契約 §3.2 兩個端點
 * 接受的欄位完全不同）——這裡驗證新增/編輯兩種模式各自呼叫 onCreate(body) / onUpdate(body)（回 true＝已存才關閉，false＝留著）。
 * 驗證在送出時做（同桌面，ADR-0023 §4）：無效 → 欄位顯示 module 常數、不呼叫。
 * R13 Task 4：body 規則住 member-request.ts(桌面同一份)，由 member-request.test.ts
 * 覆蓋；這裡只剩接線與 disabled。 */

const EXISTING: MemberRow = {
	id: 'u1',
	name: '王小明',
	initial: '王',
	phone: '0912-345-678',
	joined: '2026/01/01',
	status: 'active',
	points: 50
};

const fillNew = async (password = 'password123') => {
	await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
	await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '測試生' } });
	await fireEvent.input(screen.getByLabelText('聯絡電話（選填）'), { target: { value: '0900-000-000' } });
	await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: password } });
};
const submitNew = () => fireEvent.click(screen.getByText('建立學員').closest('button')!);

describe('MemberForm — 新增模式（POST /users）', () => {
	it('builds a CreateMemberBody and calls onCreate(body); closes after it resolves true', async () => {
		const onCreate = vi.fn().mockResolvedValue(true);
		const onClose = vi.fn();
		render(MemberForm, { props: { onClose, onCreate } });
		await fillNew();
		await submitNew();

		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(onCreate).toHaveBeenCalledWith({ email: 'new@test.com', name: '測試生', password: 'password123', phone: '0900-000-000' });
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});

	it('invalid password: submit shows MEMBER_PASSWORD_ERROR and does not call onCreate (button not disabled)', async () => {
		const onCreate = vi.fn();
		render(MemberForm, { props: { onClose: () => {}, onCreate } });
		await fillNew('short');

		const btn = screen.getByText('建立學員').closest('button')!;
		expect(btn).not.toBeDisabled();
		await fireEvent.click(btn);

		expect(screen.getByText(MEMBER_PASSWORD_ERROR)).toBeInTheDocument();
		expect(onCreate).not.toHaveBeenCalled();
	});

	it('stays open when onCreate resolves false', async () => {
		const onCreate = vi.fn().mockResolvedValue(false);
		const onClose = vi.fn();
		render(MemberForm, { props: { onClose, onCreate } });
		await fillNew();
		await submitNew();

		await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
		await Promise.resolve();
		expect(onClose).not.toHaveBeenCalled();
		expect(screen.getByText('建立學員').closest('button')).not.toBeDisabled();
	});

	it('disables the button only while saving', async () => {
		let resolve!: (v: boolean) => void;
		const onCreate = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
		render(MemberForm, { props: { onClose: () => {}, onCreate } });
		await fillNew();
		await submitNew();

		await waitFor(() => expect(screen.getByText('建立學員').closest('button')).toBeDisabled());
		resolve(false);
		await waitFor(() => expect(screen.getByText('建立學員').closest('button')).not.toBeDisabled());
	});
});

describe('MemberForm — 編輯模式（PATCH /users/{id}）', () => {
	it('pre-fills name/phone from the member and calls onUpdate(UpdateMemberBody)', async () => {
		const onUpdate = vi.fn().mockResolvedValue(true);
		const onClose = vi.fn();
		render(MemberForm, { props: { onClose, onUpdate, m: EXISTING } });

		expect(screen.getByLabelText('學員姓名')).toHaveValue('王小明');
		expect(screen.getByLabelText('聯絡電話（選填）')).toHaveValue('0912-345-678');
		// no email/password fields in edit mode — the backend doesn't accept them here
		expect(screen.queryByLabelText('Email')).toBeNull();
		expect(screen.queryByLabelText('初始密碼')).toBeNull();

		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '王小明（改名）' } });
		await fireEvent.click(screen.getByText('儲存資料').closest('button')!);

		expect(onUpdate).toHaveBeenCalledWith({ name: '王小明（改名）', is_active: true, phone: '0912-345-678' });
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});

	it('帳號啟用 switch defaults from status and can be toggled to is_active:false', async () => {
		const onUpdate = vi.fn().mockResolvedValue(true);
		render(MemberForm, { props: { onClose: () => {}, onUpdate, m: { ...EXISTING, status: 'inactive' } } });

		await fireEvent.click(screen.getByText('儲存資料').closest('button')!);
		expect(onUpdate.mock.calls[0][0]).toMatchObject({ is_active: false });
	});

	it('invalid name: shows the error and does not call onUpdate', async () => {
		const onUpdate = vi.fn();
		render(MemberForm, { props: { onClose: () => {}, onUpdate, m: EXISTING } });
		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '王' } });
		await fireEvent.click(screen.getByText('儲存資料').closest('button')!);

		expect(screen.getByText(MEMBER_NAME_ERROR)).toBeInTheDocument();
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('stays open when onUpdate resolves false', async () => {
		const onUpdate = vi.fn().mockResolvedValue(false);
		const onClose = vi.fn();
		render(MemberForm, { props: { onClose, onUpdate, m: EXISTING } });
		await fireEvent.click(screen.getByText('儲存資料').closest('button')!);

		await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
		await Promise.resolve();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('does nothing (no throw) when no handler is provided — no silent fake-write fallback', async () => {
		const onClose = vi.fn();
		render(MemberForm, { props: { onClose, m: EXISTING } });
		await fireEvent.click(screen.getByText('儲存資料').closest('button')!);
		expect(onClose).not.toHaveBeenCalled();
	});
});
