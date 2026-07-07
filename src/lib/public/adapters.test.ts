import { describe, it, expect } from 'vitest';
import { ntd, toCents, toCatalogCourse, toMarketingCoach, toPass, orderItemsSummary } from './adapters';
import type { ApiCourse, ApiCoach, ApiProduct } from './api';

describe('ntd — 全前端唯一 cents→NT$ 轉換點', () => {
	it('converts whole-dollar cents', () => {
		expect(ntd(320000)).toBe(3200);
	});

	it('rounds half up (Math.round semantics)', () => {
		expect(ntd(35050)).toBe(351); // 350.5 → 351
	});

	it('handles zero', () => {
		expect(ntd(0)).toBe(0);
	});
});

describe('toCents — 全前端唯一 NT$→cents 轉換點（ntd 的反向)', () => {
	it('converts whole NT$ amounts', () => {
		expect(toCents(3200)).toBe(320000);
	});

	it('rounds half up (Math.round semantics)', () => {
		expect(toCents(3.005)).toBe(301); // 300.5 → 301
	});

	it('handles zero', () => {
		expect(toCents(0)).toBe(0);
	});

	it('round-trips through ntd for whole-dollar amounts', () => {
		expect(ntd(toCents(4800))).toBe(4800);
	});
});

function makeApiCourse(overrides: Partial<ApiCourse> = {}): ApiCourse {
	return {
		id: 'course-uuid-1',
		name: '幼兒體操 啟蒙班',
		slug: 'kids-gym-intro',
		level: 'beginner',
		description: '描述文字',
		duration_minutes: 60,
		price_cents: 320000,
		max_students: 10,
		min_age: 3,
		max_age: 6,
		features: ['基礎翻滾'],
		is_active: true,
		coach_id: 'coach-uuid-1',
		category: '幼兒體操',
		schedule_text: '週六 10:00',
		is_highlighted: true,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		enrolled_count: 8,
		waitlist_count: 0,
		...overrides
	};
}

describe('toCatalogCourse', () => {
	it('maps every field (uuid id passthrough, level label, age range, price/100, spots remaining, coachName)', () => {
		const c = makeApiCourse();
		expect(toCatalogCourse(c, '黃教練')).toEqual({
			id: 'course-uuid-1',
			name: '幼兒體操 啟蒙班',
			level: '入門',
			cat: '幼兒體操',
			age: '3–6 歲',
			days: '週六 10:00',
			price: 3200,
			hot: true,
			coach: '黃教練',
			desc: '描述文字',
			spots: 2 // max_students 10 - enrolled_count 8
		});
	});

	it('falls back to the raw level string for an unknown enum value', () => {
		const c = makeApiCourse({ level: 'expert' });
		expect(toCatalogCourse(c).level).toBe('expert');
	});

	it('maps all 5 canonical course_level enum values to their 繁中 label via the shared $lib/domain/course-level constant (FE#17 補完公開路徑 — foundation/elite no longer fall back to the raw enum string)', () => {
		expect(toCatalogCourse(makeApiCourse({ level: 'foundation' })).level).toBe('啟蒙');
		expect(toCatalogCourse(makeApiCourse({ level: 'beginner' })).level).toBe('入門');
		expect(toCatalogCourse(makeApiCourse({ level: 'intermediate' })).level).toBe('基礎');
		expect(toCatalogCourse(makeApiCourse({ level: 'advanced' })).level).toBe('進階');
		expect(toCatalogCourse(makeApiCourse({ level: 'elite' })).level).toBe('選手');
	});

	it('defaults coach to an empty string when no coachName is passed', () => {
		expect(toCatalogCourse(makeApiCourse()).coach).toBe('');
	});

	it('clamps spots at 0 rather than going negative when overbooked', () => {
		const c = makeApiCourse({ max_students: 10, enrolled_count: 12 });
		expect(toCatalogCourse(c).spots).toBe(0);
	});

	it('reflects is_highlighted as the hot flag in both directions', () => {
		expect(toCatalogCourse(makeApiCourse({ is_highlighted: true })).hot).toBe(true);
		expect(toCatalogCourse(makeApiCourse({ is_highlighted: false })).hot).toBe(false);
	});

	it('falls back to "" for null description/category/schedule_text', () => {
		const c = makeApiCourse({ description: null, category: null, schedule_text: null });
		const out = toCatalogCourse(c);
		expect(out.desc).toBe('');
		expect(out.cat).toBe('');
		expect(out.days).toBe('');
	});

	it('formats an age range from min/max, degrading gracefully when one or both sides are missing', () => {
		expect(toCatalogCourse(makeApiCourse({ min_age: 7, max_age: 9 })).age).toBe('7–9 歲');
		expect(toCatalogCourse(makeApiCourse({ min_age: 16, max_age: null })).age).toBe('16 歲以上');
		expect(toCatalogCourse(makeApiCourse({ min_age: null, max_age: 12 })).age).toBe('12 歲以下');
		expect(toCatalogCourse(makeApiCourse({ min_age: null, max_age: null })).age).toBe('');
	});
});

