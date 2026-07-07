import { writable } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';

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

/** GET /leave-requests/me — 純陣列、不分頁、新到舊，原樣沿用後端排序。 */
export async function refreshLeaveRequests(): Promise<void> {
  const list = await api<ApiLeaveRequest[]>('/leave-requests/me');
  leaveRequests.set(list.map(toLeaveRequest));
}

/** POST /leave-requests（帶 session_id + 選填 reason）。reason 空字串/未提供時省略
 *  該欄位（同 CouponCreateDialog 對選填 expires_at 的省略慣例），對應後端 Option
 *  語意。成功把新假單塞進 store 最前面（同 GET /leave-requests/me 的新到舊排序），
 *  不用整包重新 hydrate。404（未報名此課程/場次不存在）/422（場次已開始）/409
 *  （已有請假紀錄）原樣拋出，不吞——呼叫端用 leaveRequestErrorMessage() 轉繁中文案
 *  （這個模組後端本身就已回繁中，見該函式註解）。 */
export async function createLeaveRequest(sessionId: string, reason?: string): Promise<LeaveRequest> {
  const body: { session_id: string; reason?: string } = { session_id: sessionId };
  if (reason) body.reason = reason;
  const res = await api<ApiLeaveRequest>('/leave-requests', { method: 'POST', body: JSON.stringify(body) });
  const entry = toLeaveRequest(res);
  leaveRequests.update((list) => [entry, ...list]);
  return entry;
}

/** DELETE /leave-requests/{id} → 204 No Content。僅 pending 假單可取消(409 否則)；
 *  取消不是刪除——後端把狀態改成 cancelled，「我的請假」清單仍要看得到歷史紀錄
 *  （同 Order 清單保留 cancelled 訂單的慣例），所以這裡是原地更新 status，不是
 *  從 store 過濾移除(對比 cancelWaitlist：候補只認 waiting，取消後從清單消失)。 */
export async function cancelLeaveRequest(id: string): Promise<void> {
  await api(`/leave-requests/${id}`, { method: 'DELETE' });
  leaveRequests.update((list) => list.map((r) => (r.id === id ? { ...r, status: 'cancelled' as const } : r)));
}

/** POST /leave-requests/{id}/makeup（帶欲預約的補課場次 session_id）。成功回應含
 *  補上的 makeup_session_id/date/time，直接取代 store 裡對應的那筆（伺服器為準，
 *  不用整包重新 hydrate）。409（非 approved／已預約過／名額已滿）/422（跨課程／
 *  已開始）原樣拋出。 */
export async function bookMakeup(id: string, sessionId: string): Promise<LeaveRequest> {
  const res = await api<ApiLeaveRequest>(`/leave-requests/${id}/makeup`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId })
  });
  const entry = toLeaveRequest(res);
  leaveRequests.update((list) => list.map((r) => (r.id === id ? entry : r)));
  return entry;
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
