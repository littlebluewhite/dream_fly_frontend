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

/** P1″ A→B 直接換帳號釘用:identity(user.id)相異的第二個帳號。 */
const AUTH_RES_B = {
  access_token: 'at-f1b',
  refresh_token: 'rt-f1b',
  user: { ...AUTH_RES.user, id: 'u-f2', email: 'b@dreamfly.test', name: '乙' }
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

  it('race 釘（F2 後語意）:hydrate in-flight 期間 cancelLeaveRequest() → 舊回應被丟棄（mutationWins）＋和解重抓收斂完整清單——取消不被蓋回、server 既有列不再永久失蹤', async () => {
    /* F2 語意差:C1 原釘只驗「丟棄舊回應」——cancel 的 markMutated(commit) 讓
     * guarded() 從此短路,server 上本地未見的其他假單（lr-2）永不補回（F2 的 bug
     * 本體）。現在 cancel 發現寫入當下未水合（旗標 false）→ 尾隨 gate.refresh()
     * 和解重抓:GET 改兩段式模擬真 server——首呼（hydrate）回舊 pending 清單、
     * 次呼（和解重抓;DELETE 已先完成）回完整清單（lr-1 已 cancelled + lr-2）。
     * 原釘的「取消不被蓋回」精神保留,由「丟棄舊回應」＋「和解重抓」共同保證。 */
    leaveRequests.set([API_LR_PENDING as never]); // 本地已有 lr-1(pending)
    const deferred = createDeferred<unknown[]>();
    let leaveGets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'GET /leave-requests/me': () => {
        leaveGets += 1;
        return leaveGets === 1 ? deferred.promise : [{ ...API_LR_PENDING, status: 'cancelled' }, API_LR_APPROVED];
      },
      'DELETE /leave-requests/lr-1': undefined
    }));

    const p = hydrateLeaveRequests(); // 通過 guarded()(旗標 false),GET /leave-requests/me 首呼掛起中
    await cancelLeaveRequest('lr-1'); // 飛行中 mutation:lr-1 → cancelled + markMutated(commit) + 和解重抓

    deferred.resolve([API_LR_PENDING]); // 姍姍來遲的舊清單:lr-1 仍是 pending
    await p; // mutationWins:過期回應整包丟棄
    await settleReconcile();

    expect(leaveGets).toBe(2); // 和解重抓真的發生
    expect(get(leaveRequests).map((r) => [r.id, r.status])).toEqual([
      ['lr-1', 'cancelled'], // 原釘精神:取消不被舊清單蓋回
      ['lr-2', 'approved'] // 和解重抓補回本地沒有的既有列
    ]);
    expect(get(leaveRequestsHydrated)).toBe(true);
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

  it('P1″ 換帳號釘:A 已水合後 B 直接登入(無登出)→ identity 變更即清 store/旗標,B hydrate 真抓 B 的清單', async () => {
    /* 「登入→登出」布林邊沿看不見 A→B 直接換帳號(loggedIn 恆 true)——identity 鍵
     * (member.id)才看得見。 */
    let logins = 0;
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B),
      'GET /leave-requests/me': () => (++gets === 1 ? [API_LR_PENDING] : [API_LR_APPROVED])
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    await refreshLeaveRequests();
    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-1']);

    await authStore.login('b@dreamfly.test', 'pw'); // B 直接登入,無登出邊沿

    expect(get(leaveRequests)).toEqual([]); // A 的假單即刻清空
    expect(get(leaveRequestsHydrated)).toBe(false);

    await hydrateLeaveRequests(); // B 真抓
    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-2']); // 不是 A 的殘留
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

  it('P1′ 在飛作廢釘:POST in-flight 期間登出 → 回應到達後棄寫(不 prepend、不翻旗),A 的假單不落在 B 的 store', async () => {
    const deferred = createDeferred<unknown>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'POST /leave-requests': () => deferred.promise
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    const p = createLeaveRequest('sess-1', '生病'); // A 的 POST 掛起中
    await authStore.logout();

    deferred.resolve(API_LR_PENDING);
    const result = await p; // server 端已成立,回傳值照舊(呼叫端元件已隨登出卸載,無害)

    expect(result.id).toBe('lr-1');
    expect(get(leaveRequests)).toEqual([]); // 棄寫:A 的假單不落地
    expect(get(leaveRequestsHydrated)).toBe(false); // 不翻旗:B 的 hydrate 照常真抓
  });

  it('P2′ 可重試釘:和解重抓失敗 → 旗標翻回 false 留下重試路徑,下一次 hydrate 重新真抓完整清單', async () => {
    /* 舊法失敗吞掉、旗標停在 true:store 只有直寫那筆卻被永久當成完整快照,之後所有
     * hydrate 都被短路——F2 原 bug 在一次暫時性 GET 失敗後原地復活(waitlist 尤甚:
     * 無外部 refresh 兜底)。 */
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /leave-requests': API_LR_PENDING,
      'GET /leave-requests/me': () => (++gets === 1 ? new Error('和解重抓網路失敗') : [API_LR_PENDING, API_LR_APPROVED])
    }));

    await createLeaveRequest('sess-1', '生病');
    await settleReconcile();

    expect(get(leaveRequestsHydrated)).toBe(false); // 失敗不佯裝完整——可重試

    await hydrateLeaveRequests(); // 重試(例:下次進 mine 頁)
    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-1', 'lr-2']);
    expect(get(leaveRequestsHydrated)).toBe(true);
  });

  it('P2′ 併發釘:兩支未水合 mutation 併發 → 各自排隊和解、序列化執行(前和解未 settle 後和解不起跑),晚快照最後套用', async () => {
    /* leave 的和解鏈是獨立實作(與 waitlist 手工鏡射)——單側漏修不會被 waitlist 的釘
     * 抓到,故鏡射一支非 vacuous 序列化釘(帳本閉合輪 codex Standards P2)。 */
    const post1 = createDeferred<unknown>();
    const post2 = createDeferred<unknown>();
    const r1 = createDeferred<unknown[]>();
    const API_LR_3 = { ...API_LR_APPROVED, id: 'lr-3', session_id: 'sess-3' };
    let posts = 0;
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /leave-requests': () => (++posts === 1 ? post1.promise : post2.promise),
      'GET /leave-requests/me': () => (++gets === 1 ? r1.promise : [API_LR_3, API_LR_PENDING, API_LR_APPROVED])
    }));

    const p1 = createLeaveRequest('sess-1', '生病');
    const p2 = createLeaveRequest('sess-3'); // 兩支都在旗標 false 時進場
    post1.resolve(API_LR_PENDING);
    post2.resolve(API_LR_3);
    await Promise.all([p1, p2]);
    await settleReconcile();

    expect(gets).toBe(1); // 序列化:首和解仍在飛,次和解不得起跑
    r1.resolve([API_LR_PENDING]); // 舊快照(漏第二筆)先套用
    await settleReconcile();

    expect(gets).toBe(2); // 首和解 settle 後,次和解才起跑
    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-3', 'lr-1', 'lr-2']); // 完整快照最後套用,第二筆存活
    expect(get(leaveRequestsHydrated)).toBe(true);
  });

  it('P2″ 再排和解釘:和解失敗翻回 false 後,進場時自以為已水合的 mutation 於寫回時發現旗標已 false → 重新排和解,不把不完整 store 再標成完整', async () => {
    /* leave 的 stillIncomplete 重查是與 waitlist 分開的手工鏡射——單側漏修不會被
     * waitlist 的釘抓到,故鏡射(帳本閉合輪終段 codex Standards P2)。 */
    const API_LR_3 = { ...API_LR_APPROVED, id: 'lr-3', session_id: 'sess-3' };
    let rejectR1!: (e: Error) => void;
    const r1 = new Promise<unknown[]>((_, rej) => { rejectR1 = rej; });
    const post2 = createDeferred<unknown>();
    let posts = 0;
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /leave-requests': () => (++posts === 1 ? API_LR_PENDING : post2.promise),
      'GET /leave-requests/me': () => (++gets === 1 ? r1 : [API_LR_3, API_LR_PENDING, API_LR_APPROVED])
    }));

    await createLeaveRequest('sess-1', '生病'); // M1:未水合 → markMutated + 排 R1
    await settleReconcile(); // R1 的 GET 出發(掛起中)
    const p2 = createLeaveRequest('sess-3'); // M2 進場:旗標 true(R1 尚未失敗)
    rejectR1(new Error('和解重抓網路失敗')); // R1 失敗 → 旗標翻回 false
    await settleReconcile();
    expect(get(leaveRequestsHydrated)).toBe(false);

    post2.resolve(API_LR_3); // M2 寫回:發現旗標已 false → 必須再排 R2
    await p2;
    await settleReconcile();

    expect(gets).toBe(2); // R2 真的排了
    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-3', 'lr-1', 'lr-2']);
    expect(get(leaveRequestsHydrated)).toBe(true); // 完整之後才重新標完整
  });

  it('P2″ 幽靈和解釘:登出時「已排隊、尚未起跑」的和解 callback 不得在下一個 session 起跑', async () => {
    const post1 = createDeferred<unknown>();
    const post2 = createDeferred<unknown>();
    const r1 = createDeferred<unknown[]>();
    const API_LR_3 = { ...API_LR_APPROVED, id: 'lr-3', session_id: 'sess-3' };
    let posts = 0;
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'POST /leave-requests': () => (++posts === 1 ? post1.promise : post2.promise),
      'GET /leave-requests/me': () => { ++gets; return gets === 1 ? r1.promise : [API_LR_PENDING]; }
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    const p1 = createLeaveRequest('sess-1', '生病');
    const p2 = createLeaveRequest('sess-3'); // R1 起跑(掛起)、R2 排隊
    post1.resolve(API_LR_PENDING);
    post2.resolve(API_LR_3);
    await Promise.all([p1, p2]);
    await settleReconcile();
    expect(gets).toBe(1); // R1 在飛,R2 尚未起跑

    await authStore.logout(); // session 結束
    r1.resolve([API_LR_PENDING]); // R1 的舊 session 回應此刻才到
    await settleReconcile();

    expect(gets).toBe(1); // R2 沒有以新 session 起跑——幽靈和解不存在
    expect(get(leaveRequests)).toEqual([]);
    expect(get(leaveRequestsHydrated)).toBe(false);
  });

  it('P2″ 卡鏈釘:上一個 session 卡死的和解不得堵住下一個帳號的和解鏈', async () => {
    const API_LR_B = { ...API_LR_APPROVED, id: 'lr-b', session_id: 'sess-b' };
    let logins = 0;
    let posts = 0;
    let gets = 0;
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': () => (++logins === 1 ? AUTH_RES : AUTH_RES_B),
      'POST /auth/logout': undefined,
      'POST /leave-requests': () => (++posts === 1 ? API_LR_PENDING : API_LR_B),
      'GET /leave-requests/me': () => (++gets === 1 ? new Promise(() => {}) : [API_LR_B, API_LR_APPROVED]) // R1 永不 settle
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    await createLeaveRequest('sess-1', '生病'); // A:R1 起跑 → 永掛
    await settleReconcile();
    expect(gets).toBe(1);

    await authStore.logout();
    await authStore.login('b@dreamfly.test', 'pw'); // 換帳號 → 鏈重置
    await createLeaveRequest('sess-b'); // B 的未水合 mutation → 排 B 的和解
    await settleReconcile();

    expect(gets).toBe(2); // B 的和解沒有堵在 A 的殭屍後面
    expect(get(leaveRequests).map((r) => r.id)).toEqual(['lr-b', 'lr-2']); // B 收斂到完整清單
    expect(get(leaveRequestsHydrated)).toBe(true);
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

  it('P1″ 在飛作廢釘:makeup POST in-flight 期間登出 → 回應到達後棄寫(不動 store、不翻旗)', async () => {
    /* join/create/cancel 已各有一釘;bookMakeup 的「map 取代 + 回傳」形另釘一支,防兩檔
     * 五支 mutator 手工鏡射時單側漏修(帳本閉合輪 codex Standards P2)。 */
    const updated = { ...API_LR_APPROVED, makeup_session_id: 'sess-9', makeup_session_date: '2026-07-20', makeup_start_time: '18:00:00' };
    const deferred = createDeferred<unknown>();
    vi.mocked(api).mockImplementation(fakeRouter({
      'POST /auth/login': AUTH_RES,
      'POST /auth/logout': undefined,
      'POST /leave-requests/lr-2/makeup': () => deferred.promise
    }));

    await authStore.login('a@dreamfly.test', 'pw');
    leaveRequests.set([API_LR_APPROVED as never]);
    const p = bookMakeup('lr-2', 'sess-9'); // A 的 POST 掛起中
    await authStore.logout(); // 邊沿重置已清 store

    deferred.resolve(updated);
    const result = await p; // server 端已成立,回傳值照舊

    expect(result.makeup_session_id).toBe('sess-9');
    expect(get(leaveRequests)).toEqual([]); // 棄寫:不對(已清空的)store 做 map 寫回
    expect(get(leaveRequestsHydrated)).toBe(false); // 不翻旗
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
