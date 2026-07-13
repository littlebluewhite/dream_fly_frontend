import { describe, it, expect, vi } from 'vitest';
import { saveNewCoach, saveCoachEdit, type SaveNewCoachDeps, type SaveCoachEditDeps } from './coach-save';
import type { CoachFormValues } from '$lib/admin/data';
import { ApiError } from '$lib/api/client';

/* coach-save.ts — admin/coaches 新增/編輯教練兩階段 async 編排器的單元測試(K4，自
 * coaches/+page.svelte 的 saveNew/saveEdit 抽出)。模組無狀態:deps 全部注入
 * vi.fn() mock，每個 it 各自呼叫 makeNewCoachDeps()/makeEditDeps() 建立全新 mock，
 * 不共用 module-level 狀態、不需要 beforeEach 做 mockReset——vitest v4 對
 * beforeEach 隱式回傳 mock(cleanup 誤判)的陷阱因此不適用(見 makeXxxDeps() 慣例)。
 *
 * coachBody() 不 export(計畫明文)，其 title/specialties/is_active 映射正確性經
 * createCoach/updateCoach 實際收到的 body 斷言覆蓋(見下方兩個「body 映射」測試)。 */

function makeNewCoachDeps(): SaveNewCoachDeps {
	return { createMember: vi.fn(), createCoach: vi.fn() };
}
function makeEditDeps(): SaveCoachEditDeps {
	return { updateMember: vi.fn(), updateCoach: vi.fn() };
}

const V: CoachFormValues = {
	email: 'coach@test.com',
	password: 'password123',
	name: '新教練',
	title: '兼任教練',
	tags: ['地板動作'],
	isActive: true
};

describe('saveNewCoach — 新增教練兩步序列(createMember → createCoach)', () => {
	it('兩步皆成功:依序呼叫 createMember 再 createCoach(帶正確 user_id)，回傳 {kind:"created"}', async () => {
		const deps = makeNewCoachDeps();
		const callOrder: string[] = [];
		vi.mocked(deps.createMember).mockImplementation(async () => {
			callOrder.push('createMember');
			return { id: 'u-new' };
		});
		vi.mocked(deps.createCoach).mockImplementation(async () => {
			callOrder.push('createCoach');
			return {};
		});

		const outcome = await saveNewCoach(V, null, deps);

		expect(callOrder).toEqual(['createMember', 'createCoach']);
		expect(deps.createMember).toHaveBeenCalledWith({ email: V.email, name: V.name, password: V.password });
		expect(deps.createCoach).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u-new' }));
		expect(outcome).toEqual({ kind: 'created' });
	});

	it('body 映射(coachBody 經 deps 觀測):createCoach 收到的 title/specialties/is_active 對應 v.title/v.tags/v.isActive', async () => {
		const deps = makeNewCoachDeps();
		vi.mocked(deps.createMember).mockResolvedValue({ id: 'u-new' });
		vi.mocked(deps.createCoach).mockResolvedValue({});

		await saveNewCoach({ ...V, title: '全職教練', tags: ['地板', '跳馬'], isActive: false }, null, deps);

		expect(deps.createCoach).toHaveBeenCalledWith({
			user_id: 'u-new',
			title: '全職教練',
			specialties: ['地板', '跳馬'],
			is_active: false
		});
	});

	it('首步失敗不打次步:createMember rejects → 不呼叫 createCoach，回傳 {kind:"userCreateFailed", error}', async () => {
		const deps = makeNewCoachDeps();
		const err = new ApiError(409, 'Email 已被使用');
		vi.mocked(deps.createMember).mockRejectedValue(err);

		const outcome = await saveNewCoach(V, null, deps);

		expect(deps.createCoach).not.toHaveBeenCalled();
		expect(outcome).toEqual({ kind: 'userCreateFailed', error: err });
	});

	it('哨兵發回:次步失敗(無 pendingUserId)→ 回傳 {kind:"coachBindFailed", pendingUserId:新建 userId, error}', async () => {
		const deps = makeNewCoachDeps();
		vi.mocked(deps.createMember).mockResolvedValue({ id: 'u-orphan' });
		const err = new ApiError(500, 'internal error');
		vi.mocked(deps.createCoach).mockRejectedValue(err);

		const outcome = await saveNewCoach(V, null, deps);

		expect(outcome).toEqual({ kind: 'coachBindFailed', pendingUserId: 'u-orphan', error: err });
	});

	it('重試跳步:pendingUserId 有值時不再呼叫 createMember，createCoach 用同一個 user_id 綁定', async () => {
		const deps = makeNewCoachDeps();
		vi.mocked(deps.createCoach).mockResolvedValue({});

		const outcome = await saveNewCoach(V, 'u-orphan', deps);

		expect(deps.createMember).not.toHaveBeenCalled();
		expect(deps.createCoach).toHaveBeenCalledWith(expect.objectContaining({ user_id: 'u-orphan' }));
		expect(outcome).toEqual({ kind: 'created' });
	});

	it('哨兵不漂移:帶著 pendingUserId 重試成功後，outcome 精確等於 {kind:"created"}(不殘留 pendingUserId 欄位)', async () => {
		const deps = makeNewCoachDeps();
		vi.mocked(deps.createCoach).mockResolvedValue({});

		const outcome = await saveNewCoach(V, 'u-orphan', deps);

		expect(Object.keys(outcome)).toEqual(['kind']);
	});
});

