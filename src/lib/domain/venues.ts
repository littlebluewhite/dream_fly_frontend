/* Dream Fly — 場館 seed (single source of truth)
 * Data copied verbatim from src/lib/admin/data.ts.
 *
 * Task F4：欄位收斂到 VenueResponse 真實欄位——area/cap/今日排課(today)是後端無來源
 * 的裝飾欄位，已移除(見 admin/api.ts mapVenue() 註解)；新增 slug(VenueResponse.slug)
 * ，場館編輯對話框改顯示這個而非內部 id。 */

export interface Venue {
	id: string;
	slug: string;
	name: string;
	type: string;
	equip: string[];
	status: 'available' | 'maintenance';
}

export const VENUES: Venue[] = [
	{ id: 'A', slug: 'a', name: 'A 訓練館', type: '競技主訓練場', equip: ['彈翻床', '平衡木', '單槓', '海綿池'], status: 'available' },
	{ id: 'B', slug: 'b', name: 'B 教室', type: '兒童基礎教室', equip: ['軟墊', '低平衡木', '跳箱'], status: 'available' },
	{ id: 'C', slug: 'c', name: 'C 軟墊區', type: '幼兒啟蒙區', equip: ['軟墊', '海綿障礙', '彩虹梯'], status: 'available' },
	{ id: 'D', slug: 'd', name: '戶外場', type: '跑酷 / 體能', equip: ['跑酷箱', '欄架', '攀爬架'], status: 'maintenance' },
	{ id: 'E', slug: 'e', name: 'E 多功能教室', type: '律動 / 體適能', equip: ['地墊', '鏡牆', '律動球', '彈力帶'], status: 'available' },
	{ id: 'F', slug: 'f', name: 'F 體能訓練室', type: '重訓 / 體能', equip: ['槓鈴', '壺鈴', 'TRX', '跳箱'], status: 'available' }
];