function makeApiCoach(overrides: Partial<ApiCoach> = {}): ApiCoach {
	return {
		id: 'coach-uuid-1',
		user_id: 'user-uuid-1',
		name: '王雅婷',
		title: '資深體操教練',
		bio: '簡介',
		experience: '15年教學經驗',
		specialties: ['競技體操', '跑酷指導'],
		certifications: ['體操A級教練證'],
		is_active: true,
		display_order: 1,
		slug: 'wang',
		photo_url: 'https://example.com/wang.jpg',
		created_at: '2026-01-01T00:00:00Z',
		...overrides
	};
}

describe('toMarketingCoach', () => {
	it('maps name/title as distinct fields (CoachResponse 兩者不同語意，見 contract §3.4), plus slug/photo_url/discipline/tags from specialties', () => {
		expect(toMarketingCoach(makeApiCoach())).toEqual({
			id: 'coach-uuid-1',
			slug: 'wang',
			name: '王雅婷',
			title: '資深體操教練',
			discipline: '競技體操',
			years: '',
			tags: ['競技體操', '跑酷指導'],
			specialties: ['競技體操', '跑酷指導'],
			experience: '15年教學經驗',
			certifications: ['體操A級教練證'],
			photo: 'https://example.com/wang.jpg'
		});
	});

	it('degrades gracefully when slug/photo_url/experience/specialties are null or empty', () => {
		const out = toMarketingCoach(
			makeApiCoach({ slug: null, photo_url: null, experience: null, specialties: [] })
		);
		expect(out.slug).toBe('');
		expect(out.photo).toBeUndefined();
		expect(out.experience).toBe('');
		expect(out.discipline).toBe('');
		expect(out.tags).toEqual([]);
	});
});

function makeApiProduct(overrides: Partial<ApiProduct> = {}): ApiProduct {
	return {
		id: 'product-uuid-1',
		name: '月票 · 自由練習',
		slug: 'monthly-pass',
		product_type: 'membership',
		description: '當月不限堂數自由練習',
		price_cents: 280000,
		original_price_cents: null,
		features: ['不限堂數', '全館設施'],
		is_highlighted: false,
		badge: null,
		stock: null,
		quota: null,
		sold: 0,
		valid_days: 30,
		session_count: null,
		is_active: true,
		created_at: '2026-01-01T00:00:00Z',
		updated_at: '2026-01-01T00:00:00Z',
		...overrides
	};
}

describe('toPass', () => {
	it('maps id/name passthrough, price via ntd, desc/features', () => {
		expect(toPass(makeApiProduct())).toEqual({
			id: 'product-uuid-1',
			name: '月票 · 自由練習',
			price: 2800,
			desc: '當月不限堂數自由練習',
			features: ['不限堂數', '全館設施'],
			highlighted: false
		});
	});

	it('falls back to "" for a null description', () => {
		expect(toPass(makeApiProduct({ description: null })).desc).toBe('');
	});

	it('maps merchandising fields: badge passthrough, is_highlighted → highlighted, original_price_cents via ntd', () => {
		const out = toPass(
			makeApiProduct({ badge: '最熱門', is_highlighted: true, original_price_cents: 400000 })
		);
		expect(out.badge).toBe('最熱門');
		expect(out.highlighted).toBe(true);
		expect(out.originalPrice).toBe(4000);
	});

	it('omits badge/originalPrice (undefined, not null) when the wire carries null', () => {
		const out = toPass(makeApiProduct()); // badge: null, original_price_cents: null
		expect(out.badge).toBeUndefined();
		expect(out.originalPrice).toBeUndefined();
	});
});

describe('orderItemsSummary — 訂單品項摘要（member/admin 共用，見 contract §3.10 items）', () => {
	it('0 項時回傳呼叫端傳入的 fallback（防禦性分支 —— 結帳前購物車不可為空）', () => {
		expect(orderItemsSummary([], '訂單 DF-1')).toBe('訂單 DF-1');
	});

	it('1 項時回傳該項名稱', () => {
		expect(orderItemsSummary([{ name: '競技啦啦隊 進階班', quantity: 1 }], '訂單 DF-1')).toBe(
			'競技啦啦隊 進階班'
		);
	});

	it('2 項時回傳「第一項名稱 外 1 項」', () => {
		expect(
			orderItemsSummary(
				[
					{ name: '競技啦啦隊 進階班', quantity: 1 },
					{ name: '護具組', quantity: 2 }
				],
				'訂單 DF-1'
			)
		).toBe('競技啦啦隊 進階班 外 1 項');
	});

	it('N>2 項時回傳「第一項名稱 外 N-1 項」', () => {
		expect(
			orderItemsSummary(
				[
					{ name: '競技啦啦隊 進階班', quantity: 1 },
					{ name: '護具組', quantity: 2 },
					{ name: '月票 · 自由練習', quantity: 1 }
				],
				'訂單 DF-1'
			)
		).toBe('競技啦啦隊 進階班 外 2 項');
	});

	it('第一項名稱以外的其餘品項名稱不影響摘要（只取第一項 + 計數）', () => {
		expect(
			orderItemsSummary(
				[
					{ name: 'A', quantity: 1 },
					{ name: 'B', quantity: 1 }
				],
				'x'
			)
		).toBe('A 外 1 項');
	});
});
