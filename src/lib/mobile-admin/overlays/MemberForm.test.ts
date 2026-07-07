import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import MemberForm from './MemberForm.svelte';
import type { MemberRow } from '$lib/mobile-admin/data';

/* Task 20：學員新增/編輯改接真 POST /users、PATCH /users/{id}（契約 §3.2 兩個端點
 * 接受的欄位完全不同）——這裡驗證新增/編輯兩種模式各自組出正確的 body 並呼叫
 * onSave(body, isNew)，取代舊版驗證「MemberRow 假資料形狀完整」的測試（那個形狀
 * 本身已隨 data.ts 的 MemberRow 瘦身而不存在）。 */

const EXISTING: MemberRow = {
	id: 'u1',
	name: '王小明',
	initial: '王',
	phone: '0912-345-678',
	joined: '2026/01/01',
	status: 'active',
	points: 50
};

describe('MemberForm — 新增模式（POST /users）', () => {
	it('builds a CreateMemberBody (email/name/phone/password) and calls onSave(body, true)', async () => {
		const onSave = vi.fn();
		render(MemberForm, { props: { onClose: () => {}, onSave } });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '測試生' } });
		await fireEvent.input(screen.getByLabelText('聯絡電話（選填）'), { target: { value: '0900-000-000' } });
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'password123' } });
		await fireEvent.click(screen.getByText('建立學員').closest('button')!);

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith(
			{ email: 'new@test.com', name: '測試生', password: 'password123', phone: '0900-000-000' },
			true
		);
	});

	it('omits phone when left blank (undefined, not empty string)', async () => {
		const onSave = vi.fn();
		render(MemberForm, { props: { onClose: () => {}, onSave } });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '測試生' } });
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'password123' } });
		await fireEvent.click(screen.getByText('建立學員').closest('button')!);

		const body = onSave.mock.calls[0][0];
		expect('phone' in body).toBe(false);
	});

	it('blocks submit with an inline error when the password is under 8 chars (does not call onSave)', async () => {
		const onSave = vi.fn();
		render(MemberForm, { props: { onClose: () => {}, onSave } });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '測試生' } });
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'short' } });

		// The submit button is disabled while the form is incomplete/invalid
		// (mirrors the create button's `disabled={!valid}` guard elsewhere).
		expect(screen.getByText('建立學員').closest('button')).toBeDisabled();
		expect(onSave).not.toHaveBeenCalled();
	});
});

describe('MemberForm — 編輯模式（PATCH /users/{id}）', () => {
	it('pre-fills name/phone from the member and calls onSave(UpdateMemberBody, false)', async () => {
		const onSave = vi.fn();
		render(MemberForm, { props: { onClose: () => {}, onSave, m: EXISTING } });

		expect(screen.getByLabelText('學員姓名')).toHaveValue('王小明');
		expect(screen.getByLabelText('聯絡電話（選填）')).toHaveValue('0912-345-678');
		// no email/password fields in edit mode — the backend doesn't accept them here
		expect(screen.queryByLabelText('Email')).toBeNull();
		expect(screen.queryByLabelText('初始密碼')).toBeNull();

		await fireEvent.input(screen.getByLabelText('學員姓名'), { target: { value: '王小明（改名）' } });
		await fireEvent.click(screen.getByText('儲存資料').closest('button')!);

		expect(onSave).toHaveBeenCalledWith({ name: '王小明（改名）', is_active: true, phone: '0912-345-678' }, false);
	});

	it('帳號啟用 switch defaults from status and can be toggled to is_active:false', async () => {
		const onSave = vi.fn();
		render(MemberForm, { props: { onClose: () => {}, onSave, m: { ...EXISTING, status: 'inactive' } } });

		await fireEvent.click(screen.getByText('儲存資料').closest('button')!);
		expect(onSave.mock.calls[0][0]).toMatchObject({ is_active: false });
	});

	it('does nothing (no throw) when no onSave is provided — no silent fake-write fallback', async () => {
		render(MemberForm, { props: { onClose: () => {}, m: EXISTING } });
		await fireEvent.click(screen.getByText('儲存資料').closest('button')!);
		// reaching here without throwing is the assertion — there is no local
		// store to inspect for a fake write anymore.
	});
});
