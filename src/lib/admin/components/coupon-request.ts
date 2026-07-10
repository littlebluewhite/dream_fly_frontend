/* Dream Fly — 管理後台 · Coupon → POST/PATCH /coupons body 組裝（Round 2 C4，原文
 * 搬自 coupons/+page.svelte 的 buildCreateCouponBody/buildUpdateCouponBody，逐字
 * 搬移、零行為變更）。純函式，供 coupons/+page.svelte 建立/編輯優惠碼時使用。 */
import type { Coupon, CreateCouponBody, UpdateCouponBody } from '$lib/admin/api';
import { toCents } from '$lib/public/adapters';

/** Coupon（表單形狀）→ POST /coupons：code 不可省略；expires_at 留白（'—'）就整個
 *  欄位省略（JSON.stringify 略過 undefined），對應「永不過期」。 */
export function buildCreateCouponBody(c: Coupon): CreateCouponBody {
	const body: CreateCouponBody = { code: c.code.trim(), discount_cents: toCents(c.discount) };
	if (c.expiresAt !== '—') body.expires_at = `${c.expiresAt}T23:59:59Z`;
	return body;
}

/** Coupon（表單形狀）→ PATCH /coupons/{id}：全量送出 discount_cents/is_active/
 *  expires_at 三欄（同全量 resend 慣例，見 admin/api.ts updateCoupon 註解）；
 *  expiresAt 為 '—'（清空）明確送 null，讓後端把到期日清成永久有效。 */
export function buildUpdateCouponBody(c: Coupon): UpdateCouponBody {
	return {
		discount_cents: toCents(c.discount),
		is_active: c.active,
		expires_at: c.expiresAt === '—' ? null : `${c.expiresAt}T23:59:59Z`
	};
}
