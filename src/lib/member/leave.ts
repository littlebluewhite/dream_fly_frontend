import { writable } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { createSessionGate } from '$lib/session-gate';

/* ---- Leave requests（請假/補課） — Task 11（feat/backend-integration round 3）----
 * 全新 UI 流（repo 原無請假 UI，比照 Round 1 打卡 UI 先例：新寫網路層，不是替換
 * 既有 mock getter）。integration-contract.md §3.20：leave_requests 的
 * status 為 pending/approved/rejected/cancelled 四選一；核准後才可另外預約一次
 * 同課程未來場次補課（POST .../makeup），與請假申請本身是兩個分開的動作——
 * 舊 mock 版 LeaveDialog 的「同時保留補課額度」開關已不適用,一併移除。 */

export interface LeaveRequest {
  id: string;
  course_id: string;
  course_name: string;
  session_id: string;
  session_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS"
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  makeup_session_id: string | null;
  makeup_session_date: string | null;
  makeup_start_time: string | null;
  created_at: string;
}

interface ApiLeaveRequest {
  id: string;
  course_id: string;
  course_name: string;
  session_id: string;
  session_date: string;
  start_time: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  makeup_session_id: string | null;
  makeup_session_date: string | null;
  makeup_start_time: string | null;
  decided_at: string | null;
  created_at: string;
}

/** LeaveRequestResponse → LeaveRequest。decided_at 未進 UI 形狀——目前沒有畫面
 *  需要顯示決定時間，維持誠實窄化(同 api.ts 窄化 local interface 的慣例)。 */
function toLeaveRequest(r: ApiLeaveRequest): LeaveRequest {
  return {
    id: r.id,
    course_id: r.course_id,
    course_name: r.course_name,
    session_id: r.session_id,
    session_date: r.session_date,
    start_time: r.start_time,
    reason: r.reason,
    status: r.status,
    makeup_session_id: r.makeup_session_id,
    makeup_session_date: r.makeup_session_date,
    makeup_start_time: r.makeup_start_time,
    created_at: r.created_at
  };
}

export const leaveRequests = writable<LeaveRequest[]>([]);

/** GET /leave-requests/me — 純陣列、不分頁、新到舊，原樣沿用後端排序。C1（架構深化
 *  R7）改用共用的 createSessionGate 收斂整套 session 水合協定:guard 短路 + post-await
 *  re-check + mutator 翻旗 + identity 重置 + epoch 核對 fetch + 序列化可重試和解鏈——
 *  原本焊在本檔的 sessionEpoch/reconcileChain/authStore.subscribe 骨架(與 waitlist.ts
 *  位元組級雙生)全數吸收進工廠(見 $lib/session-gate 的協定說明)。fetch 是純域 fetch:
 *  P1′ 的 epoch 核對由工廠外包。 */
const gate = createSessionGate<LeaveRequest[]>({
  fetch: async () => {
    const list = await api<ApiLeaveRequest[]>('/leave-requests/me');
    return list.map(toLeaveRequest);
  },
  apply: (list) => leaveRequests.set(list),
  reset: () => leaveRequests.set([]) // boot 態 = 空
});
export const leaveRequestsHydrated = gate.hydrated;
export const hydrateLeaveRequests = gate.hydrate;
/** 保名 = gate.refresh：無視守衛、一律真抓——MyCourseDetail 開課程詳情要「刷新
 *  最新請假狀態」的既有語意（mobile stores 的 re-export 與 identity pin 均繫於
 *  此名）。走工廠的 wrappedFetch,故一併獲得 P1′ 在飛作廢(跨登出/換帳號的在飛
 *  refresh 回應整包作廢);但無 mutation-wins re-check(同 load-gate applyRefreshed
 *  的「無條件」刻意設計)——refresh 飛行窗口內的併發取消仍可能被蓋回,known-latent,
 *  不在本輪擴語意。 */
export const refreshLeaveRequests = gate.refresh;

