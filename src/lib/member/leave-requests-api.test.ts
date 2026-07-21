/* Dream Fly — member 請假/補課「真 API」網路層單測（Task 11；integration-contract.md
 * §3.20 Leave Requests + §3.18 GET /courses/{id}/sessions）。
 *
 * 覆蓋 stores.ts 新增的請假網路層：getCourseSessions / hydrateLeaveRequests /
 * refreshLeaveRequests / createLeaveRequest / cancelLeaveRequest / bookMakeup /
 * leaveRequestErrorMessage。
 * 只替換 $lib/api/client 的 api()，ApiError 用回真實類別（同 checkout-api.test.ts
 * 慣例）。呼叫序列（path/method/body）是核心斷言,不是只驗證最終 store 狀態。 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { api, ApiError } from '$lib/api/client';
import { authStore } from '$lib/stores/authStore';
import { fakeRouter } from '$lib/testing/fake-router';
import {
  leaveRequests,
  leaveRequestsHydrated,
  getCourseSessions,
  hydrateLeaveRequests,
  refreshLeaveRequests,
  createLeaveRequest,
  cancelLeaveRequest,
  bookMakeup,
  leaveRequestErrorMessage
} from './stores';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

/** 手動控時序的 deferred promise——測 in-flight race 不用 fake timers
 *  （手法同 checkout-api.test.ts / load-gate.test.ts 的 createDeferred）。 */
function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** F2 和解重抓（mutator 尾隨的 void gate.refresh()）是 fire-and-forget——
 *  macrotask 跳一拍，讓其 fetch → apply 鏈完整收束後再斷言。 */
function settleReconcile() {
  return new Promise<void>((r) => setTimeout(r, 0));
}

/** F1 用最小 AuthResponse——authStore.login() 走真實 applySession
 *  （setTokens + 登入態），登出邊沿才有得測。 */
const AUTH_RES = {
  access_token: 'at-f1',
  refresh_token: 'rt-f1',
  user: {
    id: 'u-f1', email: 'a@dreamfly.test', name: '甲', phone: null, phone_verified: false,
    avatar_url: null, is_active: true, created_at: '2026-01-01T00:00:00Z', roles: ['member']
  }
};

const API_LR_PENDING = {
  id: 'lr-1', course_id: 'course-1', course_name: '競技啦啦隊 進階班',
  session_id: 'sess-1', session_date: '2026-07-10', start_time: '19:00:00',
  reason: '生病', status: 'pending',
  makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
  decided_at: null, created_at: '2026-07-01T00:00:00Z'
};

const API_LR_APPROVED = {
  id: 'lr-2', course_id: 'course-2', course_name: '兒童翻滾 技巧班',
  session_id: 'sess-2', session_date: '2026-07-05', start_time: '18:00:00',
  reason: null, status: 'approved',
  makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
  decided_at: '2026-07-02T00:00:00Z', created_at: '2026-06-28T00:00:00Z'
};

beforeEach(() => {
  vi.mocked(api).mockReset();
  leaveRequests.set([]);
  leaveRequestsHydrated.set(false); // 模組單例旗標,不重置會跨 it 洩漏、讓 hydrateLeaveRequests 短路
});

/* C1：水合改走 createHydrationGate（guard 短路 + post-await re-check + mutator
 * 翻旗，同 checkout-api.test.ts 的 refreshNotifications/hydrateWaitlist 協定）。 */
describe('hydrateLeaveRequests — GET /leave-requests/me（guard 短路 + mutation 勝出）', () => {
  it('hydrates the store from the API response，並把 leaveRequestsHydrated 翻 true', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /leave-requests/me': [API_LR_PENDING, API_LR_APPROVED] }));

    await hydrateLeaveRequests();

    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-1', 'lr-2']);
    expect(get(leaveRequestsHydrated)).toBe(true);
  });

  it('guard 短路:已經 hydrate 過就不重覆抓 —— 避免蓋掉本地 create/cancel 直寫的狀態', async () => {
    leaveRequestsHydrated.set(true);
    leaveRequests.set([API_LR_APPROVED as never]); // 哨兵
    vi.mocked(api).mockImplementation(fakeRouter({})); // 任何呼叫都會丟錯

    await hydrateLeaveRequests();

    expect(api).not.toHaveBeenCalled();
    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-2']); // 未被覆寫
  });

  it('F1 跨登入洩漏釘:hydrate 完成後 authStore 登出 → 旗標翻 false + store 清空,下一個帳號 hydrate 重新真抓', async () => {
    /* SPA 登出（authStore.logout() + goto）沒有整頁重載,模組單例的 gate 旗標若不
     * 重置,B 帳號登入後 hydrateLeaveRequests() 被 guarded() 短路——直接看到 A 的假單。 */
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /leave-requests/me': [API_LR_PENDING]
    }));

    await authStore.login('a@dreamfly.test', 'pw'); // 帳號 A 登入
    await hydrateLeaveRequests();
    expect(get(leaveRequests)).toHaveLength(1);
    expect(get(leaveRequestsHydrated)).toBe(true);

    await authStore.logout(); // 「登入 → 登出」邊沿

    expect(get(leaveRequestsHydrated)).toBe(false); // 旗標重置,guarded() 不再短路
    expect(get(leaveRequests)).toEqual([]); // A 的假單不留給 B

    const gets = () => vi.mocked(api).mock.calls.filter(([p]) => p === '/leave-requests/me').length;
    const before = gets();
    await hydrateLeaveRequests(); // 帳號 B 再水合 → 真的重新 fetch
    expect(gets()).toBe(before + 1);
  });
});

