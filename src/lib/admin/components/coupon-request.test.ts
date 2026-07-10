import { describe, it, expect } from 'vitest';
import { buildCreateCouponBody, buildUpdateCouponBody } from './coupon-request';
import type { Coupon } from '$lib/admin/api';

/* coupon-request.ts — 純函式，組出 POST/PATCH /coupons body（Round 2 C4，自
 * coupons/+page.svelte 搬出）。全部無需渲染，直接測純函式輸出。 */
const BASE_COUPON: Coupon = { id: 'cp1', code: 'SPRING10', discount: 300, active: true, expiresAt: '2026-12-31' };

describe('buildCreateCouponBody — Coupon → POST /coupons body', () => {
	it('trims code and converts discount via toCents', () => {
		const c: Coupon = { ...BASE_COUPON, code: '  SPRING10  ', discount: 300, expiresAt: '—' };
		expect(buildCreateCouponBody(c)).toEqual({ code: 'SPRING10', discount_cents: 30000 });
	});

	it('appends the T23:59:59Z suffix to a set expiry date', () => {
		const c: Coupon = { ...BASE_COUPON, expiresAt: '2026-12-31' };
		expect(buildCreateCouponBody(c).expires_at).toBe('2026-12-31T23:59:59Z');
	});

	it("omits expires_at entirely when expiresAt is the '—' sentinel (永不過期)", () => {
		const c: Coupon = { ...BASE_COUPON, expiresAt: '—' };
		const body = buildCreateCouponBody(c);
		expect(body.expires_at).toBeUndefined();
		expect('expires_at' in body).toBe(false); // 整個欄位省略，不是 undefined 值
	});
});

describe('buildUpdateCouponBody — Coupon → PATCH /coupons/{id} body（全量送出三欄）', () => {
	it('always sends discount_cents/is_active/expires_at together (全量 resend)', () => {
		const c: Coupon = { ...BASE_COUPON, discount: 450, active: true, expiresAt: '2026-12-31' };
		expect(buildUpdateCouponBody(c)).toEqual({
			discount_cents: 45000,
			is_active: true,
			expires_at: '2026-12-31T23:59:59Z'
		});
	});

	it('converts discount via toCents and passes through active as-is', () => {
		const c: Coupon = { ...BASE_COUPON, discount: 50, active: false };
		const body = buildUpdateCouponBody(c);
		expect(body.discount_cents).toBe(5000);
		expect(body.is_active).toBe(false);
	});

	it("sends expires_at:null (not omitted) when expiresAt is the '—' sentinel — asymmetric with create's omission", () => {
		const c: Coupon = { ...BASE_COUPON, expiresAt: '—' };
		const body = buildUpdateCouponBody(c);
		expect(body.expires_at).toBeNull();
		expect('expires_at' in body).toBe(true); // 明確送 null 清成永久有效，不是省略
	});
});
