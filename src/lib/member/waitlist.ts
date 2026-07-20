import { writable, get } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { createHydrationGate } from '$lib/hydration-gate';
import { authStore } from '$lib/stores/authStore';

/* ---- Waitlist (候補) — Task 3（feat/backend-integration round 2）----
 * 取代原本掛在 cart 底下、隨 dreamfly_cart_v3 一起存進 localStorage 的
 * `waitlist: string[]`——truth 改成 server（GET /waitlist/me），跟 subscriptions
 * /points 同一種「per-session 快取」模式：hydrateWaitlist() 整包 hydrate；
 * joinWaitlist()/cancelWaitlist() 呼叫 API 成功後直接更新 store（不重新整包
 * fetch，省一次 GET）。cart.addItem 仍會把額滿課程擋在付費購物車外（回傳
 * 'waitlisted'），但不再自己寫入任何本地清單——呼叫端（courses 頁的
 * addToCart）收到 'waitlisted' 後才真的呼叫 joinWaitlist()。 */
export interface WaitlistEntry {
  id: string; // waitlist entry id — cancelWaitlist(id) 需要
  course_id: string;
  course_name: string;
}

interface ApiWaitlistEntry {
  id: string;
  course_id: string;
  course_name: string;
  status: 'waiting' | 'cancelled';
  created_at: string;
}

export const waitlist = writable<WaitlistEntry[]>([]);

function toWaitlistEntry(w: ApiWaitlistEntry): WaitlistEntry {
  return { id: w.id, course_id: w.course_id, course_name: w.course_name };
}

/** GET /waitlist/me — 純陣列、新到舊，含已取消的歷史紀錄。只留 status='waiting'
 *  （同 refreshSubscriptions 對 expired/cancelled 的處理慣例——已取消的候補不
 *  算「候補中」，不該顯示在會員中心的候補清單）。C1 改用共用的
 *  createHydrationGate 收斂水合協定（guard 短路 + post-await re-check + mutator
 *  翻旗，見 $lib/hydration-gate 的協定說明）：per-session 只抓一次；fetch 飛行中
 *  發生 mutation（join/cancel 直寫 store + markMutated）則 mutation 勝出、整包
 *  放棄過期回應——修掉「水合前的本地寫入被姍姍來遲的首次水合覆蓋」的 race。
 *  gate.refresh 不匯出——候補域沒有「無視守衛強制重抓」的外部消費者（YAGNI，同
 *  notifications 先例；courses 頁有本地 store 狀態 + 後端 409 擋重複候補雙保險），
 *  模組內僅 F2 和解重抓（見 joinWaitlist）呼叫它。 */
const gate = createHydrationGate<WaitlistEntry[]>({
  fetch: async () => {
    const list = await api<ApiWaitlistEntry[]>('/waitlist/me');
    return list.filter((w) => w.status === 'waiting').map(toWaitlistEntry);
  },
  apply: (list) => waitlist.set(list)
});
export const waitlistHydrated = gate.hydrated;
export const hydrateWaitlist = gate.hydrate;

/* F1（架構深化 R5 終審）：SPA 登出（authStore.logout() + goto，無整頁重載）不會
 * 重建模組單例——gate 旗標留在 true，下一個帳號登入後 hydrateWaitlist() 被
 * guarded() 短路，直接看到前帳號的候補清單（跨登入洩漏；C1 引入 guard 前每次
 * 無條件重抓、無此問題）。訂閱 authStore，在「登入 → 登出」邊沿清 store + 旗標
 * 翻回 false，讓下一個帳號的 hydrate 重新真抓。只認邊沿：subscribe 的立即回呼
 * 與重複登出不動作。notifications 等其他 per-session 快取為前存同病，不在本修
 * 範圍（見 ADR 0016）。 */
let wasLoggedIn = false;
authStore.subscribe(({ loggedIn }) => {
  if (wasLoggedIn && !loggedIn) {
    waitlist.set([]);
    gate.hydrated.set(false);
  }
  wasLoggedIn = loggedIn;
});

/** POST /waitlist（帶 course_id）。成功即代表已加入候補：把後端回傳的新 entry
 *  直接塞進 store 最前面（同 GET /waitlist/me 的新到舊排序），不用整包重新
 *  hydrate。重複候補（後端 409 "already on waitlist"）由呼叫端用
 *  joinWaitlistErrorMessage(err) 轉繁中文案；這裡原樣拋出錯誤，不吞。 */
export async function joinWaitlist(courseId: string): Promise<WaitlistEntry> {
  const res = await api<ApiWaitlistEntry>('/waitlist', {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId })
  });
  const entry = toWaitlistEntry(res);
  // F2（架構深化 R5 終審）：寫入前捕捉水合狀態。旗標 commit（下行 markMutated）後
  // guarded() 從此短路——若寫入當下尚未水合（完全沒 hydrate 過、或首次 hydrate 仍
  // 在飛，其回應會被 mutationWins 丟棄），store 只有這筆直寫、server 上既有列將永
  // 不補回。所以 !wasHydrated 時尾隨一次 gate.refresh() 和解重抓：無視守衛真抓完
  // 整清單（POST 已先完成，server 回應必含新列）。fire-and-forget、失敗吞掉（同
  // authStore.logout 的 revoke 慣例）；和解窗口內 refresh 與併發 mutation 的覆寫
  // race 屬 ADR 0016 已載 known-latent。
  const wasHydrated = get(gate.hydrated);
  waitlist.update((list) => [entry, ...list]);
  gate.markMutated(); // commit：讓 in-flight 的 hydrateWaitlist()（若有）mutationWins、不拿舊清單蓋掉這筆 prepend
  if (!wasHydrated) void gate.refresh().catch(() => {});
  return entry;
}

/** DELETE /waitlist/{id} → 204 No Content（同 syncCartToServer 的 DELETE /cart
 *  慣例，api() 對 204 回傳 undefined，見 client.ts）。成功後從 store 移除該筆。 */
export async function cancelWaitlist(id: string): Promise<void> {
  await api(`/waitlist/${id}`, { method: 'DELETE' });
  const wasHydrated = get(gate.hydrated); // F2 同 joinWaitlist：水合前 mutation 要和解重抓
  waitlist.update((list) => list.filter((w) => w.id !== id));
  gate.markMutated();
  if (!wasHydrated) void gate.refresh().catch(() => {});
}

/** POST /waitlist 409 的繁中文案。後端訊息逐字對照 waitlist service 原始碼
 *  （dream_fly_backend/src/modules/waitlist/service.rs 的
 *  `AppError::Conflict("already on waitlist")`）——同 checkout.ts
 *  ORDER_ERROR_MESSAGES 的子字串比對慣例，只有「重複候補」有專屬文案；
 *  其餘錯誤（課程未滿班的 409、網路失敗等）落回通用 fallback。 */
export function joinWaitlistErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.message.includes('already on waitlist')) {
    return '你已經在候補名單中了';
  }
  return '加入候補失敗，請稍後再試';
}
