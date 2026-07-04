/* Dream Fly — public/marketing surface adapters：cents/enum/id 轉換的唯一位置。
 * 頁面一律吃這裡轉出的形狀渲染，不自行 /100、不自行查 enum 表。
 *
 * `CatalogCourse`（本檔案定義）與 member surface 的同名型別（lib/domain/member-app.ts）
 * 形狀不同、互不相干 —— member 版本 id 是 number 且多一個 icon 欄位，這裡的
 * id 是後端來的 uuid string。`Coach` 則直接沿用既有行銷用型別（lib/data/coaches.ts），
 * 該檔的 `id` 欄位已放寬為 `number | string` 以容納真實教練的 uuid。 */

import type { ApiCourse, ApiCoach } from './api';
import type { Coach } from '$lib/data/coaches';

/** 全前端唯一 cents→NT$ 轉換點。 */
export const ntd = (cents: number): number => Math.round(cents / 100);

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

/** `coachName` 由呼叫端解出（CoachResponse 沒有姓名欄位，需靠 course.coach_id 對照
 *  教練列表後傳入 —— 通常也只能是 toMarketingCoach 裡同樣 fallback 用的 title）。 */
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

/** CoachResponse 沒有姓名欄位（見 integration-contract.md §3.4 附註 — 姓名存在
 *  users 表、公開端點不 join 出來，本次任務範圍外）。只能沿用 `title`
 *  （職稱文字）作為卡片標題與大頭貼縮寫的替代來源；`years`（資歷徒手數字）同樣
 *  無對應欄位，誠實留空而非用正規表示式硬猜 `experience` 段落。 */
export function toMarketingCoach(c: ApiCoach): Coach {
	return {
		id: c.id,
		slug: c.slug ?? '',
		name: c.title,
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

/** ProductResponse（integration-contract.md §3.7）的 wire 形狀。本任務尚未有頁面
 *  消費 toPass（/tickets 接線不在本任務檔案清單內），先落地形狀 + 轉換供後續任務使用。 */
export interface ApiProduct {
	id: string;
	name: string;
	slug: string;
	product_type: string;
	description: string | null;
	price_cents: number;
	original_price_cents: number | null;
	features: string[];
	is_highlighted: boolean;
	badge: string | null;
	stock: number | null;
	valid_days: number | null;
	session_count: number | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

/** 行銷購票頁（/tickets）用的方案卡形狀（pass id 同樣從此任務起改為 uuid string）。 */
export interface Ticket {
	id: string;
	name: string;
	price: number;
	desc: string;
	features: string[];
}

export function toPass(p: ApiProduct): Ticket {
	return {
		id: p.id,
		name: p.name,
		price: ntd(p.price_cents),
		desc: p.description ?? '',
		features: p.features
	};
}
