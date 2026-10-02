import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen, waitFor } from '@testing-library/svelte';
import CoachForm from './CoachForm.svelte';
import type { Coach } from '$lib/domain/coaches';
import { COACH_PASSWORD_ERROR, COACH_TITLE_ERROR } from '$lib/admin/components/coach-save';

/* Task F5：教練新增/編輯改接真 POST /coaches、PATCH /coaches/{id}（契約 §3.4，
 * 兩步流程的第二步）——這裡驗證新增/編輯兩種模式各自組出正確的 CoachFormValues
 * 並呼叫 onCreate(values) / onUpdate(values)（回 true 才關閉），取代舊版驗證「本地 store 假寫入」的測試（見桌面
 * CoachEditDialog.test.ts 的對應收斂）。R13 Task 4：驗證規則住 coach-save.ts，
 * 這裡只驗接線與送出時顯示 module 常數（不 disable）。 */

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
	it('builds a full CoachFormValues and calls onCreate(values)', async () => {
		const onCreate = vi.fn().mockResolvedValue(true);
		const onClose = vi.fn();
		render(CoachForm, { props: { onClose, onCreate } });

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

		expect(onCreate).toHaveBeenCalledTimes(1);
		expect(onCreate).toHaveBeenCalledWith({
			email: 'new@test.com',
			password: 'password123',
			name: '新教練',
			title: '兼任教練',
			tags: ['跑酷', '體操'],
			isActive: true
		});
		await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
	});

	it('stays open when onCreate resolves false; button disabled only while saving', async () => {
		let resolve!: (v: boolean) => void;
		const onCreate = vi.fn(() => new Promise<boolean>((r) => (resolve = r)));
		const onClose = vi.fn();
		render(CoachForm, { props: { onClose, onCreate } });
		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '新教練' } });
		await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), { target: { value: '兼任教練' } });
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'password123' } });
		await fireEvent.click(screen.getByText('建立教練'));

		await waitFor(() => expect(screen.getByText('建立教練').closest('button')).toBeDisabled());
		resolve(false);
		await waitFor(() => expect(screen.getByText('建立教練').closest('button')).not.toBeDisabled());
		expect(onClose).not.toHaveBeenCalled();
	});

	it('invalid password: submit shows COACH_PASSWORD_ERROR and does not call onCreate', async () => {
		const onCreate = vi.fn();
		render(CoachForm, { props: { onClose: () => {}, onCreate } });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'new@test.com' } });
		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '新教練' } });
		await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), {
			target: { value: '兼任教練' }
		});
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'short' } });

		const btn = screen.getByText('建立教練').closest('button')!;
		expect(btn).not.toBeDisabled();
		await fireEvent.click(btn);
		expect(screen.getByText(COACH_PASSWORD_ERROR)).toBeInTheDocument();
		expect(onCreate).not.toHaveBeenCalled();
	});

	it('公開顯示 defaults to on (checked) for a brand-new coach', () => {
		render(CoachForm, { props: { onClose: () => {} } });
		expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
	});
});

describe('CoachForm — 編輯模式（PATCH /coaches/{id}，姓名變動另觸發 PATCH /users/{user_id}）', () => {
	it('pre-fills name/title/tags from the coach and calls onUpdate(values)', async () => {
		const onUpdate = vi.fn().mockResolvedValue(true);
		render(CoachForm, { props: { onClose: () => {}, onUpdate, c: EXISTING } });

		expect(screen.getByLabelText('教練姓名')).toHaveValue('林雅婷');
		expect(screen.getByLabelText('職稱 / 專業', { exact: false })).toHaveValue('資深競技體操教練');
		expect(screen.getByLabelText('專長標籤（以、分隔）')).toHaveValue('競技體操、競技啦啦隊');
		// no email/password fields in edit mode — the backend doesn't accept them here
		expect(screen.queryByLabelText('Email')).toBeNull();
		expect(screen.queryByLabelText('初始密碼')).toBeNull();

		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '林雅婷（改名）' } });
		await fireEvent.click(screen.getByText('儲存'));

		expect(onUpdate).toHaveBeenCalledWith({
			email: '',
			password: '',
			name: '林雅婷（改名）',
			title: '資深競技體操教練',
			tags: ['競技體操', '競技啦啦隊'],
			isActive: true
		});
	});

	it('公開顯示 switch defaults from coach.isActive and can be toggled to false', async () => {
		const onUpdate = vi.fn().mockResolvedValue(true);
		render(CoachForm, { props: { onClose: () => {}, onUpdate, c: { ...EXISTING, isActive: false } } });

		expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
		await fireEvent.click(screen.getByText('儲存'));
		expect(onUpdate.mock.calls[0][0]).toMatchObject({ isActive: false });
	});

	it('cleared 職稱: submit shows COACH_TITLE_ERROR and does not call onUpdate', async () => {
		const onUpdate = vi.fn();
		render(CoachForm, { props: { onClose: () => {}, onUpdate, c: EXISTING } });

		await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), {
			target: { value: '   ' }
		});

		await fireEvent.click(screen.getByText('儲存'));
		expect(screen.getByText(COACH_TITLE_ERROR)).toBeInTheDocument();
		expect(onUpdate).not.toHaveBeenCalled();
	});

	it('stays open when onUpdate resolves false', async () => {
		const onUpdate = vi.fn().mockResolvedValue(false);
		const onClose = vi.fn();
		render(CoachForm, { props: { onClose, onUpdate, c: EXISTING } });
		await fireEvent.click(screen.getByText('儲存'));
		await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
		await Promise.resolve();
		expect(onClose).not.toHaveBeenCalled();
	});

	it('does nothing (no throw) when no handler is provided — no silent fake-write fallback', async () => {
		render(CoachForm, { props: { onClose: () => {}, c: EXISTING } });
		await fireEvent.click(screen.getByText('儲存'));
		// reaching here without throwing is the assertion — there is no local
		// saveCoach() store to inspect for a fake write anymore.
	});
});
