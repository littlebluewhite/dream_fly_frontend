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
 *  模組內僅 F2′ 和解重抓（見 queueReconcile）呼叫它。 */
const gate = createHydrationGate<WaitlistEntry[]>({
  fetch: async () => {
    const epoch = sessionEpoch;
    const list = await api<ApiWaitlistEntry[]>('/waitlist/me');
    // P1′：回應落地前核對 epoch——跨登出/換帳號的在飛回應整包作廢（throw 讓 gate
    // 既不 apply 也不 commit，見 hydration-gate 檔頭「fetch rejection 原樣拋出」）。
    if (epoch !== sessionEpoch) throw new Error('stale session: waitlist 回應跨登出/換帳號，作廢');
    return list.filter((w) => w.status === 'waiting').map(toWaitlistEntry);
  },
  apply: (list) => waitlist.set(list)
});
export const waitlistHydrated = gate.hydrated;
export const hydrateWaitlist = gate.hydrate;

/* F1′（架構深化 R5 終審 F1 + 帳本閉合輪升級）：SPA 登出（authStore.logout() + goto，
 * 無整頁重載）不會重建模組單例——gate 旗標若跨帳號存活，下一個帳號的
 * hydrateWaitlist() 被 guarded() 短路，直接看到前帳號的候補清單。F1 原修的
 * 「登入 → 登出」布林邊沿只重置「已落地」的狀態，關不住兩個窗口：(1) 邊沿看不見
 * 「A→B 直接換帳號」；(2) 登出前已出發的 GET/POST 在重置之後才 resolve，寫回會讓
 * A 的資料復活並 commit true。升級為 identity 鍵（member.id）+ session epoch：
 * identity 一變就 epoch+1 並清 store/旗標；所有跨 await 的寫回（fetcher 的套用、
 * mutator 的直寫）都核對出發時的 epoch，過期即作廢。notifications 等其他
 * per-session 快取為前存同病，不在本修範圍（見 ADR 0016）。 */
let sessionEpoch = 0;
let lastIdentity: string | null = null;
authStore.subscribe(({ loggedIn, member }) => {
  const identity = loggedIn ? (member?.id ?? '') : null;
  if (identity !== lastIdentity) {
    sessionEpoch += 1;
    waitlist.set([]);
    gate.hydrated.set(false);
  }
  lastIdentity = identity;
});

/* F2′（帳本閉合輪）：和解重抓改「序列化 + 失敗可重試」。
 * - 序列化：多支未水合 mutation 各自排隊、先進先出——後出發的和解快照必然較新且
 *   最後套用，消滅「舊快照晚到、倒序覆寫新 mutation」的窗口（refresh 本身仍是
 *   無條件套用；序列化把殘留窗口收斂到「和解快照 vs 後續其他 mutation」一族，
 *   見 ADR 0016 known-latent）。
 * - 可重試：和解失敗把旗標翻回 false（僅限同 epoch——跨登出的失敗交給 session
 *   重置），下一次 hydrate 重新真抓；不再吞錯佯裝完整（store 只有直寫那筆卻永久
 *   短路 hydrate ＝ F2 原 bug 在一次暫時性 GET 失敗後復活）。 */
let reconcileChain: Promise<void> = Promise.resolve();
function queueReconcile(): void {
  const epoch = sessionEpoch;
  reconcileChain = reconcileChain.then(() =>
    gate.refresh().catch(() => {
      if (epoch === sessionEpoch) gate.hydrated.set(false);
    })
  );
}

/** POST /waitlist（帶 course_id）。成功即代表已加入候補：把後端回傳的新 entry
 *  直接塞進 store 最前面（同 GET /waitlist/me 的新到舊排序），不用整包重新
 *  hydrate。重複候補（後端 409 "already on waitlist"）由呼叫端用
 *  joinWaitlistErrorMessage(err) 轉繁中文案；這裡原樣拋出錯誤，不吞。 */
export async function joinWaitlist(courseId: string): Promise<WaitlistEntry> {
  // F2′：進場（POST 之前）捕捉水合狀態——旗標 commit（markMutated）後 guarded() 從此
  // 短路；若寫入當下尚未水合，store 只有直寫那幾筆、server 上既有列將永不補回，所以
  // !wasHydrated 時排一次和解重抓（POST 已先完成，快照必含新列）。捕捉點必須在 await
  // 之前：await 之後才捕捉，會讓「第一支 mutation 已 markMutated」誤導併發的第二支
  // 以為已水合、不排自己的和解（帳本閉合輪 P2）。
  const wasHydrated = get(gate.hydrated);
  const epoch = sessionEpoch; // P1′：寫回前核對——跨登出/換帳號即棄寫
  const res = await api<ApiWaitlistEntry>('/waitlist', {
    method: 'POST',
    body: JSON.stringify({ course_id: courseId })
  });
  const entry = toWaitlistEntry(res);
  if (epoch !== sessionEpoch) return entry; // server 端已成立；本地棄寫（呼叫端元件已隨登出卸載）
  waitlist.update((list) => [entry, ...list]);
  gate.markMutated(); // commit：讓 in-flight 的 hydrateWaitlist()（若有）mutationWins、不拿舊清單蓋掉這筆 prepend
  if (!wasHydrated) queueReconcile();
  return entry;
}

/** DELETE /waitlist/{id} → 204 No Content（同 syncCartToServer 的 DELETE /cart
 *  慣例，api() 對 204 回傳 undefined，見 client.ts）。成功後從 store 移除該筆。 */
export async function cancelWaitlist(id: string): Promise<void> {
  const wasHydrated = get(gate.hydrated); // F2′ 同 joinWaitlist：進場捕捉，水合前 mutation 要和解重抓
  const epoch = sessionEpoch;
  await api(`/waitlist/${id}`, { method: 'DELETE' });
  if (epoch !== sessionEpoch) return; // P1′ 同 joinWaitlist：跨登出/換帳號棄寫
  waitlist.update((list) => list.filter((w) => w.id !== id));
  gate.markMutated();
  if (!wasHydrated) queueReconcile();
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
