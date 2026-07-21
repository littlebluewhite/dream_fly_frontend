import { writable } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { createSessionGate } from '$lib/session-gate';

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
 *  算「候補中」，不該顯示在會員中心的候補清單）。C1（架構深化 R7）改用共用的
 *  createSessionGate 收斂整套 session 水合協定:guard 短路 + post-await re-check +
 *  mutator 翻旗 + identity 重置(SPA 登出/換帳號清 store 旗標)+ epoch 核對 fetch +
 *  序列化可重試和解鏈——原本焊在本檔的 sessionEpoch/reconcileChain/authStore.subscribe
 *  骨架(與 leave.ts 位元組級雙生)全數吸收進工廠(見 $lib/session-gate 的協定說明)。
 *  fetch 是純域 fetch:P1′ 的 epoch 核對由工廠外包。gate.refresh 不匯出——候補域沒有
 *  「無視守衛強制重抓」的外部消費者(YAGNI,同 notifications 先例;courses 頁有本地
 *  store 狀態 + 後端 409 擋重複候補雙保險),模組內僅 mutate 尾隨的和解重抓呼叫它。 */
const gate = createSessionGate<WaitlistEntry[]>({
  fetch: async () => {
    const list = await api<ApiWaitlistEntry[]>('/waitlist/me');
    return list.filter((w) => w.status === 'waiting').map(toWaitlistEntry);
  },
  apply: (list) => waitlist.set(list),
  reset: () => waitlist.set([]) // boot 態 = 空(開機空,值冪等)
});
export const waitlistHydrated = gate.hydrated;
export const hydrateWaitlist = gate.hydrate;

/** POST /waitlist（帶 course_id）。成功即代表已加入候補：把後端回傳的新 entry
 *  直接塞進 store 最前面（同 GET /waitlist/me 的新到舊排序），不用整包重新
 *  hydrate。重複候補（後端 409 "already on waitlist"）由呼叫端用
 *  joinWaitlistErrorMessage(err) 轉繁中文案；這裡原樣拋出錯誤，不吞。
 *  API→domain 映射(toWaitlistEntry)在 request closure 內完成,故 gate.mutate 的
 *  R = WaitlistEntry、匯出回傳型別成立;進場快照/epoch 作廢/寫回重查完整度/和解
 *  重抓全由工廠處理(見 $lib/session-gate 的 mutate)。 */
export async function joinWaitlist(courseId: string): Promise<WaitlistEntry> {
  return gate.mutate(
    async () => {
      const res = await api<ApiWaitlistEntry>('/waitlist', {
        method: 'POST',
        body: JSON.stringify({ course_id: courseId })
      });
      return toWaitlistEntry(res);
    },
    (entry) => waitlist.update((list) => [entry, ...list])
  );
}

/** DELETE /waitlist/{id} → 204 No Content（同 syncCartToServer 的 DELETE /cart
 *  慣例，api() 對 204 回傳 undefined，見 client.ts）。成功後從 store 移除該筆。
 *  filter 用參數 id（不是回應），故 writeBack 忽略 result。 */
export async function cancelWaitlist(id: string): Promise<void> {
  await gate.mutate(
    () => api(`/waitlist/${id}`, { method: 'DELETE' }),
    () => waitlist.update((list) => list.filter((w) => w.id !== id))
  );
}

/** POST /waitlist 409 的繁中文案。後端訊息逐字對照 waitlist service 原始碼
 *  （dream_fly_backend/src/modules/waitlist/service.rs 的
 *  `AppError::Conflict("already on waitlist")`）——同 checkout.ts
 *  ORDER_ERROR_MESSAGES 的子字串比對慣例，只有「重複候補」有專屬文案；
 *  其餘錯誤（課程未滿班的 409、網路失敗等）落回通用 fallback。
 *  注意:這不是 apiErrorMessage 的複製品(自訂 substring 比對),D-2 順風車不動它。 */
export function joinWaitlistErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.message.includes('already on waitlist')) {
    return '你已經在候補名單中了';
  }
  return '加入候補失敗，請稍後再試';
}
