/* Dream Fly — 場館 seed (single source of truth)
 * Data copied verbatim from src/lib/admin/data.ts. */

export interface Venue {
	id: string;
	name: string;
	type: string;
	area: string;
	cap: number;
	equip: string[];
	status: 'available' | 'maintenance';
	today: number;
}

export const VENUES: Venue[] = [
	{ id: 'A', name: 'A 訓練館', type: '競技主訓練場', area: '180 ㎡', cap: 16, equip: ['彈翻床', '平衡木', '單槓', '海綿池'], status: 'available', today: 4 },
	{ id: 'B', name: 'B 教室', type: '兒童基礎教室', area: '96 ㎡', cap: 12, equip: ['軟墊', '低平衡木', '跳箱'], status: 'available', today: 3 },
	{ id: 'C', name: 'C 軟墊區', type: '幼兒啟蒙區', area: '72 ㎡', cap: 10, equip: ['軟墊', '海綿障礙', '彩虹梯'], status: 'available', today: 3 },
	{ id: 'D', name: '戶外場', type: '跑酷 / 體能', area: '240 ㎡', cap: 14, equip: ['跑酷箱', '欄架', '攀爬架'], status: 'maintenance', today: 0 },
	{ id: 'E', name: 'E 多功能教室', type: '律動 / 體適能', area: '110 ㎡', cap: 14, equip: ['地墊', '鏡牆', '律動球', '彈力帶'], status: 'available', today: 2 },
	{ id: 'F', name: 'F 體能訓練室', type: '重訓 / 體能', area: '88 ㎡', cap: 10, equip: ['槓鈴', '壺鈴', 'TRX', '跳箱'], status: 'available', today: 1 }
];
