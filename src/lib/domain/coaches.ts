/* src/lib/domain/coaches.ts — Coach 型別
 *
 * Task F5：欄位收斂到 CoachResponse 真實欄位（見 admin/api.ts mapCoach() 註解）——
 * 移除 years/students/awards/classes/status(獨立線上/忙碌/離線版)/phone 等無後端
 * 來源欄位；新增 userId(users.id，PATCH /users/{user_id} 改名用)、isActive
 * (coaches.is_active)。color 保留——純視覺裝飾用途（同 Ticket/Order 的 color 欄位），
 * 不是表單可編輯欄位。
 *
 * R15(候選 F-3，誠實開機)：seed 值 COACHES 已搬到 $lib/testing/seed-fixtures(供測試
 * 建夾具用)——mobile-admin 的 coaches store 誠實開機為 `[]`，本檔不再有 production
 * 讀者，只留型別本體(ADR-0010 死值不留死出口)。 */

export interface Coach {
	id: string;
	/** users.id（coaches.user_id）—— 姓名改走 PATCH /users/{user_id} 時要用這個，不是
	 *  上面的教練列 id。 */
	userId: string;
	name: string;
	initial: string;
	title: string;
	color: string;
	tags: string[];
	/** coaches.is_active —— 是否於公開教練頁 / 課程頁顯示（GET /coaches 只回
	 *  is_active=true 的教練，見 admin/api.ts mapCoach() 註解）。 */
	isActive: boolean;
}
