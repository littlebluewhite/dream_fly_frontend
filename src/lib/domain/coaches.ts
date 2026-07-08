/* src/lib/domain/coaches.ts — 教練 seed data
 *
 * Task F5：欄位收斂到 CoachResponse 真實欄位（見 admin/api.ts mapCoach() 註解）——
 * 移除 years/students/awards/classes/status(獨立線上/忙碌/離線版)/phone 等無後端
 * 來源欄位；新增 userId(users.id，PATCH /users/{user_id} 改名用)、isActive
 * (coaches.is_active)。color 保留——純視覺裝飾用途（同 Ticket/Order 的 color 欄位），
 * 不是表單可編輯欄位。 */

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

export const COACHES: Coach[] = [
	{ id: 'c1', userId: 'u1', name: '林雅婷', initial: '林', title: '資深競技體操教練 · 國家級認證', color: '#0066CC', tags: ['競技啦啦隊', '競技體操'], isActive: true },
	{ id: 'c2', userId: 'u2', name: '陳冠宇', initial: '陳', title: '兒童體操主教練 · 體操C級教練', color: '#0EA5E9', tags: ['兒童基礎', '幼兒體操'], isActive: true },
	{ id: 'c3', userId: 'u3', name: '黃詩涵', initial: '黃', title: '幼兒啟蒙教練 · 幼兒體適能認證', color: '#10B981', tags: ['幼兒體操', '親子課'], isActive: true },
	{ id: 'c4', userId: 'u4', name: '王思齊', initial: '王', title: '跑酷與成人體操教練', color: '#F59E0B', tags: ['跑酷', '成人體操'], isActive: false },
	{ id: 'c5', userId: 'u5', name: '張育誠', initial: '張', title: '競技啦啦隊助理教練', color: '#8B5CF6', tags: ['競技啦啦隊'], isActive: false },
	{ id: 'c6', userId: 'u6', name: '周曉彤', initial: '周', title: '競技啦啦隊編排教練 · 啦啦隊 B 級', color: '#EC4899', tags: ['競技啦啦隊'], isActive: true },
	{ id: 'c7', userId: 'u7', name: '蘇建宏', initial: '蘇', title: '體能與跑酷專項教練 · 體適能C級', color: '#14B8A6', tags: ['跑酷', '成人體操'], isActive: true },
	{ id: 'c8', userId: 'u8', name: '李孟潔', initial: '李', title: '幼兒啟蒙教練 · 幼兒體適能認證', color: '#0EA5E9', tags: ['幼兒體操', '親子課'], isActive: true },
	{ id: 'c9', userId: 'u9', name: '鄭凱文', initial: '鄭', title: '成人體操與體能教練 · 重訓專項', color: '#F59E0B', tags: ['成人體操', '跑酷'], isActive: true }
];