describe('saveCoachEdit — 編輯教練(姓名 trim 判定 + updateMember/updateCoach 順序)', () => {
	const current = { id: 'co1', userId: 'u1', name: '林雅婷' };

	it('trim 視為未變:名字前後空白差異、trim 後與現值相同 → 不呼叫 updateMember，只呼叫 updateCoach，回傳 {kind:"saved"}', async () => {
		const deps = makeEditDeps();
		vi.mocked(deps.updateCoach).mockResolvedValue({});

		const outcome = await saveCoachEdit({ ...V, name: '  林雅婷  ' }, current, deps);

		expect(deps.updateMember).not.toHaveBeenCalled();
		expect(deps.updateCoach).toHaveBeenCalledTimes(1);
		expect(outcome).toEqual({ kind: 'saved' });
	});

	it('callOrder 先 users 後 coaches:姓名有變 → 依序呼叫 updateMember(userId,{name}) 再 updateCoach(id,body)', async () => {
		const deps = makeEditDeps();
		const callOrder: string[] = [];
		vi.mocked(deps.updateMember).mockImplementation(async () => {
			callOrder.push('updateMember');
			return {};
		});
		vi.mocked(deps.updateCoach).mockImplementation(async () => {
			callOrder.push('updateCoach');
			return {};
		});

		const outcome = await saveCoachEdit({ ...V, name: '改名教練' }, current, deps);

		expect(callOrder).toEqual(['updateMember', 'updateCoach']);
		expect(deps.updateMember).toHaveBeenCalledWith('u1', { name: '改名教練' });
		expect(outcome).toEqual({ kind: 'saved' });
	});

	it('中止:updateMember 失敗即中止，不呼叫 updateCoach，回傳 {kind:"nameUpdateFailed", error}', async () => {
		const deps = makeEditDeps();
		const err = new ApiError(422, '姓名不符規則');
		vi.mocked(deps.updateMember).mockRejectedValue(err);

		const outcome = await saveCoachEdit({ ...V, name: '改名教練' }, current, deps);

		expect(deps.updateCoach).not.toHaveBeenCalled();
		expect(outcome).toEqual({ kind: 'nameUpdateFailed', error: err });
	});

	it('中止(次步失敗回 coachUpdateFailed):姓名未變、updateCoach 失敗 → 回傳 {kind:"coachUpdateFailed", error}', async () => {
		const deps = makeEditDeps();
		const err = new ApiError(422, 'invalid coach payload');
		vi.mocked(deps.updateCoach).mockRejectedValue(err);

		const outcome = await saveCoachEdit({ ...V, name: current.name }, current, deps);

		expect(outcome).toEqual({ kind: 'coachUpdateFailed', error: err });
	});

	it('error 透傳原物:outcome.error 與拋出物是同一參考，不轉換不包裝', async () => {
		const deps = makeEditDeps();
		const err = new ApiError(422, 'invalid coach payload');
		vi.mocked(deps.updateCoach).mockRejectedValue(err);

		const outcome = await saveCoachEdit({ ...V, name: current.name }, current, deps);

		expect(outcome.kind).toBe('coachUpdateFailed');
		if (outcome.kind === 'coachUpdateFailed') {
			expect(outcome.error).toBe(err); // 同一參考(===)，非重新包裝的新物件
		}
	});

	it('body 映射(編輯路徑):updateCoach 收到的 title/specialties/is_active 對應 v.title/v.tags/v.isActive', async () => {
		const deps = makeEditDeps();
		vi.mocked(deps.updateCoach).mockResolvedValue({});

		await saveCoachEdit(
			{ ...V, name: current.name, title: '資深教練', tags: ['吊環'], isActive: false },
			current,
			deps
		);

		expect(deps.updateCoach).toHaveBeenCalledWith('co1', {
			title: '資深教練',
			specialties: ['吊環'],
			is_active: false
		});
	});
});
