import { writable } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';

/* ---- Waitlist (候補) — Task 3（feat/backend-integration round 2）----
 * 取代原本掛在 cart 底下、隨 dreamfly_cart_v3 一起存進 localStorage 的
 * `waitlist: string[]`——truth 改成 server（GET /waitlist/me），跟 subscriptions
 * /points 同一種「per-session 快取」模式：refreshWaitlist() 整包 hydrate；
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
 *  算「候補中」，不該顯示在會員中心的候補清單）。 */
export async function refreshWaitlist(): Promise<void> {
  const list = await api<ApiWaitlistEntry[]>('/waitlist/me');
  waitlist.set(list.filter((w) => w.status === 'waiting').map(toWaitlistEntry));
}

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
  waitlist.update((list) => [entry, ...list]);
  return entry;
}

/** DELETE /waitlist/{id} → 204 No Content（同 syncCartToServer 的 DELETE /cart
 *  慣例，api() 對 204 回傳 undefined，見 client.ts）。成功後從 store 移除該筆。 */
export async function cancelWaitlist(id: string): Promise<void> {
  await api(`/waitlist/${id}`, { method: 'DELETE' });
  waitlist.update((list) => list.filter((w) => w.id !== id));
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
