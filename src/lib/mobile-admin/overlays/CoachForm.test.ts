import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import CoachForm from './CoachForm.svelte';
import type { Coach } from '$lib/mobile-admin/data';

/* Task F5：教練新增/編輯改接真 POST /coaches、PATCH /coaches/{id}（契約 §3.4，
 * 兩步流程的第二步）——這裡驗證新增/編輯兩種模式各自組出正確的 CoachFormValues
 * 並呼叫 onSave(values, isNew)，取代舊版驗證「本地 store 假寫入」的測試（見桌面
 * CoachEditDialog.test.ts 的對應收斂）。 */

const EXISTING: Coach = {
	id: 'c1',
	userId: 'u1',
	name: '林雅婷',
	initial: '林',
	title: '資深競技體操教練',
	color: '#0066CC',
	tags: ['競技體操', '競技啦啦隊'],
	isActive: true
};

describe('CoachForm — 新增模式（兩步流程第一步：收 email/密碼）', () => {
	it('builds a full CoachFormValues and calls onSave(values, true)', async () => {
		const onSave = vi.fn();
		render(CoachForm, { props: { onClose: () => {}, onSave } });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '新教練' } });
		await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), {
			target: { value: '兼任教練' }
		});
		await fireEvent.input(screen.getByLabelText('專長標籤（以、分隔）'), {
			target: { value: '跑酷、體操' }
		});
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'password123' } });
		await fireEvent.click(screen.getByText('建立教練'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave).toHaveBeenCalledWith(
			{
				email: 'new@test.com',
				password: 'password123',
				name: '新教練',
				title: '兼任教練',
				tags: ['跑酷', '體操'],
				isActive: true
			},
			true
		);
	});

	it('blocks submit (disabled 建立教練) when the password is under 8 chars', async () => {
		const onSave = vi.fn();
		render(CoachForm, { props: { onClose: () => {}, onSave } });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '新教練' } });
		await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), {
			target: { value: '兼任教練' }
		});
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'short' } });

		expect(screen.getByText('建立教練').closest('button')).toBeDisabled();
		expect(onSave).not.toHaveBeenCalled();
	});

	it('公開顯示 defaults to on (checked) for a brand-new coach', () => {
		render(CoachForm, { props: { onClose: () => {} } });
		expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
	});
});

describe('CoachForm — 編輯模式（PATCH /coaches/{id}，姓名變動另觸發 PATCH /users/{user_id}）', () => {
	it('pre-fills name/title/tags from the coach and calls onSave(values, false)', async () => {
		const onSave = vi.fn();
		render(CoachForm, { props: { onClose: () => {}, onSave, c: EXISTING } });

		expect(screen.getByLabelText('教練姓名')).toHaveValue('林雅婷');
		expect(screen.getByLabelText('職稱 / 專業', { exact: false })).toHaveValue('資深競技體操教練');
		expect(screen.getByLabelText('專長標籤（以、分隔）')).toHaveValue('競技體操、競技啦啦隊');
		// no email/password fields in edit mode — the backend doesn't accept them here
		expect(screen.queryByLabelText('Email')).toBeNull();
		expect(screen.queryByLabelText('初始密碼')).toBeNull();

		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '林雅婷（改名）' } });
		await fireEvent.click(screen.getByText('儲存'));

		expect(onSave).toHaveBeenCalledWith(
			{
				email: '',
				password: '',
				name: '林雅婷（改名）',
				title: '資深競技體操教練',
				tags: ['競技體操', '競技啦啦隊'],
				isActive: true
			},
			false
		);
	});

	it('公開顯示 switch defaults from coach.isActive and can be toggled to false', async () => {
		const onSave = vi.fn();
		render(CoachForm, { props: { onClose: () => {}, onSave, c: { ...EXISTING, isActive: false } } });

		expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
		await fireEvent.click(screen.getByText('儲存'));
		expect(onSave.mock.calls[0][0]).toMatchObject({ isActive: false });
	});

	it('blocks submit with an inline error when 職稱 is cleared (title 必填)', async () => {
		const onSave = vi.fn();
		render(CoachForm, { props: { onClose: () => {}, onSave, c: EXISTING } });

		await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), {
			target: { value: '   ' }
		});
		await fireEvent.click(screen.getByText('儲存'));

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByText('請輸入職稱')).toBeInTheDocument();
	});

	it('does nothing (no throw) when no onSave is provided — no silent fake-write fallback', async () => {
		render(CoachForm, { props: { onClose: () => {}, c: EXISTING } });
		await fireEvent.click(screen.getByText('儲存'));
		// reaching here without throwing is the assertion — there is no local
		// saveCoach() store to inspect for a fake write anymore.
	});
});
