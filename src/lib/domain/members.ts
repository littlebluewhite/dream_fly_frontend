/* src/lib/domain/members.ts — MemberAccountStatus 查表
 *
 * R15(候選 F-3，誠實開機)：MemberStatus 型別／MemberBase 介面／本檔原本的學員種子
 * 陣列已退役——唯一消費者 mobile-admin/data.ts 的學員 builder 隨誠實開機一併移除
 * (值改由真 GET /users 水合，見 mobile-admin/stores.ts opsGate)。下方查表不受影響，
 * 仍是 GET /users 的 is_active 二元旗標投影單源。 */

import type { Tone } from '$lib/api/wire';

/** 學員帳號啟用狀態（GET /users 的 is_active 二元旗標）。 */
export type MemberAccountStatus = 'active' | 'inactive';

/** MemberAccount 專用（GET /users 的 is_active 布林值）。 */
export const MEMBER_ACCOUNT_STATUS: Record<MemberAccountStatus, [Tone, string]> = {
	active: ['success', '啟用中'],
	inactive: ['neutral', '已停用']
};
