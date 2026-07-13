/* Dream Fly — 管理後台 · 教練建立/編輯兩階段 async 編排器（K4，自 coaches/+page.svelte
 * 的 saveNew/saveEdit 抽出）。無狀態純函式：呼叫端傳入目前表單值、（新增用）哨兵
 * pendingUserId 或（編輯用）目前教練資料，以及一組注入的 API 函式；回傳 outcome 判別
 * 聯集，讓頁面依 kind 翻譯成對應的 toast 文案與哨兵狀態更新——本模組不呼叫 toast、不
 * 持有任何狀態（哨兵的儲存/生命週期留頁面，見 +page.svelte 檔頭註解）。
 *
 * 新增（saveNewCoach）：先 createMember 建帳拿 user_id，再 createCoach 綁定。
 * pendingUserId 非 null（上次綁定失敗留下的哨兵）時跳過 createMember，直接用它重打
 * createCoach——避免同一對話框工作階段內的重試撞 email 409。第二步失敗時，outcome
 * 把（沿用或新建立的）userId 原樣發回（coachBindFailed.pendingUserId），呼叫端存回
 * 哨兵供下次重試。
 *
 * 編輯（saveCoachEdit）：姓名 trim 後與現值不同才呼叫 updateMember（PATCH
 * /users/{user_id}）；教練欄位一律呼叫 updateCoach（PATCH /coaches/{id}）。兩者皆
 * 可能執行時依序執行——先 users 後 coaches，任一失敗即中止，不繼續打下一支。
 *
 * 兩支 mapper（apiErrorMessage/coachErrorMessage）留頁面（ADR 0011）——本模組的
 * error 欄位一律是原始拋出物，不做文案轉換。 */
import type { CoachFormValues } from '$lib/admin/data';

/** deps 用最小結構型別——只描述本模組實際用到的參數/回傳形狀，不 import 真正的函式
 *  簽名（`$lib/admin/api` 的型別皆為 `import type`，零 runtime 耦合）。呼叫端
 *  （+page.svelte）直接把 admin/api 的 createMember/createCoach 原函式當 deps 傳入
 *  即可協變相容：createMember 真正回傳 MemberAccount ⊇ {id}；createCoach 真正接受
 *  的 CoachWriteBody 各欄位皆選填，比這裡宣告的必填子集更寬鬆（一個滿足必填子集的
 *  物件必然也滿足全選填的 CoachWriteBody）。 */
export interface SaveNewCoachDeps {
	createMember: (body: { email: string; name: string; password: string }) => Promise<{ id: string }>;
	createCoach: (body: {
		user_id: string;
		title: string;
		specialties: string[];
		is_active: boolean;
	}) => Promise<unknown>;
}

export interface SaveCoachEditDeps {
	updateMember: (id: string, body: { name: string }) => Promise<unknown>;
	updateCoach: (
		id: string,
		body: { title: string; specialties: string[]; is_active: boolean }
	) => Promise<unknown>;
}

/** 新增教練 outcome：哪一步失敗由呼叫端決定用哪支 error mapper 升為文案——
 *  userCreateFailed 透傳 apiErrorMessage，coachBindFailed 查表 coachErrorMessage
 *  （皆留頁面）。coachBindFailed 攜帶的 pendingUserId 是本次（沿用或新建立）的
 *  user_id，供呼叫端存回哨兵。 */
export type SaveNewCoachOutcome =
	| { kind: 'created' }
	| { kind: 'userCreateFailed'; error: unknown }
	| { kind: 'coachBindFailed'; pendingUserId: string; error: unknown };

export type SaveCoachEditOutcome =
	| { kind: 'saved' }
	| { kind: 'nameUpdateFailed'; error: unknown }
	| { kind: 'coachUpdateFailed'; error: unknown };

/** CoachFormValues → createCoach/updateCoach 共用 body（title/specialties/
 *  is_active）。不 export——正確性經呼叫端測試對 deps.createCoach/updateCoach 實際
 *  收到的 body 斷言覆蓋，不需要獨立單元測試（見 coach-save.test.ts 的「body 映射」
 *  測試）。 */
function coachBody(v: CoachFormValues): { title: string; specialties: string[]; is_active: boolean } {
	return { title: v.title, specialties: v.tags, is_active: v.isActive };
}

/** 新增教練兩步序列。pendingUserId 非 null 時跳過 createMember（重試補打第二步，同
 *  user_id 綁定）。 */
export async function saveNewCoach(
	v: CoachFormValues,
	pendingUserId: string | null,
	deps: SaveNewCoachDeps
): Promise<SaveNewCoachOutcome> {
	let userId = pendingUserId;
	if (!userId) {
		try {
			userId = (await deps.createMember({ email: v.email, name: v.name, password: v.password })).id;
		} catch (error) {
			return { kind: 'userCreateFailed', error };
		}
	}
	try {
		await deps.createCoach({ user_id: userId, ...coachBody(v) });
	} catch (error) {
		return { kind: 'coachBindFailed', pendingUserId: userId, error };
	}
	return { kind: 'created' };
}

/** 編輯教練：姓名 trim 後有變才 updateMember，教練欄位一律 updateCoach；先 users
 *  後 coaches，任一失敗即中止。 */
export async function saveCoachEdit(
	v: CoachFormValues,
	current: { id: string; userId: string; name: string },
	deps: SaveCoachEditDeps
): Promise<SaveCoachEditOutcome> {
	if (v.name.trim() !== current.name) {
		try {
			await deps.updateMember(current.userId, { name: v.name.trim() });
		} catch (error) {
			return { kind: 'nameUpdateFailed', error };
		}
	}
	try {
		await deps.updateCoach(current.id, coachBody(v));
	} catch (error) {
		return { kind: 'coachUpdateFailed', error };
	}
	return { kind: 'saved' };
}
