/* Dream Fly — member 結算純函式（checkout 結算核心）
 *
 * 把 CheckoutDialog.confirmPay 的計算邏輯抽成可單測的純函式。
 * 純 = 只回傳資料；不寫任何 store、不呼叫 new Date()、無副作用。
 * 時鐘由 ctx.today（補零 'YYYY/MM/DD' 字串）注入，確保單一來源。
 *
 * Task 16 起：真結帳改走 stores.ts 的 placeOrder（真 API，見該檔案），
 * commitCheckout/CheckoutResult 不再是 confirmPay 的呼叫路徑，只留給既有測試
 * 釘住本地結算數學（未來若不再需要可整段移除）；chargeableLines 仍是真結帳
 * 預覽用的「跳過已持有 pass」過濾邏輯，繼續在用。validateCoupon 是本檔新增的
 * 真 API 版優惠碼查詢，取代 checkout-math 的本地 lookupCoupon 查表。 */

import { checkoutMath } from '$lib/checkout-math';
import type { CartItem, LedgerEntry, Subscription } from '$lib/member/data';
import { api, ApiError } from '$lib/api/client';
import { ntd } from '$lib/public/adapters';

/* ─── 公開型別 ────────────────────────────────────────────────── */

export type { CartItem };

/**
 * @deprecated Task 16 起真結帳改走 stores.ts 的 placeOrder（真 API）；本型別僅供
 * 既有 commitCheckout 測試使用，是否移除由 Task 20 全分支審查裁定。
 */
export interface CheckoutContext {
  points: number;
  usePoints: boolean;
  coupon: { off: number } | null;
  /** 已持有使用權清單 → 去重 + 丟 no-op 收費（傳 $subscriptions 即可，結構相容）*/
  ownedSubs: { id: string }[];
  /** 補零 'YYYY/MM/DD'（呼叫端算好傳入）；寫進 since 與 ledger date */
  today: string;
}

/**
 * @deprecated Task 16 起真結帳改走 stores.ts 的 placeOrder（真 API）；本型別僅供
 * 既有 commitCheckout 測試使用，是否移除由 Task 20 全分支審查裁定。
 */
export interface CheckoutResult {
  /** 金額拆解（顯示用） */
  subtotal: number;
  couponOff: number;
  ptRedeem: number;
  total: number;
  earned: number;
  /** 元件推文案 */
  hasCourse: boolean;
  hasPass: boolean;
  /** 點數淨變動 = earned − ptRedeem */
  pointDelta: number;
  /** 去 id（原由 applyOrder 補上；該路徑已由 Task 16 的 placeOrder 取代）；
   *  不變量：至多一筆 earn + 一筆 redeem */
  ledgerEntries: Omit<LedgerEntry, 'id'>[];
  /** 已去重（id 唯一）、since 已蓋 ctx.today */
  newSubscriptions: Subscription[];
}

/* ─── chargeableLines ─────────────────────────────────────────── */

/**
 * 過濾出「可計費項目」：已持有的 pass 是 no-op，不計費、不贈點。
 * 顯示與 commitCheckout 共用同一過濾邏輯，確保一致。
 */
export function chargeableLines(cart: CartItem[], subs: { id: string }[]): CartItem[] {
  const subscribedIds = new Set(subs.map((s) => s.id));
  return cart.filter((c) => !(c.type === 'pass' && subscribedIds.has(c.id)));
}

/* ─── commitCheckout ──────────────────────────────────────────── */

/**
 * 結算 — 鏡像 CheckoutDialog.confirmPay 的所有計算（Task 16 前的本地結帳路徑）。
 * 不寫 store，不呼叫 new Date()；原本的副作用留給 Task 3 的 applyOrder，該路徑
 * 已由 Task 16 的 placeOrder（真 API）取代，此函式現無 production 呼叫端。
 *
 * @deprecated Task 16 起真結帳改走 stores.ts 的 placeOrder（真 API）；僅供既有
 * 測試釘住本地結算數學，是否移除由 Task 20 全分支審查裁定。
 *
 * 蓄意變更（vs 原 CheckoutDialog）：
 *  ① ledger date     = ctx.today（原寫死 '2026/06/15'）
 *  ② subscription since = ctx.today（原 new Date().toLocaleDateString('zh-TW')）
 */
