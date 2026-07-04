/* Dream Fly — public/marketing surface adapters：cents/enum/id 轉換的唯一位置。
 * 頁面一律吃這裡轉出的形狀渲染，不自行 /100、不自行查 enum 表。
 *
 * `CatalogCourse`（本檔案定義）與 member surface 的同名型別（lib/domain/member-app.ts）
 * 形狀不同、互不相干 —— member 版本 id 是 number 且多一個 icon 欄位，這裡的
 * id 是後端來的 uuid string。`Coach` 則直接沿用既有行銷用型別（lib/data/coaches.ts），
 * 該檔的 `id` 欄位已放寬為 `number | string` 以容納真實教練的 uuid。 */

import type { ApiCourse, ApiCoach, ApiProduct } from './api';
import type { Coach } from '$lib/data/coaches';

/** 全前端唯一 cents→NT$ 轉換點。 */
export const ntd = (cents: number): number => Math.round(cents / 100);

/** `ntd` 的反向：全前端唯一 NT$→cents 轉換點（Task 8：admin 寫入表單金額送出前經此
 *  轉換，不在呼叫端各自 `* 100`）。 */
export const toCents = (ntd: number): number => Math.round(ntd * 100);

/** 訂單品項摘要（member `src/lib/member/api.ts` mapOrder 與 admin `src/lib/admin/api.ts`
 *  mapAdminOrder 共用，避免兩處各自實作同一份措辭）。對應 `OrderSummary`/
 *  `AdminOrderSummary.items`（見 integration-contract.md §3.10）：`{ name, quantity }[]`，
 *  `name` 是下單當時的快照，非即時查目錄。
 *  0 項 → fallback（理論上不會發生 —— 結帳前購物車不可為空，此為防禦性分支，呼叫端
 *  傳入原本的 `訂單 ${order_number}` 佔位字串）；1 項 → 該項名稱；N>1 項 →
 *  「第一項名稱 外 N-1 項」。 */
export function orderItemsSummary(
	items: { name: string; quantity: number }[],
	fallback: string
): string {
	if (items.length === 0) return fallback;
	if (items.length === 1) return items[0].name;
	return `${items[0].name} 外 ${items.length - 1} 項`;
}

/** 後端 level enum（beginner/intermediate/advanced）→ 繁中 label；
 *  未知值 fallback 回原字串，不會讓頁面因為後端新增 enum 值而炸掉。 */
const LEVEL_LABEL: Record<string, string> = {
	beginner: '初級',
	intermediate: '中級',
	advanced: '高級'
};

/** 課程介紹頁（/courses）用的課程卡形狀。 */
export interface CatalogCourse {
	id: string;
	name: string;
	level: string;
	cat: string;
	age: string;
	days: string;
	price: number;
	hot: boolean;
	coach: string;
	desc: string;
	spots: number;
}

/** `[min_age, max_age]` 組成顯示用字串；兩者皆缺時回傳空字串。 */
function ageRange(min: number | null, max: number | null): string {
	if (min != null && max != null) return `${min}–${max} 歲`;
	if (min != null) return `${min} 歲以上`;
	if (max != null) return `${max} 歲以下`;
	return '';
}

/** `coachName` 由呼叫端解出（`CourseResponse` 本身沒有教練姓名欄位，需靠
 *  course.coach_id 對照教練列表後傳入 —— 教練列表現在帶 `name`，見 toMarketingCoach）。 */
export function toCatalogCourse(c: ApiCourse, coachName?: string): CatalogCourse {
	return {
		id: c.id,
		name: c.name,
		level: LEVEL_LABEL[c.level] ?? c.level,
		cat: c.category ?? '',
		age: ageRange(c.min_age, c.max_age),
		days: c.schedule_text ?? '',
		price: ntd(c.price_cents),
		hot: c.is_highlighted,
		coach: coachName ?? '',
		desc: c.description ?? '',
		spots: Math.max(0, c.max_students - c.enrolled_count)
	};
}

/** CoachResponse 現帶 `name`（教練真實姓名，join users.name）與 `title`（職稱，如
 *  「資深體操教練」）——兩者不同語意，分開映射（見 integration-contract.md §3.4）。
 *  `years`（資歷純數字）仍無對應欄位，誠實留空而非用正規表示式硬猜 `experience` 段落。 */
export function toMarketingCoach(c: ApiCoach): Coach {
	return {
		id: c.id,
		slug: c.slug ?? '',
		name: c.name,
		title: c.title,
		discipline: c.specialties[0] ?? '',
		years: '',
		tags: c.specialties.slice(0, 2),
		specialties: c.specialties,
		experience: c.experience ?? '',
		certifications: c.certifications,
		photo: c.photo_url ?? undefined
	};
}

/** 行銷購票頁（/tickets）用的方案卡形狀（pass id 同樣從此任務起改為 uuid string）。
 *  badge/highlighted/originalPrice 是純展示用 merchandising 欄位 —— 只進票卡渲染，
 *  不進購物車（CartItem 不帶它們）。 */
export interface Ticket {
	id: string;
	name: string;
	price: number;
	desc: string;
	features: string[];
	badge?: string;
	highlighted?: boolean;
	originalPrice?: number; // NT$（原價，有折扣時才有）
}

export function toPass(p: ApiProduct): Ticket {
	return {
		id: p.id,
		name: p.name,
		price: ntd(p.price_cents),
		desc: p.description ?? '',
		features: p.features,
		badge: p.badge ?? undefined,
		highlighted: p.is_highlighted,
		originalPrice: p.original_price_cents != null ? ntd(p.original_price_cents) : undefined
	};
}
