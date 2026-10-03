import { writable } from 'svelte/store';
import { api } from '$lib/api/client';
import { apiErrorMessage } from '$lib/api/error-text';
import { isoDate } from '$lib/api/wire';
import { createSessionRefresher } from '$lib/session-gate';
import type { PointReason, PointsMeResponse, RedeemResponse } from '$lib/api/generated';
import type { LedgerEntry, LedgerType } from '$lib/domain/member-app';

/* ---- Points ----
 * 種子 0（fail-safe：折抵預覽寧可少報、絕不拿虛構餘額多報）——真實餘額由
 * refreshPoints 水合：getAccount / getPoints 進頁時，以及
 * CheckoutDialog 每次開啟時都會觸發。 */
export const points = writable<number>(0);
// Ledger lives in a store too, so a redemption (which lowers `points`) stays in
// sync with the visible history across route navigation. 誠實開機(R14 候選 F3):開機值 =
// reset 值 = `[]`,由 refreshPoints 水合成真明細。
export const pointsLedger = writable<LedgerEntry[]>([]);
/** 本月累積：後端 `earned_this_month`（工作室月份、只計 checkout_earn，與明細分頁無關）。
 *  開機值 = reset 值 = 0，隨 refreshPoints 水合、隨身分變更歸零。 */
export const pointsEarnedThisMonth = writable<number>(0);

/** reason → 中文 desc + 本地 LedgerType 對照，後端 PointReason 六值全數列出：
 *  checkout_earn/checkout_redeem（結帳賺/折抵）、redeem（兌換獎勵扣點，契約 §3.23，
 *  desc 與 checkout_redeem 分開以免誤認為結帳折抵）、refund_restore/refund_clawback
 *  （退款沖回，type 皆為 refund，desc 分辨退回折抵或收回回饋）、admin_adjust（可正可負，
 *  type adjust）。PointReason 為後端產生型別，窮舉 switch：後端新增值域時 default 的
 *  `satisfies never` 成為編譯錯誤，逼前端補文案。 */
function describeLedgerReason(reason: PointReason): { type: LedgerType; desc: string } {
  switch (reason) {
    case 'checkout_earn':
      return { type: 'earn', desc: '消費獲得點數' };
    case 'checkout_redeem':
      return { type: 'redeem', desc: '消費折抵點數' };
    case 'redeem':
      return { type: 'redeem', desc: '兌換點數獎勵' };
    case 'refund_restore':
      return { type: 'refund', desc: '訂單退款・退回折抵點數' };
    case 'refund_clawback':
      return { type: 'refund', desc: '訂單退款・收回回饋點數' };
    case 'admin_adjust':
      return { type: 'adjust', desc: '會員點數調整' };
    default:
      // 編譯期窮舉守衛；執行期遇到部署時差送來的新值仍降級為 adjust，不讓整包明細 hydrate 炸掉。
      reason satisfies never;
      return { type: 'adjust', desc: '會員點數調整' };
  }
}

/** 點數餘額 + 明細 + 本月累積 — 從 GET /points/me 重新 hydrate。balance 給 checkout 用；
 *  ledger（Task 17 接線）的 date 為 YYYY/MM/DD 顯示格式；本月累積直接讀後端
 *  earned_this_month（W-5：原本 points 頁從第一頁明細以 UTC 日期切當月加總，跨頁與
 *  台灣月初都會算錯）。
 *  C1（架構深化 R7）抬升為 createSessionRefresher:保留「無條件重抓」語意(
 *  account 頁進頁經 warmStores 暖機 + CheckoutDialog/CartSheet 每次開啟 + placeOrder afterOrder
 *  都依賴每次真抓,不套 guard),只加 identity 清空(reset:歸 boot 態)+ 在飛換帳「靜默
 *  丟棄」(不 throw——redeemReward/placeOrder 會傳播 rejection,不得新增換帳失敗模式)。
 *  修殘影窗口(換帳後 A 的餘額殘留),呼叫端語意不變。 */
export const refreshPoints = createSessionRefresher<PointsMeResponse>({
  fetch: () => api<PointsMeResponse>('/points/me'),
  apply: (data) => {
    points.set(data.balance);
    pointsEarnedThisMonth.set(data.earned_this_month);
    pointsLedger.set(
      data.ledger.map((l) => {
        const { type, desc } = describeLedgerReason(l.reason);
        return { id: l.id, date: isoDate(l.created_at).replace(/-/g, '/'), desc, type, delta: l.delta };
      })
    );
  },
  reset: () => {
    points.set(0);
    pointsLedger.set([]); // boot 態(開機值 = reset 值 = [])
    pointsEarnedThisMonth.set(0);
  }
});

/* ---- Rewards（點數兌換）— Task 14（feat/backend-integration round 3）----
 * integration-contract.md §3.23：兌換品項目錄（GET /rewards）由 member/api.ts 的
 * getPoints() 映射（見該檔的 mapReward）；這裡只放「兌換動作」本身。裁決：成功後
 * 直接呼叫 refreshPoints() 把 points/pointsLedger 從後端整包 hydrate，不做本地
 * 扣減；回應的 balance_after 不拿來樂觀先行更新 store —— refreshPoints() 只是
 * 一次快速的網路來回，等它 resolve 再視為兌換完成，呼叫端（points 頁）用
 * in-flight guard（submitting 旗標）蓋掉這段空檔，比維護「樂觀值之後又被
 * refreshPoints 覆蓋」兩套餘額真相簡單。 */

/** POST /rewards/{id}/redeem — 無 body。成功後呼叫 refreshPoints()（見上方裁決）；
 *  回應原樣（snake_case）回傳給呼叫端，同 placeOrder() 對 OrderResponse 的處理慣例——
 *  呼叫端目前只需要知道「成功了」，沒有欄位需要改名成 UI 形狀。 */
export async function redeemReward(rewardId: string): Promise<RedeemResponse> {
  const result = await api<RedeemResponse>(`/rewards/${rewardId}/redeem`, { method: 'POST' });
  await refreshPoints();
  return result;
}

/** POST /rewards/{id}/redeem 的錯誤文案。後端訊息本身就是繁中契約原文（404
 *  「獎勵不存在」；409「已兌換完畢」庫存售罄 / 「點數不足」餘額不足）——比照
 *  leaveRequestErrorMessage 直通即可，不需要子字串對照表。
 *  D-2（架構深化 R7 順風車）：透傳邏輯與 apiErrorMessage 逐字相同，改委派單源、匯出名保留。 */
export function redeemRewardErrorMessage(err: unknown): string {
  return apiErrorMessage(err);
}