export function commitCheckout(cart: CartItem[], ctx: CheckoutContext): CheckoutResult {
  /* 1. 可計費項目（去掉已持有的 pass） */
  const ordered = chargeableLines(cart, ctx.ownedSubs);

  /* 2. 金額五元組 — 直接重用 Task 1 的純函式，不重抄公式 */
  const { subtotal, couponOff, ptRedeem, total, earned } = checkoutMath(
    ordered,
    ctx.coupon,
    ctx.points,
    ctx.usePoints
  );

  /* 3. 課程 / 方案 facts */
  const hasCourse = ordered.some((i) => i.type === 'course');
  const hasPass = ordered.some((i) => i.type === 'pass');

  /* 4. 點數淨變動 */
  const pointDelta = earned - ptRedeem;

  /* 5. 新訂閱（去重）— 以 ctx.ownedSubs id 為種子，逐筆累積 seen set */
  const seen = new Set(ctx.ownedSubs.map((s) => s.id));
  const newSubscriptions: Subscription[] = [];
  for (const c of ordered) {
    if (c.type === 'pass' && !seen.has(c.id)) {
      seen.add(c.id);
      newSubscriptions.push({ id: c.id, name: c.name, since: ctx.today, price: c.price });
    }
  }

  /* 6. 帳本分錄（零值守衛：earned=0 不放 earn 筆，ptRedeem=0 不放 redeem 筆）
   *    順序固定 [earn, redeem]；date 統一使用 ctx.today（蓄意變更①）。 */
  const ledgerEntries: Omit<LedgerEntry, 'id'>[] = [];
  const earnDesc = hasCourse ? '報名回饋點數' : '訂閱回饋點數';
  if (earned > 0) {
    ledgerEntries.push({ date: ctx.today, desc: earnDesc, type: 'earn', delta: earned });
  }
  if (ptRedeem > 0) {
    const redeemDesc = hasCourse ? '結帳折抵 · 課程報名' : '結帳折抵 · 方案訂閱';
    ledgerEntries.push({ date: ctx.today, desc: redeemDesc, type: 'redeem', delta: -ptRedeem });
  }

  return { subtotal, couponOff, ptRedeem, total, earned, hasCourse, hasPass, pointDelta, ledgerEntries, newSubscriptions };
}

/* ─── validateCoupon — 真實 API 驗證（取代 checkout-math 的 lookupCoupon 查表）── */

export interface CouponValidateResponse {
  code: string;
  discount_cents: number;
}

/**
 * 呼叫 GET /coupons/{code}/validate（需登入）。後端本身就會 trim + 轉大寫比對
 * （見 coupons::repository::normalize_code），這裡只 trim，不用再自己轉大寫。
 * 404（不存在／未啟用／已過期，後端三者不區分）→ null；其餘錯誤（網路、5xx 等）原樣拋出，
 * 交由呼叫端決定怎麼呈現。discount_cents → NT$ 一律經 ntd()（全前端唯一轉換點）。
 */
export async function validateCoupon(code: string): Promise<{ code: string; off: number } | null> {
  try {
    const res = await api<CouponValidateResponse>(`/coupons/${encodeURIComponent(code.trim())}/validate`);
    return { code: res.code, off: ntd(res.discount_cents) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/* ─── orderErrorMessage — 結帳錯誤 → 繁中 toast 文案 ─────────────── */

/** 已知的後端結帳錯誤（integration-contract.md §3.10；子字串逐字對照
 *  orders/enrolments/points service 原始碼的英文錯誤訊息）→ 繁中文案。
 *  insufficient stock 的完整訊息帶商品名（"insufficient stock for product X"），
 *  所以用 includes 子字串比對，不做全等。 */
const ORDER_ERROR_MESSAGES: [string, string][] = [
  ['cart is empty', '購物車是空的，請先加入商品'],
  ['invalid coupon', '優惠碼無效，請確認後再試'],
  ['course is full', '課程已額滿，請改選候補或其他班別'],
  ['already enrolled', '你已經報名過這堂課程了'],
  ['insufficient points', '點數不足，請取消使用點數折抵'],
  ['insufficient stock', '商品庫存不足，請減少數量或移除該項目'],
  ['duplicate checkout', '訂單處理中，請稍候再試']
];

/** 純函式：把 placeOrder 拋出的錯誤翻成使用者可讀的繁中訊息；
 *  未命中的錯誤（網路失敗、未知 5xx 等）落回通用文案。 */
export function orderErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const hit = ORDER_ERROR_MESSAGES.find(([needle]) => err.message.includes(needle));
    if (hit) return hit[1];
  }
  return '結帳失敗，請稍後再試';
}
