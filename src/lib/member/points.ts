import { writable } from 'svelte/store';
import { api } from '$lib/api/client';
import { apiErrorMessage } from '$lib/api/error-text';
import { isoDate } from '$lib/api/wire';
import { createSessionRefresher } from '$lib/session-gate';
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

export interface ApiLedgerEntry {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  order_id: string | null;
  created_at: string;
}

export interface ApiPointsMe {
  balance: number;
  ledger: ApiLedgerEntry[];
}

/** reason → 中文 desc + 本地 LedgerType 對照，後端 PointReason 六值全數列出：
 *  checkout_earn/checkout_redeem（結帳賺/折抵）、redeem（兌換獎勵扣點，契約 §3.23，
 *  desc 與 checkout_redeem 分開以免誤認為結帳折抵）、refund_restore/refund_clawback
 *  （退款沖回，type 皆為 refund，desc 分辨退回折抵或收回回饋）、admin_adjust（可正可負，
 *  type adjust）。default 只兜後端日後新增、前端尚未認得的 reason，同樣歸 adjust。 */
function describeLedgerReason(reason: string): { type: LedgerType; desc: string } {
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
    default:
      return { type: 'adjust', desc: '會員點數調整' };
  }
}

/** 點數餘額 + 明細 — 從 GET /points/me 重新 hydrate。balance 給 checkout 用；
 *  ledger（Task 17 接線）用 date 的 YYYY/MM/DD 切法而非 ISO 切法，是因為
 *  points 頁的「本月累積」依 `date.startsWith(當月 YYYY/MM prefix)` 篩選
 *  （見 points/+page.svelte），格式依賴仍在 —— 換成 ISO 會讓那段篩選永遠不
 *  match、悄悄把統計歸零。
 *  C1（架構深化 R7）抬升為 createSessionRefresher:保留「無條件重抓」語意(
 *  account 頁進頁經 warmStores 暖機 + CheckoutDialog/CartSheet 每次開啟 + placeOrder afterOrder
 *  都依賴每次真抓,不套 guard),只加 identity 清空(reset:歸 boot 態)+ 在飛換帳「靜默
 *  丟棄」(不 throw——redeemReward/placeOrder 會傳播 rejection,不得新增換帳失敗模式)。
 *  修殘影窗口(換帳後 A 的餘額殘留),呼叫端語意不變。 */
export const refreshPoints = createSessionRefresher<ApiPointsMe>({
  fetch: () => api<ApiPointsMe>('/points/me'),
  apply: (data) => {
    points.set(data.balance);
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
export interface ApiRedeemResult {
  redemption_id: string;
  points_spent: number;
  balance_after: number;
}

/** POST /rewards/{id}/redeem — 無 body。成功後呼叫 refreshPoints()（見上方裁決）；
 *  回應原樣（snake_case）回傳給呼叫端，同 placeOrder() 對 ApiOrder 的處理慣例——
 *  呼叫端目前只需要知道「成功了」，沒有欄位需要改名成 UI 形狀。 */
export async function redeemReward(rewardId: string): Promise<ApiRedeemResult> {
  const result = await api<ApiRedeemResult>(`/rewards/${rewardId}/redeem`, { method: 'POST' });
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
