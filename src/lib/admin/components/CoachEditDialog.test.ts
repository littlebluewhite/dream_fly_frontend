import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import CoachEditDialog from './CoachEditDialog.svelte';
import { COACHES, type Coach } from '$lib/admin/data';

/* CoachEditDialog — 編輯/新增共用一個對話框(Task F5 欄位收斂)。編輯模式收
 * name/title/tags/isActive，儲存時組出 CoachFormValues 交給 onSave；新增模式
 * (isNew)額外收 email/密碼(POST /users 用)。兩步流程(建 user→綁 coach)本身的
 * API 呼叫與失敗處理由呼叫端(routes/admin/coaches/+page.svelte)負責，這裡只驗證
 * 表單收欄位/驗證/onSave 的 payload。 */
const base: Coach = COACHES[0]; // 林雅婷，isActive: true

describe('CoachEditDialog — 編輯模式', () => {
	it('renders open pre-filled with the coach name/title/tags and the 儲存 primary', () => {
		const { getByDisplayValue, getByText } = render(CoachEditDialog, {
			open: true,
			coach: base
		});
		expect(getByDisplayValue(base.name)).toBeInTheDocument();
		expect(getByDisplayValue(base.title)).toBeInTheDocument();
		expect(getByDisplayValue(base.tags.join('、'))).toBeInTheDocument();
		expect(getByText('儲存')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(CoachEditDialog, { open: false, coach: base });
		expect(queryByText('儲存')).toBeNull();
	});

	it('has no email/password fields in edit mode (POST /users 不是這個模式的職責)', () => {
		const { queryByLabelText } = render(CoachEditDialog, { open: true, coach: base });
		expect(queryByLabelText('Email')).toBeNull();
		expect(queryByLabelText('初始密碼')).toBeNull();
	});

	it('公開顯示 switch 預設值取自 coach.isActive', () => {
		render(CoachEditDialog, { open: true, coach: { ...base, isActive: false } });
		expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
	});

	it('fires onSave with the edited name/title/tags/isActive when 儲存 clicked', async () => {
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
		expect(onSave.mock.calls[0][0]).toEqual({
			email: '',
			password: '',
			name: '陳測試',
			title: base.title,
			tags: base.tags,
			isActive: base.isActive
		});
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

	it('toggling 公開顯示 flows isActive:false through to onSave', async () => {
		const onSave = vi.fn();
		render(CoachEditDialog, { open: true, coach: base, onSave });
		await fireEvent.click(screen.getByRole('switch'));
		await fireEvent.click(screen.getByText('儲存'));
		expect(onSave.mock.calls[0][0].isActive).toBe(false);
	});

	it('blocks submit with an inline error when 職稱 is cleared (title 必填)', async () => {
		const onSave = vi.fn();
		const { getByDisplayValue, getByText } = render(CoachEditDialog, {
			open: true,
			coach: base,
			onSave
		});
		await fireEvent.input(getByDisplayValue(base.title), { target: { value: '   ' } });
		await fireEvent.click(getByText('儲存'));
		expect(onSave).not.toHaveBeenCalled();
		expect(getByText('請輸入職稱')).toBeInTheDocument();
	});

	it('calls onClose from the 取消 button', async () => {
		const onClose = vi.fn();
		const { getByText } = render(CoachEditDialog, { open: true, coach: base, onClose });
		await fireEvent.click(getByText('取消'));
		expect(onClose).toHaveBeenCalled();
	});

	// Regression (carried over from the pre-F5 dialog): the dialog is mounted
	// once, up front, with open=false/coach=null; 編輯/新增教練 then flips both
	// props on that already-mounted instance. A two-stage `wasOpen` reactive
	// pair never picked this up, so the dialog silently stayed shut.
	//
	// These use COACHES[2]/[3]/[4] rather than `base` (COACHES[0]): `base` gets
	// mutated by its own describe-block tests above via shared object identity
	// in some scenarios, so asserting against it here would depend on suite
	// execution order.
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

describe('CoachEditDialog — 新增模式（isNew，兩步流程第一步收 email/密碼）', () => {
	it('uses the 新增教練 title + 建立教練 primary, and shows email/password fields not present in edit mode', () => {
		const { getByText, getByLabelText } = render(CoachEditDialog, {
			open: true,
			coach: null,
			isNew: true
		});
		expect(getByText('新增教練')).toBeInTheDocument();
		expect(getByText('建立教練')).toBeInTheDocument();
		expect(getByLabelText('Email')).toBeInTheDocument();
		expect(getByLabelText('初始密碼')).toBeInTheDocument();
	});

	it('公開顯示 defaults to on (checked) for a brand-new coach', () => {
		render(CoachEditDialog, { open: true, coach: null, isNew: true });
		expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
	});

	it('blocks submit with an inline error when the password is under 8 chars (does not call onSave)', async () => {
		const onSave = vi.fn();
		render(CoachEditDialog, { open: true, coach: null, isNew: true, onSave });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'coach@test.com' } });
		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '新教練' } });
		await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), {
			target: { value: '體操教練' }
		});
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'short' } });
		await fireEvent.click(screen.getByText('建立教練'));

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByText('密碼至少需要 8 碼')).toBeInTheDocument();
	});

	it('blocks submit with an inline error when 職稱 is left blank (title 必填，coaches.title NOT NULL)', async () => {
		const onSave = vi.fn();
		render(CoachEditDialog, { open: true, coach: null, isNew: true, onSave });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'coach@test.com' } });
		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '新教練' } });
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'password123' } });
		await fireEvent.click(screen.getByText('建立教練'));

		expect(onSave).not.toHaveBeenCalled();
		expect(screen.getByText('請輸入職稱')).toBeInTheDocument();
	});

	it('builds a full CoachFormValues (email/password/name/title/tags/isActive) and calls onSave once valid', async () => {
		const onSave = vi.fn();
		render(CoachEditDialog, { open: true, coach: null, isNew: true, onSave });

		await fireEvent.input(screen.getByLabelText('Email'), { target: { value: 'coach@test.com' } });
		await fireEvent.input(screen.getByLabelText('教練姓名'), { target: { value: '新教練' } });
		await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), {
			target: { value: '體操教練' }
		});
		await fireEvent.input(screen.getByLabelText('專長標籤（以、分隔）'), {
			target: { value: '跑酷、體操' }
		});
		await fireEvent.input(screen.getByLabelText('初始密碼'), { target: { value: 'password123' } });
		await fireEvent.click(screen.getByText('建立教練'));

		expect(onSave).toHaveBeenCalledTimes(1);
		expect(onSave.mock.calls[0][0]).toEqual({
			email: 'coach@test.com',
			password: 'password123',
			name: '新教練',
			title: '體操教練',
			tags: ['跑酷', '體操'],
			isActive: true
		});
	});
});