/** POST /leave-requests（帶 session_id + 選填 reason）。reason 空字串/未提供時省略
 *  該欄位（同 CouponCreateDialog 對選填 expires_at 的省略慣例），對應後端 Option
 *  語意。成功把新假單塞進 store 最前面（同 GET /leave-requests/me 的新到舊排序），
 *  不用整包重新 hydrate。404（未報名此課程/場次不存在）/422（場次已開始）/409
 *  （已有請假紀錄）原樣拋出，不吞——呼叫端用 leaveRequestErrorMessage() 轉繁中文案
 *  （這個模組後端本身就已回繁中，見該函式註解）。API→domain 映射(toLeaveRequest)在
 *  request closure 內完成,故 gate.mutate 的 R = LeaveRequest、匯出回傳型別成立;進場
 *  快照/epoch 作廢/寫回重查完整度/和解重抓全由工廠處理(見 $lib/session-gate)。 */
export async function createLeaveRequest(sessionId: string, reason?: string): Promise<LeaveRequest> {
  return gate.mutate(
    async () => {
      const body: { session_id: string; reason?: string } = { session_id: sessionId };
      if (reason) body.reason = reason;
      const res = await api<ApiLeaveRequest>('/leave-requests', { method: 'POST', body: JSON.stringify(body) });
      return toLeaveRequest(res);
    },
    (entry) => leaveRequests.update((list) => [entry, ...list])
  );
}

/** DELETE /leave-requests/{id} → 204 No Content。僅 pending 假單可取消(409 否則)；
 *  取消不是刪除——後端把狀態改成 cancelled，「我的請假」清單仍要看得到歷史紀錄
 *  （同 Order 清單保留 cancelled 訂單的慣例），所以這裡是原地更新 status，不是
 *  從 store 過濾移除(對比 cancelWaitlist：候補只認 waiting，取消後從清單消失)。
 *  patch-in-place 用參數 id（不是回應），故 writeBack 忽略 result。 */
export async function cancelLeaveRequest(id: string): Promise<void> {
  await gate.mutate(
    () => api(`/leave-requests/${id}`, { method: 'DELETE' }),
    () => leaveRequests.update((list) => list.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r)))
  );
}

/** POST /leave-requests/{id}/makeup（帶欲預約的補課場次 session_id）。成功回應含
 *  補上的 makeup_session_id/date/time，直接取代 store 裡對應的那筆（伺服器為準，
 *  不用整包重新 hydrate）。409（非 approved／已預約過／名額已滿）/422（跨課程／
 *  已開始）原樣拋出。replace 用參數 id 定位 + 回應 entry 取代。 */
export async function bookMakeup(id: string, sessionId: string): Promise<LeaveRequest> {
  return gate.mutate(
    async () => {
      const res = await api<ApiLeaveRequest>(`/leave-requests/${id}/makeup`, {
        method: 'POST',
        body: JSON.stringify({ session_id: sessionId })
      });
      return toLeaveRequest(res);
    },
    (entry) => leaveRequests.update((list) => list.map((r) => (r.id === id ? entry : r)))
  );
}

/** leave 模組的後端錯誤字串本身就是繁中，逐字對照 integration-contract.md §3.20
 *  引用的 dream_fly_backend/src/modules/leave/service.rs AppError 訊息（例如
 *  「場次已開始，無法請假」「此場次已有請假紀錄」「該場次名額已滿」）——跟
 *  orderErrorMessage/joinWaitlistErrorMessage 需要子字串對照英文訊息不同,這裡
 *  直接透傳即可,也天然涵蓋同一 status 底下的多種原因(例如 makeup 的 409 有三種
 *  可能：非 approved／已預約過／名額已滿)。建立/取消/預約補課共用同一份文案邏輯。 */
export function leaveRequestErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return '連線發生問題，請稍後再試。';
}

/* ---- Course sessions（GET /courses/{id}/sessions，供請假/補課選場次；
 * integration-contract.md §3.18）---- */

export interface CourseSession {
  id: string;
  session_date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS"
  end_time: string;
}

interface ApiCourseSession {
  id: string;
  course_id: string;
  session_date: string;
  start_time: string;
  end_time: string;
}

/** 需登入,不帶 from/to——沿用後端預設範圍(今天起 28 天),足夠列出「未來場次」供
 *  請假/補課挑選,brief 未要求可調整範圍。 */
export async function getCourseSessions(courseId: string): Promise<CourseSession[]> {
  const list = await api<ApiCourseSession[]>(`/courses/${courseId}/sessions`);
  return list.map((s) => ({ id: s.id, session_date: s.session_date, start_time: s.start_time, end_time: s.end_time }));
}