describe('refreshLeaveRequests — GET /leave-requests/me', () => {
  it('hydrates the store from the API response (新到舊，原樣沿用後端排序)', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /leave-requests/me': [API_LR_PENDING, API_LR_APPROVED] }));

    await refreshLeaveRequests();

    const list = get(leaveRequests);
    expect(list).toHaveLength(2);
    expect(list[0]).toEqual({
      id: 'lr-1', course_id: 'course-1', course_name: '競技啦啦隊 進階班',
      session_id: 'sess-1', session_date: '2026-07-10', start_time: '19:00:00',
      reason: '生病', status: 'pending',
      makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
      created_at: '2026-07-01T00:00:00Z'
    });
    expect(list[1].id).toBe('lr-2');
  });

  it('旗標 true 仍真抓:refresh 無視 guard（MyCourseDetail 開詳情「刷新最新」語意，= gate.refresh）', async () => {
    leaveRequestsHydrated.set(true);
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /leave-requests/me': [API_LR_APPROVED] }));

    await refreshLeaveRequests();

    expect(api).toHaveBeenCalledWith('/leave-requests/me');
    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-2']);
  });

  it('P1′ 在飛作廢釘:refresh in-flight 期間登出 → 姍姍來遲的回應整包作廢(不套用、不 commit)', async () => {
    /* refreshLeaveRequests 無視 guard 且無條件套用——登出重置後若讓在飛回應落地,
     * A 的假單會復活並 commit true,B 帳號的 hydrate 被 guarded() 短路(F1 的邊沿
     * 重置只清「已落地」的狀態,關不住在飛窗口)。 */
    const deferred = createDeferred<unknown[]>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'GET /leave-requests/me': () => deferred.promise
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    const p = refreshLeaveRequests(); // A 的 GET 掛起中
    await authStore.logout(); // 在飛期間登出

    deferred.resolve([API_LR_PENDING]);
    await expect(p).rejects.toThrow(); // 過期 fetch 作廢

    expect(get(leaveRequests)).toEqual([]); // A 的假單沒有復活
    expect(get(leaveRequestsHydrated)).toBe(false); // B 的 hydrate 不會被短路
  });

});

describe('createLeaveRequest — POST /leave-requests', () => {
  it('sends { session_id, reason } and prepends the mapped entry to the store', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /leave-requests': API_LR_PENDING }));

    const result = await createLeaveRequest('sess-1', '生病');

    expect(api).toHaveBeenCalledWith('/leave-requests', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1', reason: '生病' })
    });
    expect(result.id).toBe('lr-1');
    expect(get(leaveRequests)).toEqual([result]);
  });

  it('omits reason from the body when not provided (contract: reason? 選填)', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /leave-requests': API_LR_PENDING }));

    await createLeaveRequest('sess-1');

    expect(api).toHaveBeenCalledWith('/leave-requests', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-1' })
    });
  });

  it('prepends onto any existing entries (新到舊)', async () => {
    leaveRequests.set([{ ...API_LR_APPROVED, reason: null } as never]);
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /leave-requests': API_LR_PENDING }));

    await createLeaveRequest('sess-1', '生病');

    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-1', 'lr-2']);
  });

  it('propagates 409 (此場次已有請假紀錄) unhandled — caller decides how to display it', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'POST /leave-requests': new ApiError(409, '此場次已有請假紀錄') })
    );
    await expect(createLeaveRequest('sess-1')).rejects.toThrow('此場次已有請假紀錄');
  });

});

