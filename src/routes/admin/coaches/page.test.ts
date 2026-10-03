import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import { get } from 'svelte/store';
import CoachesPage from './+page.svelte';
import type { CoachResponse } from '$lib/api/generated';
import { toasts } from '$lib/admin/stores';
import { api, ApiError } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { ADMIN_ROUTES, apiBody, apiCalls } from '$lib/testing/admin-routes';
import { coachResponse, userResponse } from '$lib/testing/wire-fixtures';

/* W-8：改 mock $lib/api/client 的 api()，getCoaches/createCoach/updateCoach/
 * createMember/updateMember 走真 mapper(GET/POST /coaches、PATCH /coaches/{id}、
 * POST /users、PATCH /users/{id})。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

const COACHES: CoachResponse[] = [
	coachResponse({ id: 'c1', user_id: 'u1', name: '林雅婷', title: '資深競技體操教練', specialties: ['競技啦啦隊', '競技體操'] }),
	coachResponse({ id: 'c2', user_id: 'u2', name: '陳冠宇', title: '兒童體操主教練', specialties: ['兒童基礎', '幼兒體操'] }),
	coachResponse({ id: 'c3', user_id: 'u3', name: '黃詩涵', title: '幼兒啟蒙教練', specialties: ['幼兒體操', '親子課'] }),
	coachResponse({ id: 'c4', user_id: 'u4', name: '王思齊', title: '跑酷與成人體操教練', specialties: ['跑酷', '成人體操'], is_active: false })
];

const route = (overrides: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(fakeRouter({ 'GET /coaches': COACHES, ...overrides }, ADMIN_ROUTES));

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

/* 教練團隊 (admin.jsx CoachesView): PageHead + a card grid over COACHES. Data now
 * arrives through GET /coaches (async), so every assertion first
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

	it('renders every coach name from GET /coaches', async () => {
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
		route({ 'GET /coaches': new Error('network') });
		const { findByText } = render(CoachesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(api).mockReturnValue(new Promise(() => {}));
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
	it('新增教練（兩步皆成功）：先 POST /users 拿 user_id，再 POST /coaches({user_id,...})，成功後刷新列表並關閉對話框', async () => {
		const created = coachResponse({ id: 'co-new', user_id: 'u-new', name: '新教練', title: '兼任教練' });
		const refreshed = [...COACHES, created];

		const { getByText, findByText, queryByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		await fireEvent.click(getByText('新增教練'));
		await fillNewCoachForm();

		route({
			'GET /coaches': refreshed,
			'POST /users': userResponse({ id: 'u-new', name: '新教練', email: 'coach@test.com' }),
			'POST /coaches': created
		});
		await fireEvent.click(getByText('建立教練'));

		await vi.waitFor(() => expect(apiCalls('POST /users')).toHaveLength(1));
		expect(apiBody('POST /users')).toEqual({
			email: 'coach@test.com',
			name: '新教練',
			password: 'password123'
		});
		await vi.waitFor(() => expect(apiCalls('POST /coaches')).toHaveLength(1));
		expect(apiBody('POST /coaches')).toEqual({
			user_id: 'u-new',
			title: '兼任教練',
			specialties: [],
			is_active: true
		});

		await findByText('新教練'); // 刷新後的列表包含新教練
		expect(apiCalls('GET /coaches')).toHaveLength(2); // 初次載入 + 建立成功後刷新
		expect(queryByText('建立教練')).toBeNull(); // 對話框已關閉
	});

	it('新增教練第一步失敗（POST /users，409 email 重複）→ 顯示錯誤 toast，不打 POST /coaches，對話框維持開啟', async () => {
		route({ 'POST /users': new ApiError(409, 'Email 已被使用') });

		const { getByText, findByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		await fireEvent.click(getByText('新增教練'));
		await fillNewCoachForm({ email: 'dup@test.com' });
		await fireEvent.click(getByText('建立教練'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toContain('Email 已被使用'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(apiCalls('POST /coaches')).toHaveLength(0);
		expect(await findByText('建立教練')).toBeInTheDocument(); // 對話框仍開著（EditModal busy 鎖落定後才回到這個標籤，見 findByText）
		expect(apiCalls('GET /coaches')).toHaveLength(1); // 失敗不刷新
	});

	it('兩步流程第二步失敗（帳號已建、POST /coaches 失敗）→ 明確錯誤 toast、不做回滾；同一對話框工作階段內重試只補打第二步（不重打 POST /users）', async () => {
		route({
			'POST /users': userResponse({ id: 'u-orphan', name: '孤兒帳號', email: 'orphan@test.com' }),
			'POST /coaches': new ApiError(500, 'internal error')
		});

		const { getByText, findByText, queryByText } = render(CoachesPage);
		await findByText(COACHES[0].name);
		await fireEvent.click(getByText('新增教練'));
		await fillNewCoachForm({ email: 'orphan@test.com', name: '孤兒帳號' });
		await fireEvent.click(getByText('建立教練'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.title).toBe('教練綁定失敗'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(get(toasts).at(-1)?.body).toContain('帳號「orphan@test.com」已建立');
		expect(await findByText('建立教練')).toBeInTheDocument(); // 對話框仍開著，可重試（EditModal busy 鎖落定後才回到這個標籤，見 findByText）
		expect(apiCalls('GET /coaches')).toHaveLength(1); // 失敗不刷新
		expect(apiCalls('POST /users')).toHaveLength(1);
		expect(apiCalls('POST /coaches')).toHaveLength(1);

		// 重試：同一個對話框工作階段內再按一次「建立教練」——這次 POST /coaches 成功。
		const created = coachResponse({ id: 'co-orphan', user_id: 'u-orphan', name: '孤兒帳號', title: '兼任教練' });
		route({
			'GET /coaches': [...COACHES, created],
			'POST /users': new ApiError(409, 'Email 已被使用'),
			'POST /coaches': created
		});

		await fireEvent.click(getByText('建立教練'));

		await vi.waitFor(() => expect(apiCalls('POST /coaches')).toHaveLength(2));
		// 重試不應該重打 POST /users（會因為 email 已被使用而 409）。
		expect(apiCalls('POST /users')).toHaveLength(1);
		expect(apiBody('POST /coaches', 1)).toMatchObject({ user_id: 'u-orphan' });

		await findByText('孤兒帳號');
		expect(queryByText('建立教練')).toBeNull(); // 這次成功，對話框關閉
	});

	it('編輯教練（姓名未變，只改教練欄位）：只打 PATCH /coaches/{id}，不打 PATCH /users/{id}', async () => {
		const target = COACHES[0];
		const updated = { ...target, title: '改職稱' };
		const refreshed = COACHES.map((c) => (c.id === target.id ? updated : c));

		const { container, getByText, getByDisplayValue, findByText } = render(CoachesPage);
		await findByText(target.name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[0]);
		await fireEvent.input(getByDisplayValue(target.title), { target: { value: '改職稱' } });

		route({ 'GET /coaches': refreshed, [`PATCH /coaches/${target.id}`]: updated });
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(apiCalls(`PATCH /coaches/${target.id}`)).toHaveLength(1));
		expect(apiCalls(`PATCH /users/${target.user_id}`)).toHaveLength(0);
		expect(apiBody(`PATCH /coaches/${target.id}`)).toEqual({
			title: '改職稱',
			specialties: target.specialties,
			is_active: target.is_active
		});

		await findByText('改職稱');
		expect(apiCalls('GET /coaches')).toHaveLength(2);
	});

	it('編輯教練（姓名有變）：依序打 PATCH /users/{user_id}({name}) 再 PATCH /coaches/{id}，皆成功後刷新', async () => {
		const target = COACHES[1];
		const updated = { ...target, name: '改名教練' };
		const refreshed = COACHES.map((c) => (c.id === target.id ? updated : c));

		const { container, getByText, getByDisplayValue, findByText } = render(CoachesPage);
		await findByText(target.name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[1]);
		await fireEvent.input(getByDisplayValue(target.name), { target: { value: '改名教練' } });

		route({
			'GET /coaches': refreshed,
			[`PATCH /users/${target.user_id}`]: userResponse({ id: target.user_id, name: '改名教練' }),
			[`PATCH /coaches/${target.id}`]: updated
		});
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(apiCalls(`PATCH /coaches/${target.id}`)).toHaveLength(1));
		expect(apiCalls(`PATCH /users/${target.user_id}`)).toHaveLength(1);
		expect(apiBody(`PATCH /users/${target.user_id}`)).toEqual({ name: '改名教練' });
		const writes = vi
			.mocked(api)
			.mock.calls.filter(([, init]) => init?.method === 'PATCH')
			.map(([p]) => p);
		expect(writes).toEqual([`/users/${target.user_id}`, `/coaches/${target.id}`]); // 順序：先 users 後 coaches

		await findByText('改名教練');
		expect(apiCalls('GET /coaches')).toHaveLength(2);
	});

	it('編輯教練：姓名變更那支（PATCH /users/{user_id}）失敗即中止，不繼續打 PATCH /coaches/{id}', async () => {
		const target = COACHES[2];
		route({ [`PATCH /users/${target.user_id}`]: new ApiError(422, '姓名不符規則') });

		const { container, getByText, getByDisplayValue, findByText } = render(CoachesPage);
		await findByText(target.name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[2]);
		await fireEvent.input(getByDisplayValue(target.name), { target: { value: '改名教練' } });
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toContain('姓名不符規則'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(apiCalls(`PATCH /coaches/${target.id}`)).toHaveLength(0);
		expect(apiCalls('GET /coaches')).toHaveLength(1);
	});

	it('編輯教練失敗（422，PATCH /coaches/{id}）→ 顯示繁中錯誤 toast，列表維持原值', async () => {
		const target = COACHES[3];
		route({ [`PATCH /coaches/${target.id}`]: new ApiError(422, 'invalid coach payload') });

		const { container, getByText, findByText } = render(CoachesPage);
		await findByText(target.name);
		const pencils = container.querySelectorAll('button[aria-label="編輯教練"]');
		await fireEvent.click(pencils[3]);
		await fireEvent.click(getByText('儲存'));

		await vi.waitFor(() => expect(get(toasts).at(-1)?.body).toContain('不符規則'));
		expect(get(toasts).at(-1)?.tone).toBe('error');
		expect(apiCalls(`PATCH /users/${target.user_id}`)).toHaveLength(0); // 姓名未變，不該打 /users
		expect(await findByText(target.name)).toBeInTheDocument();
		expect(apiCalls('GET /coaches')).toHaveLength(1);
	});
});
