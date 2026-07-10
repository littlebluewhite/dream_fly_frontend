import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CoachesPage from './+page.svelte';
import { COACHES } from '$lib/admin/data';
import { getCoaches, createCoach, updateCoach, createMember, updateMember } from '$lib/admin/api';
import { toasts } from '$lib/admin/stores';
import { ApiError } from '$lib/api/client';

vi.mock('$lib/admin/api', () => ({
	getCoaches: vi.fn(),
	createCoach: vi.fn(),
	updateCoach: vi.fn(),
	createMember: vi.fn(),
	updateMember: vi.fn()
}));

beforeEach(() => {
	vi.mocked(getCoaches).mockReset();
	vi.mocked(getCoaches).mockResolvedValue({ coaches: COACHES });
	vi.mocked(createCoach).mockReset();
	vi.mocked(updateCoach).mockReset();
	vi.mocked(createMember).mockReset();
	vi.mocked(updateMember).mockReset();
});

/* 教練團隊 (admin.jsx CoachesView): PageHead + a card grid over COACHES. Data now
 * arrives through the getCoaches() seam (async), so every assertion first
 * awaits the ready phase.
 *
 * Clicking a card's 編輯教練 pencil opens CoachEditDialog pre-filled with that
 * coach's data (regression coverage for the reactive reset guard lives in
 * CoachEditDialog.test.ts). */
describe('教練團隊 (+page)', () => {
	it('renders the PageHead title and 新增教練 action', async () => {
		const { container, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		const txt = container.textContent ?? '';
		expect(txt).toContain('教練團隊');
		expect(txt).toContain('新增教練');
	});

	it('renders every coach name from COACHES', async () => {
		const { container, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		const txt = container.textContent ?? '';
		for (const c of COACHES) {
			expect(txt).toContain(c.name);
		}
	});

	it('renders one 編輯教練 pencil button per coach', async () => {
		const { container, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		expect(pencils).toHaveLength(COACHES.length);
	});

	it('opens CoachEditDialog pre-filled when the 編輯教練 pencil is clicked', async () => {
		const { container, getByText, getByDisplayValue, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);

		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[0]);

		expect(getByText('編輯教練')).toBeInTheDocument();
		expect(getByDisplayValue(COACHES[0].name)).toBeInTheDocument();
	});

	it('opens CoachEditDialog in new mode (新增教練 dialog) when the header 新增教練 is clicked', async () => {
		const { getByText, queryByText, findByText } = render(CoachesPage);
		await findByText('新增教練');
		expect(queryByText('建立教練')).toBeNull();
		await fireEvent.click(getByText('新增教練'));
		expect(getByText('建立教練')).toBeInTheDocument();
	});
});

describe('教練團隊 — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getCoaches).mockReset();
		vi.mocked(getCoaches).mockRejectedValue(new Error('network'));
		const { findByText } = render(CoachesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getCoaches).mockReset();
		vi.mocked(getCoaches).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(CoachesPage);
		expect(getByTestId('coaches-skeleton')).toBeTruthy();
	});
});

/** 填寫「新增教練」對話框的必填欄位（email/教練姓名/職稱/初始密碼）；tags 留空
 *  （測試不需要）。 */
async function fillNewCoachForm(
	opts: { email?: string; name?: string; title?: string; password?: string } = {}
) {
	await fireEvent.input(screen.getByLabelText('Email'), {
		target: { value: opts.email ?? 'coach@test.com' }
	});
	await fireEvent.input(screen.getByLabelText('教練姓名'), {
		target: { value: opts.name ?? '新教練' }
	});
	await fireEvent.input(screen.getByLabelText('職稱 / 專業', { exact: false }), {
		target: { value: opts.title ?? '兼任教練' }
	});
	await fireEvent.input(screen.getByLabelText('初始密碼'), {
		target: { value: opts.password ?? 'password123' }
	});
}

