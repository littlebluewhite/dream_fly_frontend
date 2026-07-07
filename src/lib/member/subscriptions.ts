import { writable } from 'svelte/store';
import { api } from '$lib/api/client';
import { ntd } from '$lib/public/adapters';
import { SUBS_SEED, type Subscription } from './data';

/* ---- Subscriptions / entitlements ----
 * Task 17: localStorage persistence removed — truth is the server now
 * (GET /subscriptions/me via refreshSubscriptions, called from getAccount()
 * and after placeOrder()). A client-cached snapshot could out-live the real
 * entitlement (e.g. an admin-side change) with no event to invalidate it, so
 * the store simply starts empty/seeded and is hydrated on demand instead. */
export const subscriptions = writable<Subscription[]>(SUBS_SEED.map((s) => ({ ...s })));

export interface ApiSubscription {
  id: string;
  product_id: string;
  product_name: string;
  status: 'active' | 'expired' | 'cancelled';
  started_at: string;
  expires_at: string | null;
  total_sessions: number | null;
  remaining_sessions: number | null;
  price_cents: number;
}

/** 訂閱清單 — 從 GET /subscriptions/me 重新 hydrate 本地 subscriptions store。
 *  只留 status active 的項目：expired/cancelled 不算「已持有」，不該擋掉會員
 *  重新購買同一張 pass。id 換成 product_id——chargeableLines 是拿 cart item 的
 *  product/course id 去比對「是否已持有」，不是拿 subscription 自己的 id。
 *
 *  since 的日期格式(Task 16→17 parked issue的解法)：保留 ISO 切法(YYYY-MM-DD)，
 *  不改成 legacy mock 的 YYYY/MM/DD —— 帳戶頁(account/+page.svelte)同時顯示這個
 *  欄位跟 Task 17 新接的訂單 date 欄位(也是 ISO 切法)，兩者維持同一種格式互相一致
 *  比較重要，帳戶頁本身沒有依賴任何特定分隔符的字串比對邏輯，兩種格式對它來說都
 *  一樣能正常顯示。（points 頁的 pointsLedger 則是反過來選 YYYY/MM/DD——因為那裡
 *  有一段既有邏輯依賴這個格式，見 refreshPoints 的註解。） */
export async function refreshSubscriptions(): Promise<void> {
  const list = await api<ApiSubscription[]>('/subscriptions/me');
  subscriptions.set(
    list
      .filter((s) => s.status === 'active')
      .map((s) => ({ id: s.product_id, name: s.product_name, since: s.started_at.slice(0, 10), price: ntd(s.price_cents) }))
  );
}