describe('cancelLeaveRequest — DELETE /leave-requests/{id}', () => {
  it('calls DELETE and marks the matching entry cancelled in place (not removed — history stays visible)', async () => {
    leaveRequests.set([API_LR_PENDING as never, API_LR_APPROVED as never]);
    vi.mocked(api).mockImplementation(fakeRouter({ 'DELETE /leave-requests/lr-1': undefined }));

    await cancelLeaveRequest('lr-1');

    expect(api).toHaveBeenCalledWith('/leave-requests/lr-1', { method: 'DELETE' });
    const list = get(leaveRequests);
    expect(list.find((r) => r.id === 'lr-1')?.status).toBe('cancelled');
    expect(list.find((r) => r.id === 'lr-2')?.status).toBe('approved'); // untouched
  });

  it('leaves the store untouched when the DELETE call fails', async () => {
    leaveRequests.set([API_LR_PENDING as never]);
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'DELETE /leave-requests/lr-1': new ApiError(409, '僅待審核假單可取消') })
    );

    await expect(cancelLeaveRequest('lr-1')).rejects.toThrow('僅待審核假單可取消');
    expect(get(leaveRequests)[0].status).toBe('pending');
  });

  it('F2 完整性釘:未 hydrate 直接 cancelLeaveRequest → 和解重抓收斂為完整 server 清單(含本地沒有的既有列),旗標 true,之後 hydrate 被 guarded() 短路', async () => {
    /* 寫入當下旗標 false（從未 hydrate）→ 本地只有直寫的 lr-1,server 上的 lr-2
     * 缺席;而 markMutated 的 commit 會讓 guarded() 從此短路——沒有和解重抓,
     * 既有列永不補回。 */
    leaveRequests.set([API_LR_PENDING as never]); // 本地僅 lr-1（例如上個畫面直寫）
    vi.mocked(api).mockImplementation(fakeRouter({
      'DELETE /leave-requests/lr-1': undefined,
      'GET /leave-requests/me': [{ ...API_LR_PENDING, status: 'cancelled' }, API_LR_APPROVED]
    }));

    await cancelLeaveRequest('lr-1');
    await settleReconcile();

    expect(get(leaveRequests).map((r) => [r.id, r.status])).toEqual([
      ['lr-1', 'cancelled'],
      ['lr-2', 'approved']
    ]);
    expect(get(leaveRequestsHydrated)).toBe(true);

    const calls = vi.mocked(api).mock.calls.length;
    await hydrateLeaveRequests(); // 和解重抓後水合真相已成立——guarded() 短路,不再重覆真抓
    expect(vi.mocked(api).mock.calls.length).toBe(calls);
  });
});

describe('bookMakeup — POST /leave-requests/{id}/makeup', () => {
  it('sends { session_id } and replaces the matching store entry with the updated response', async () => {
    const updated = { ...API_LR_APPROVED, makeup_session_id: 'sess-9', makeup_session_date: '2026-07-20', makeup_start_time: '18:00:00' };
    leaveRequests.set([API_LR_APPROVED as never]);
    vi.mocked(api).mockImplementation(fakeRouter({ 'POST /leave-requests/lr-2/makeup': updated }));

    const result = await bookMakeup('lr-2', 'sess-9');

    expect(api).toHaveBeenCalledWith('/leave-requests/lr-2/makeup', {
      method: 'POST',
      body: JSON.stringify({ session_id: 'sess-9' })
    });
    expect(result.makeup_session_id).toBe('sess-9');
    expect(get(leaveRequests)[0].makeup_session_date).toBe('2026-07-20');
  });

  it('propagates 409 (該場次名額已滿) unhandled', async () => {
    leaveRequests.set([API_LR_APPROVED as never]);
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'POST /leave-requests/lr-2/makeup': new ApiError(409, '該場次名額已滿') })
    );
    await expect(bookMakeup('lr-2', 'sess-9')).rejects.toThrow('該場次名額已滿');
  });
});

describe('getCourseSessions — GET /courses/{id}/sessions', () => {
  it('maps the plain array response to {id, session_date, start_time, end_time}', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /courses/course-1/sessions': [
          { id: 's1', course_id: 'course-1', session_date: '2026-07-10', start_time: '19:00:00', end_time: '20:30:00' }
        ]
      })
    );

    const sessions = await getCourseSessions('course-1');

    expect(sessions).toEqual([{ id: 's1', session_date: '2026-07-10', start_time: '19:00:00', end_time: '20:30:00' }]);
    expect(api).toHaveBeenCalledWith('/courses/course-1/sessions');
  });
});

describe('leaveRequestErrorMessage', () => {
  // leave 模組的後端錯誤字串本身就是繁中（integration-contract.md §3.20 逐字引用
  // dream_fly_backend service.rs 的 AppError 訊息），跟 checkout/waitlist 模組的
  // 英文錯誤字串需要子字串對照表翻譯不同——這裡直接透傳即可,不需要额外的翻譯表。
  it('passes an ApiError message straight through (backend already returns the exact 繁中 contract copy)', () => {
    expect(leaveRequestErrorMessage(new ApiError(422, '場次已開始，無法請假'))).toBe('場次已開始，無法請假');
    expect(leaveRequestErrorMessage(new ApiError(409, '此場次已有請假紀錄'))).toBe('此場次已有請假紀錄');
    expect(leaveRequestErrorMessage(new ApiError(404, '未報名此課程'))).toBe('未報名此課程');
    expect(leaveRequestErrorMessage(new ApiError(409, '該場次名額已滿'))).toBe('該場次名額已滿');
    expect(leaveRequestErrorMessage(new ApiError(422, '補課場次須為同一課程'))).toBe('補課場次須為同一課程');
  });

  it('falls back to a generic message for a non-ApiError (network failure etc.)', () => {
    expect(leaveRequestErrorMessage(new Error('network down'))).toBe('連線發生問題，請稍後再試。');
  });
});