describe('教練團隊 — 新增/編輯接真 API（Task F5：兩步流程 POST /users → POST /coaches）', () => {
	it('新增教練（兩步皆成功）：先呼叫 createMember 拿 user_id，再呼叫 createCoach({user_id,...})，成功後刷新列表並關閉對話框', async () => {
		vi.mocked(createMember).mockResolvedValue({
			id: 'u-new',
			name: '新教練',
			initial: '新',
			phone: '',
			joined: '2026-07-08',
			status: 'active',
			points: 0
		});
		vi.mocked(createCoach).mockResolvedValue({
			id: 'co-new', user_id: 'u-new', name: '新教練', title: '兼任教練', bio: null, experience: null,
			specialties: [], certifications: [], is_active: true, display_order: 0, slug: null,
			photo_url: null, created_at: ''
		} as never);
		const refreshed = [...COACHES, { ...COACHES[0], id: 'co-new', userId: 'u-new', name: '新教練' }];

		const { getByText, findByText, queryByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		await fireEvent.click(getByText('新增教練'));
		await fillNewCoachForm();

		vi.mocked(getCoaches).mockResolvedValue({ coaches: refreshed });
		await fireEvent.click(getByText('建立教練'));

		await vi.waitFor(() => expect(createMember).toHaveBeenCalledTimes(1));
		expect(vi.mocked(createMember).mock.calls[0][0]).toEqual({
			email: 'coach@test.com',
			name: '新教練',
			password: 'password123'
		});
		await vi.waitFor(() => expect(createCoach).toHaveBeenCalledTimes(1));
		expect(vi.mocked(createCoach).mock.calls[0][0]).toEqual({
			user_id: 'u-new',
			title: '兼任教練',
			specialties: [],
			is_active: true
		});

		await findByText('新教練'); // 刷新後的列表包含新教練
		expect(getCoaches).toHaveBeenCalledTimes(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立教練')).toBeNull(); // 對話框已關閉
	});

	it('新增教練第一步失敗（createMember，409 email 重複）→ 顯示錯誤 toast，不呼叫 createCoach，對話框維持開啟', async () => {
		vi.mocked(createMember).mockRejectedValue(new ApiError(409, 'Email 已被使用'));

		const { getByText, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		await fireEvent.click(getByText('新增教練'));
		await fillNewCoachForm({ email: 'dup@test.com' });
		await fireEvent.click(getByText('建立教練'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toContain('Email 已被使用'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(createCoach).not.toHaveBeenCalled();
		expect(await findByText('建立教練')).toBeInTheDocument(); // 對話框仍開著（EditModal busy 鎖落定後才回到這個標籤，見 findByText）
		expect(getCoaches).toHaveBeenCalledTimes(1); // 失敗不刷新
	});

	it('兩步流程第二步失敗（帳號已建、createCoach 失敗）→ 明確錯誤 toast、不做回滾；同一對話框工作階段內重試只補打第二步（不重打 createMember）', async () => {
		vi.mocked(createMember).mockResolvedValue({
			id: 'u-orphan',
			name: '孤兒帳號',
			initial: '孤',
			phone: '',
			joined: '2026-07-08',
			status: 'active',
			points: 0
		});
		vi.mocked(createCoach).mockRejectedValueOnce(new ApiError(500, 'internal error'));

		const { getByText, findByText, queryByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		await fireEvent.click(getByText('新增教練'));
		await fillNewCoachForm({ email: 'orphan@test.com', name: '孤兒帳號' });
		await fireEvent.click(getByText('建立教練'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.title).toBe('教練綁定失敗'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('帳號「orphan@test.com」已建立');
		expect(await findByText('建立教練')).toBeInTheDocument(); // 對話框仍開著，可重試（EditModal busy 鎖落定後才回到這個標籤，見 findByText）
		expect(getCoaches).toHaveBeenCalledTimes(1); // 失敗不刷新
		expect(createMember).toHaveBeenCalledTimes(1);
		expect(createCoach).toHaveBeenCalledTimes(1);

		// 重試：同一個對話框工作階段內再按一次「建立教練」——這次 createCoach 成功。
		vi.mocked(createCoach).mockResolvedValueOnce({
			id: 'co-orphan', user_id: 'u-orphan', name: '孤兒帳號', title: '兼任教練', bio: null,
			experience: null, specialties: [], certifications: [], is_active: true, display_order: 0,
			slug: null, photo_url: null, created_at: ''
		} as never);
		const refreshed = [...COACHES, { ...COACHES[0], id: 'co-orphan', userId: 'u-orphan', name: '孤兒帳號' }];
		vi.mocked(getCoaches).mockResolvedValue({ coaches: refreshed });

		await fireEvent.click(getByText('建立教練'));

		await vi.waitFor(() => expect(createCoach).toHaveBeenCalledTimes(2));
		// 重試不應該重打 createMember（會因為 email 已被使用而 409）。
		expect(createMember).toHaveBeenCalledTimes(1);
		expect(vi.mocked(createCoach).mock.calls[1][0]).toMatchObject({ user_id: 'u-orphan' });

		await findByText('孤兒帳號');
		expect(queryByText('建立教練')).toBeNull(); // 這次成功，對話框關閉
	});

	it('編輯教練（姓名未變，只改教練欄位）：只呼叫 updateCoach，不呼叫 updateMember', async () => {
		const target = COACHES[0];
		vi.mocked(updateCoach).mockResolvedValue({
			id: target.id, user_id: target.userId, name: target.name, title: '改職稱', bio: null,
			experience: null, specialties: target.tags, certifications: [], is_active: target.isActive,
			display_order: 0, slug: null, photo_url: null, created_at: ''
		} as never);
		const refreshed = COACHES.map((c) => (c.id === target.id ? { ...c, title: '改職稱' } : c));

		const { container, getByText, getByDisplayValue, findByText } = render(CoachesPage);
		await findByText(target.name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[0]);
		await fireEvent.input(getByDisplayValue(target.title), { target: { value: '改職稱' } });

		vi.mocked(getCoaches).mockResolvedValue({ coaches: refreshed });
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(updateCoach).toHaveBeenCalledTimes(1));
		expect(updateMember).not.toHaveBeenCalled();
		expect(vi.mocked(updateCoach).mock.calls[0][0]).toBe(target.id);
		expect(vi.mocked(updateCoach).mock.calls[0][1]).toEqual({
			title: '改職稱',
			specialties: target.tags,
			is_active: target.isActive
		});

		await findByText('改職稱');
		expect(getCoaches).toHaveBeenCalledTimes(2);
	});

	it('編輯教練（姓名有變）：依序呼叫 updateMember(userId,{name}) 再 updateCoach(id,...)，皆成功後刷新', async () => {
		const target = COACHES[1];
		const callOrder: string[] = [];
		vi.mocked(updateMember).mockImplementation(async () => {
			callOrder.push('updateMember');
			return {
				id: target.userId, name: '改名教練', initial: '改', phone: '', joined: '2026-01-01',
				status: 'active', points: 0
			};
		});
		vi.mocked(updateCoach).mockImplementation(async () => {
			callOrder.push('updateCoach');
			return {
				id: target.id, user_id: target.userId, name: '改名教練', title: target.title, bio: null,
				experience: null, specialties: target.tags, certifications: [], is_active: target.isActive,
				display_order: 0, slug: null, photo_url: null, created_at: ''
			} as never;
		});
		const refreshed = COACHES.map((c) => (c.id === target.id ? { ...c, name: '改名教練' } : c));

		const { container, getByText, getByDisplayValue, findByText } = render(CoachesPage);
		await findByText(target.name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[1]);
		await fireEvent.input(getByDisplayValue(target.name), { target: { value: '改名教練' } });

		vi.mocked(getCoaches).mockResolvedValue({ coaches: refreshed });
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(updateCoach).toHaveBeenCalledTimes(1));
		expect(updateMember).toHaveBeenCalledTimes(1);
		expect(vi.mocked(updateMember).mock.calls[0]).toEqual([target.userId, { name: '改名教練' }]);
		expect(callOrder).toEqual(['updateMember', 'updateCoach']); // 順序：先 users 後 coaches

		await findByText('改名教練');
		expect(getCoaches).toHaveBeenCalledTimes(2);
	});

	it('編輯教練：姓名變更那支（updateMember）失敗即中止，不繼續打 updateCoach', async () => {
		const target = COACHES[2];
		vi.mocked(updateMember).mockRejectedValue(new ApiError(422, '姓名不符規則'));

		const { container, getByText, getByDisplayValue, findByText } = render(CoachesPage);
		await findByText(target.name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[2]);
		await fireEvent.input(getByDisplayValue(target.name), { target: { value: '改名教練' } });
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toContain('姓名不符規則'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(updateCoach).not.toHaveBeenCalled();
		expect(getCoaches).toHaveBeenCalledTimes(1);
	});

	it('編輯教練失敗（422，updateCoach）→ 顯示繁中錯誤 toast，列表維持原值', async () => {
		const target = COACHES[3];
		vi.mocked(updateCoach).mockRejectedValue(new ApiError(422, 'invalid coach payload'));

		const { container, getByText, findByText } = render(CoachesPage);
		await findByText(target.name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[3]);
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toContain('不符規則'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(updateMember).not.toHaveBeenCalled(); // 姓名未變，不該打 /users
		expect(await findByText(target.name)).toBeInTheDocument();
		expect(getCoaches).toHaveBeenCalledTimes(1);
	});
});
