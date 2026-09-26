/* Dream Fly — 管理後台 · 訂單狀態變更 module（R13 Task 5，C4）。
 *
 * 從 orders-filter.ts 搬入 LEGAL_NEXT/legalNextStatuses/applyStatusChange（契約
 * §3.10 狀態機 + PATCH 成功後套回working copy，行為逐字不變）；同批新增
 * isRevenueStatus（同後端 orders/model.rs 的 OrderStatus::is_revenue）與
 * changeOrderStatus，把「呼叫 PATCH /orders/{id}/status + 依 ApiError 狀態碼判
 * 別」收成一支，桌面 admin orders 頁與 mobile-admin markOrderPaid 共用同一份判
 * 別，不再各自維護、各自猜 400/409 語意。
 *
 * 已對過 dream_fly_backend 的 update_order_status（orders/service.rs）：
 * - 非法轉換／並發衝突一律 400 —— `refund::decide_transition` 的
 *   `!current.can_transition_to(target)` 分支回 `AppError::BadRequest`。
 * - 409 只在 FlipAndCompensate（退款/取消的補償路徑）撞
 *   `users_points_balance_check` 時發生 —— 該分支回
 *   `AppError::Conflict("點數不足")`，整個 tx（含狀態翻轉）回滾。
 * 因此 docs/adr/0011 記載的「桌面判 400、mobile-admin OrderSheet 判 409」不是
 * 兩端後端路徑刻意分歧，是 mobile-admin 側判錯狀態碼（OrderSheet 舊碼把「並發
 * 衝突」文案掛在 409 上，正確應是 400）——本檔起兩端統一依真後端語意判別。
 *
 * 文案留呼叫端（ADR-0011「per-entity 知識留頁」精神）：本模組只回傳判別聯集，
 * 桌面 orders 頁與 mobile-admin OrderSheet 各自把 outcome 翻成繁中 toast。 */
import type { Order } from '$lib/admin/data';
import type { OrderStatus } from '$lib/api/wire';
import { ApiError } from '$lib/api/client';

/** 契約 §3.10 訂單狀態機：目前狀態 → 合法的下一狀態清單（不含同狀態幂等）。
 * cancelled/refunded 無合法的下一狀態（終態），回傳空陣列。 */
const LEGAL_NEXT: Record<OrderStatus, OrderStatus[]> = {
	pending: ['paid', 'cancelled'],
	paid: ['processing', 'refunded', 'cancelled'],
	processing: ['completed', 'refunded'],
	completed: ['refunded'],
	cancelled: [],
	refunded: []
};

export function legalNextStatuses(current: OrderStatus): OrderStatus[] {
	return LEGAL_NEXT[current];
}

/**
 * Fold a successful PATCH /orders/{id}/status response into the working copy.
 * Matches by `orderId` (the real backend UUID — `id` above is actually the
 * display order_number, see admin/api.ts's mapAdminOrder). paidAt mirrors the
 * same rule mapAdminOrder already applies on read (pending → placeholder, any
 * other status → the order's date), so the row stays consistent with what a
 * fresh getOrders() would show. Returns a NEW array; the input is never mutated.
 */
export function applyStatusChange(rows: Order[], orderId: string, status: OrderStatus): Order[] {
	return rows.map((o) =>
		o.orderId === orderId ? { ...o, status, paidAt: status === 'pending' ? '—（待付款）' : o.date } : o
	);
}

/** 同後端 OrderStatus::is_revenue（orders/model.rs）：paid/processing/completed
 *  計入營收，pending/cancelled/refunded 不計。 */
export function isRevenueStatus(status: OrderStatus): boolean {
	return status === 'paid' || status === 'processing' || status === 'completed';
}

/** Sum of `amount` over 已載入的這一頁 rows whose status counts as revenue
 *  (isRevenueStatus) — 分頁下只反映目前頁,呼叫端文案需標「本頁」而非「本月」。 */
export function revenueTotal(rows: Order[]): number {
	return rows.filter((o) => isRevenueStatus(o.status)).reduce((s, o) => s + o.amount, 0);
}

/** changeOrderStatus 的呼叫端注入依賴——最小結構型別，只描述本模組實際用到的
 *  形狀（同 coach-save.ts 的 deps 慣例），不 import admin/api.ts 的真簽名。 */
export interface ChangeOrderStatusDeps {
	updateOrderStatus: (id: string, status: OrderStatus) => Promise<{ status: string }>;
}

/** PATCH /orders/{id}/status 的判別聯集結果：
 * - `changed` — 成功，`status` 是 server 回的新狀態（以此為準，不硬寫 next）。
 * - `illegalTransition` — 400，非法轉換或並發衝突（decide_transition 拒絕）。
 * - `pointsShortfall` — 409，退款/取消的點數回收餘額不足（Conflict("點數不足")）。
 * - `failed` — 其他 ApiError（如 403）或非 ApiError（連線問題等），原始 error
 *   原樣回傳，文案由呼叫端決定（同 coach-save.ts 的 outcome 慣例）。 */
export type ChangeOrderStatusOutcome =
	| { kind: 'changed'; status: OrderStatus }
	| { kind: 'illegalTransition' }
	| { kind: 'pointsShortfall' }
	| { kind: 'failed'; error: unknown };

/** id 是真實後端訂單 UUID（Order.orderId / OrderRow.orderId），不是顯示用的
 *  order_number（Order.id / OrderRow.id）。 */
export async function changeOrderStatus(
	id: string,
	next: OrderStatus,
	deps: ChangeOrderStatusDeps
): Promise<ChangeOrderStatusOutcome> {
	try {
		const res = await deps.updateOrderStatus(id, next);
		return { kind: 'changed', status: res.status as OrderStatus };
	} catch (error) {
		if (error instanceof ApiError) {
			if (error.status === 400) return { kind: 'illegalTransition' };
			if (error.status === 409) return { kind: 'pointsShortfall' };
		}
		return { kind: 'failed', error };
	}
}
