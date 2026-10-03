/* Dream Fly — member/api.ts 單測(Task 17：8 個 getter 換真 API)。
 *
 * 只 mock $lib/api/client 的 api() 與 $lib/public/api 的 listCourses/listCoaches ——
 * 其餘(stores.ts 的 refreshPoints/refreshSubscriptions/hydrateNotifications、
 * data.ts 的 mapNotification)一律用真實實作，這樣才是「後端形狀進、UI 形狀出」
 * 的端對端斷言，而不是把邏輯也一起 mock 掉。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { getDashboard, getReports, getSchedule, getMine, getEnrolmentAttendance, getAccount, getCourses, getPoints } from './api';
import { api } from '$lib/api/client';
import { listCourses, listCoaches } from '$lib/public/api';
import { points, pointsLedger, subscriptions, notifications, waitlist, leaveRequests } from './stores';
import { resetSessionStores } from '$lib/testing/session-reset';
import { UPCOMING, ANNOUNCE } from './data';
import { STATS, SKILLS } from '$lib/domain/member-app';
import { fakeRouter } from '$lib/testing/fake-router';
import { orderSummary, pointsMe } from '$lib/testing/wire-fixtures';
import type { OrderStatus } from '$lib/api/wire';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

vi.mock('$lib/public/api', () => ({
  listCourses: vi.fn(),
  listCoaches: vi.fn()
}));

beforeEach(async () => {
  vi.mocked(api).mockReset();
  vi.mocked(listCourses).mockReset();
  vi.mocked(listCoaches).mockReset();
  points.set(0);
  pointsLedger.set([]);
  subscriptions.set([]);
  notifications.set([]);
  waitlist.set([]);
  leaveRequests.set([]);
  await resetSessionStores(); // 模組單例閘門:登入→登出走一圈,不重置會跨 it 洩漏、讓旁路 hydrate 短路
});

describe('getDashboard', () => {
  const STATS_API = {
    attended_total: 18,
    attendance_rate: 0.9,
    points_balance: 1250,
    active_enrolments: 2,
    upcoming_sessions_7d: 3
  };
  const EMPTY_STATS_API = {
    attended_total: 0,
    attendance_rate: null,
    points_balance: 0,
    active_enrolments: 0,
    upcoming_sessions_7d: 0
  };

  it('nextClass 來自最新一筆有效報名的 schedule_text；不再帶 track(R16 Task 2c)；skills/upcoming/announce 仍是 mock；stats 三卡改接 GET /reports/me(只換 value,icon/tint/color/label 沿用 STATS 版型)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'e1', course_id: 'c1', course_name: '競技啦啦隊 進階班', course_level: 'advanced', schedule_text: '週二 / 週四 19:00–20:30', status: 'active', enrolled_at: '2026-06-01T00:00:00Z' },
          { id: 'e2', course_id: 'c2', course_name: '已取消課程', course_level: 'beginner', schedule_text: '週三 10:00', status: 'cancelled', enrolled_at: '2026-01-01T00:00:00Z' }
        ],
        'GET /reports/me': STATS_API
      })
    );

    const d = await getDashboard();

    expect(d).toEqual({
      stats: [
        { ...STATS[0], value: '2' },
        { ...STATS[1], value: '90%' },
        { ...STATS[2], value: '1,250' }
      ],
      skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
      nextClass: '週二 / 週四 19:00–20:30'
    });
  });

  it('attendanceRate 為 null(無點名資料，裁決 3)時 stats[1].value 顯示「—」，不是 0%', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API
      })
    );

    const d = await getDashboard();
    expect(d.stats[1].value).toBe('—');
  });

  it('沒有任何有效報名時 nextClass 為空字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API
      })
    );

    const d = await getDashboard();
    expect(d.nextClass).toBe('');
  });

  // R14(候選 F3):會員首頁沒有讀點數的地方、通知改由 layout 暖機(見 $lib/store-warm 與
  // routes/member/+layout.svelte),getDashboard 不再順手水合任何共享 store。
  it('不打 GET /points/me、GET /notifications(順手水合退役)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API
      })
    );

    await getDashboard();

    const paths = vi.mocked(api).mock.calls.map(([p]) => p);
    expect(paths).not.toContain('/points/me');
    expect(paths).not.toContain('/notifications');
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API
      })
    );
    expect(getDashboard()).toBeInstanceOf(Promise);
  });
});

describe('getReports — GET /report-cards/me + GET /certificates/me（§3.22）+ GET /reports/me（統計欄位，§3.24）', () => {
  const STATS_API = {
    attended_total: 18,
    attendance_rate: 0.9,
    points_balance: 1250,
    active_enrolments: 2,
    upcoming_sessions_7d: 3
  };
  const STATS_UI = {
    attendedTotal: 18,
    attendanceRate: 0.9,
    pointsBalance: 1250,
    activeEnrolments: 2,
    upcomingSessions7d: 3
  };

  it('report cards 與 certificates 映射為 UI 形狀（created_by_name→issuerName 等欄位改名）；stats 由 GET /reports/me 映射（欄位改 camelCase，值不竄改）', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /report-cards/me': [
          { id: 'rc1', course_id: 'c1', course_name: '競技啦啦隊 進階班', term_label: '2026 夏季', comment: '進步很多', rating: 5, created_by_name: '林雅婷', created_at: '2026-07-01T00:00:00Z' }
        ],
        'GET /certificates/me': [
          { id: 'ct1', course_id: 'c1', course_name: '競技啦啦隊 進階班', title: '結業證書', level: '結業', issued_on: '2026-06-20', note: null, created_at: '2026-06-20T00:00:00Z' }
        ],
        'GET /reports/me': STATS_API
      })
    );

    const d = await getReports();

    expect(d).toEqual({
      reportCards: [
        { id: 'rc1', courseName: '競技啦啦隊 進階班', termLabel: '2026 夏季', comment: '進步很多', rating: 5, issuerName: '林雅婷', createdAt: '2026-07-01T00:00:00Z' }
      ],
      certificates: [
        { id: 'ct1', title: '結業證書', level: '結業', courseName: '競技啦啦隊 進階班', issuedOn: '2026-06-20', note: null, createdAt: '2026-06-20T00:00:00Z' }
      ],
      stats: STATS_UI
    });
  });

  it('rating/comment 為 null、certificate 的 course_id/level 為 null 時原樣映射(不竄改)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /report-cards/me': [
          { id: 'rc2', course_id: 'c2', course_name: '幼兒體操 啟蒙班', term_label: '2026 春季', comment: null, rating: null, created_by_name: '陳冠宇', created_at: '2026-03-01T00:00:00Z' }
        ],
        'GET /certificates/me': [
          { id: 'ct2', course_id: null, course_name: null, title: '市賽 團體第三名', level: null, issued_on: '2026-05-01', note: null, created_at: '2026-05-01T00:00:00Z' }
        ],
        'GET /reports/me': STATS_API
      })
    );

    const d = await getReports();

    expect(d.reportCards[0].rating).toBeNull();
    expect(d.reportCards[0].comment).toBeNull();
    expect(d.certificates[0].courseName).toBeNull();
    expect(d.certificates[0].level).toBeNull();
  });

  it('attendance_rate 為 null(無出勤資料，裁決 3)時原樣穿透為 null，不竄改成 0', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /report-cards/me': [],
        'GET /certificates/me': [],
        'GET /reports/me': { ...STATS_API, attendance_rate: null }
      })
    );
    const d = await getReports();
    expect(d.stats.attendanceRate).toBeNull();
  });

  it('沒有任何成績單/證書/出勤資料時回傳空陣列 + 全零 stats(空庫慣例，不是 500)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /report-cards/me': [],
        'GET /certificates/me': [],
        'GET /reports/me': {
          attended_total: 0,
          attendance_rate: null,
          points_balance: 0,
          active_enrolments: 0,
          upcoming_sessions_7d: 0
        }
      })
    );
    const d = await getReports();
    expect(d).toEqual({
      reportCards: [],
      certificates: [],
      stats: {
        attendedTotal: 0,
        attendanceRate: null,
        pointsBalance: 0,
        activeEnrolments: 0,
        upcomingSessions7d: 0
      }
    });
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /report-cards/me': [], 'GET /certificates/me': [], 'GET /reports/me': STATS_API })
    );
    expect(getReports()).toBeInstanceOf(Promise);
  });
});

describe('getSchedule — GET /schedule/me 週模式映射（§3.18）', () => {
  it('day_of_week(0=Sun..6=Sat)對映既有 UI 週欄位(0=Mon..6=Sun)；HH:MM:SS 裁切為 HH:MM；coach_name/venue 為 null 時給空字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /schedule/me': [
          { course_id: 'c1', course_name: '競技啦啦隊 進階班', coach_name: '林雅婷', day_of_week: 2, start_time: '19:00:00', end_time: '20:30:00', venue: 'A 訓練館' },
          { course_id: 'c2', course_name: '幼兒體操 啟蒙班', coach_name: null, day_of_week: 0, start_time: '10:00:00', end_time: '11:00:00', venue: null }
        ]
      })
    );

    const d = await getSchedule();

    expect(d.schedule).toEqual([
      { day: 1, start: '19:00', end: '20:30', name: '競技啦啦隊 進階班', room: 'A 訓練館', coach: '林雅婷', color: '#0066CC', tone: 'primary' },
      { day: 6, start: '10:00', end: '11:00', name: '幼兒體操 啟蒙班', room: '', coach: '', color: '#0066CC', tone: 'primary' }
    ]);
  });

  it('沒有任何排課時回傳空陣列(頁面顯示空狀態)', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /schedule/me': [] }));
    const d = await getSchedule();
    expect(d).toEqual({ schedule: [] });
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /schedule/me': [] }));
    expect(getSchedule()).toBeInstanceOf(Promise);
  });
});

describe('getMine', () => {
  it('GET /enrolments/me → EnrolledCourse[]；只留 active；level 轉繁中；不再捏造 cat/coach/room/next/term/remain；attended/total 為真值、att 為兩者比率', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'enrol-1', course_id: 'course-1', course_name: '競技啦啦隊 進階班', course_level: 'advanced', schedule_text: '週二 / 週四 19:00–20:30', status: 'active', enrolled_at: '2026-06-01T00:00:00Z', attended: 18, total: 24 },
          { id: 'enrol-2', course_id: 'course-2', course_name: '已取消課程', course_level: 'beginner', schedule_text: '週三 10:00', status: 'cancelled', enrolled_at: '2026-01-01T00:00:00Z', attended: 5, total: 5 }
        ]
      })
    );

    const d = await getMine();

    expect(d).toEqual({
      courses: [
        {
          // FE#17：level 走共用 5 級對照(advanced → 進階)，不再是舊的三態 初/中/高級。
          id: 'enrol-1', course_id: 'course-1', name: '競技啦啦隊 進階班', level: '進階', icon: 'sparkles', color: '#0066CC', schedule: '週二 / 週四 19:00–20:30', att: 75, attended: 18, total: 24
        }
      ]
    });
  });

  it('沒有任何點名紀錄(total 為 0)時 attended/total/att 皆為 0，不除以零', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'e1', course_id: 'c1', course_name: '幼兒體操 啟蒙班', course_level: 'beginner', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 }
        ]
      })
    );

    const d = await getMine();
    expect(d.courses[0].att).toBe(0);
    expect(d.courses[0].attended).toBe(0);
    expect(d.courses[0].total).toBe(0);
  });

  // FE#17：course_level 對照表現收斂為 $lib/domain/course-level 的共用 5 級常數
  // （後端 Task 7 起 course_level 補齊 foundation/elite）——過去這裡只覆蓋舊 3 值，
  // foundation/elite 永遠對不出繁中標籤；未知值仍 fallback 為原字串。
  it('course_level 對照表涵蓋共用 5 級（foundation/beginner/intermediate/advanced/elite），未知值 fallback 為原字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'e0', course_id: 'c0', course_name: 'Z', course_level: 'foundation', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 },
          { id: 'e1', course_id: 'c1', course_name: 'A', course_level: 'beginner', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 },
          { id: 'e2', course_id: 'c2', course_name: 'B', course_level: 'intermediate', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 },
          { id: 'e3', course_id: 'c3', course_name: 'C', course_level: 'advanced', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 },
          { id: 'e5', course_id: 'c5', course_name: 'E', course_level: 'elite', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 },
          { id: 'e4', course_id: 'c4', course_name: 'D', course_level: 'brand_new_level', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 }
        ]
      })
    );

    const d = await getMine();
    expect(d.courses.map((c) => c.level)).toEqual(['啟蒙', '入門', '基礎', '進階', '選手', 'brand_new_level']);
  });

  it('schedule_text 為 null 時 schedule 映射為空字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'enrol-3', course_id: 'course-3', course_name: '幼兒體操 啟蒙班', course_level: 'beginner', schedule_text: null, status: 'active', enrolled_at: '2026-06-01T00:00:00Z', attended: 0, total: 0 }
        ]
      })
    );
    const d = await getMine();
    expect(d.courses[0].schedule).toBe('');
  });

  // R15(候選 F2)：候補/請假的暖機已搬出 getMine()，改由呼叫端(member/mine、mobile
  // mine 頁面)自己宣告——getMine 現在只打自己的路徑，不再順手碰這兩支端點(見
  // member/mine/page.test.ts 的頁面層並行釘、$lib/store-warm.test.ts 的暖機通用行為釘)。
  it('只打 GET /enrolments/me，不打 GET /waitlist/me、GET /leave-requests/me(暖機移到頁面層)', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /enrolments/me': [] }));

    await getMine();

    const paths = vi.mocked(api).mock.calls.map(([p]) => p);
    expect(paths).toEqual(['/enrolments/me']);
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /enrolments/me': [] }));
    expect(getMine()).toBeInstanceOf(Promise);
  });
});

describe('getEnrolmentAttendance — GET /enrolments/{id}/attendance（Task F7；逐堂出勤明細，§3.12）', () => {
  it('session_date(YYYY-MM-DD) → date(MM/DD) + year(YYYY)；status 原樣映射為 state；依端點回應順序輸出(後端已保證舊到新)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/enrol-1/attendance': [
          { session_date: '2026-05-14', start_time: '19:00:00', end_time: '20:30:00', status: 'present', marked_at: '2026-05-14T19:05:00Z' },
          { session_date: '2026-05-21', start_time: '19:00:00', end_time: '20:30:00', status: 'leave', marked_at: '2026-05-21T19:05:00Z' },
          { session_date: '2026-05-28', start_time: '19:00:00', end_time: '20:30:00', status: 'absent', marked_at: '2026-05-28T19:05:00Z' }
        ]
      })
    );

    const d = await getEnrolmentAttendance('enrol-1');

    expect(d).toEqual([
      { date: '05/14', year: '2026', state: 'present' },
      { date: '05/21', year: '2026', state: 'leave' },
      { date: '05/28', year: '2026', state: 'absent' }
    ]);
  });

  it('跨年出勤紀錄各自保留自己的 year，不是統一硬編某一年(pin：2025 年場次要顯示 2025)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/enrol-1/attendance': [
          { session_date: '2025-12-30', start_time: '19:00:00', end_time: '20:30:00', status: 'present', marked_at: '2025-12-30T19:05:00Z' }
        ]
      })
    );

    const d = await getEnrolmentAttendance('enrol-1');

    expect(d).toEqual([{ date: '12/30', year: '2025', state: 'present' }]);
  });

  it('無點名紀錄時回空陣列(不是 404)', async () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /enrolments/enrol-2/attendance': [] }));
    const d = await getEnrolmentAttendance('enrol-2');
    expect(d).toEqual([]);
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /enrolments/enrol-3/attendance': [] }));
    expect(getEnrolmentAttendance('enrol-3')).toBeInstanceOf(Promise);
  });
});

describe('getAccount', () => {
  it('GET /orders/me?per_page=100 → orders 映射(含 ordersTotal)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /orders/me?per_page=100': {
          orders: [orderSummary({
            id: 'order-1', order_number: 'DF-20260701AAAA', status: 'paid', total_cents: 480000, created_at: '2026-07-01T10:00:00Z',
            items: [{ name: '競技啦啦隊 進階班', quantity: 1 }]
          })],
          total: 1, page: 1, per_page: 100
        }
      })
    );

    const d = await getAccount();

    expect(d).toEqual({
      orders: [
        { id: 'DF-20260701AAAA', item: '競技啦啦隊 進階班', amount: 4800, status: ['success', '已付款'], date: '2026-07-01' }
      ],
      ordersTotal: 1
    });
  });

  it('訂單筆數超過單頁上限(如 total 57)時，orders.length 只有 20 但 ordersTotal 回真正的 57(pin：帳戶頁該顯示 57 筆，不是被截斷的 20)', async () => {
    const twentyOrders = Array.from({ length: 20 }, (_, i) => orderSummary({
      id: `order-${i}`, order_number: `DF-2026070${i}AAAA`, created_at: '2026-07-01T10:00:00Z',
      items: [{ name: '測試課程', quantity: 1 }]
    }));
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /orders/me?per_page=100': { orders: twentyOrders, total: 57, page: 1, per_page: 100 }
      })
    );

    const d = await getAccount();

    expect(d.orders).toHaveLength(20);
    expect(d.ordersTotal).toBe(57);
  });

  it('item 摘要依 items 數量組成：0 項 fallback 訂單編號、1 項用該項名稱、N>1 項用「第一項 外 N-1 項」', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /orders/me?per_page=100': {
          orders: [
            orderSummary({ id: 'o1', order_number: 'DF-1', status: 'paid', total_cents: 100000, created_at: '2026-01-01T00:00:00Z', items: [] }),
            orderSummary({ id: 'o2', order_number: 'DF-2', status: 'paid', total_cents: 100000, created_at: '2026-01-01T00:00:00Z', items: [{ name: '體操基礎班', quantity: 1 }] }),
            orderSummary({
              id: 'o3', order_number: 'DF-3', status: 'paid', total_cents: 100000, created_at: '2026-01-01T00:00:00Z',
              items: [
                { name: '體操基礎班', quantity: 1 },
                { name: '護具組', quantity: 2 },
                { name: '月票 · 自由練習', quantity: 1 }
              ]
            })
          ],
          total: 3, page: 1, per_page: 20
        }
      })
    );

    const d = await getAccount();

    expect(d.orders[0].item).toBe('訂單 DF-1'); // 0 項 → fallback
    expect(d.orders[1].item).toBe('體操基礎班'); // 1 項 → 該項名稱
    expect(d.orders[2].item).toBe('體操基礎班 外 2 項'); // 3 項 → 第一項 外 2 項
  });

  it('order status 對照表涵蓋 pending/processing/cancelled/refunded；未知值 fallback 為 neutral + 原字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /orders/me?per_page=100': {
          orders: [
            orderSummary({ id: 'o1', order_number: 'DF-1', status: 'pending', total_cents: 100000, created_at: '2026-01-01T00:00:00Z', items: [{ name: 'X', quantity: 1 }] }),
            orderSummary({ id: 'o2', order_number: 'DF-2', status: 'processing', total_cents: 200000, created_at: '2026-01-02T00:00:00Z', items: [{ name: 'X', quantity: 1 }] }),
            orderSummary({ id: 'o3', order_number: 'DF-3', status: 'cancelled', total_cents: 300000, created_at: '2026-01-03T00:00:00Z', items: [{ name: 'X', quantity: 1 }] }),
            orderSummary({ id: 'o4', order_number: 'DF-4', status: 'refunded', total_cents: 400000, created_at: '2026-01-04T00:00:00Z', items: [{ name: 'X', quantity: 1 }] }),
            orderSummary({ id: 'o5', order_number: 'DF-5', status: 'brand_new_status' as OrderStatus, total_cents: 500000, created_at: '2026-01-05T00:00:00Z', items: [{ name: 'X', quantity: 1 }] })
          ],
          total: 5, page: 1, per_page: 20
        }
      })
    );

    const d = await getAccount();
    expect(d.orders.map((o) => o.status)).toEqual([
      ['warning', '待付款'],
      ['info', '處理中'],
      ['error', '已取消'],
      ['neutral', '已退款'],
      ['neutral', 'brand_new_status']
    ]);
  });

  // R15(候選 F2)：會員資料水合(hydrateSelfAccount)與點數/訂閱暖機已搬出 getAccount()，
  // 改由呼叫端(member/account、mobile/account 頁面)自己宣告——getAccount 現在只打
  // 自己的路徑，不再等/碰這三支端點(側效失敗仍成功回傳 orders 的等價保證見
  // member/account/page.test.ts；暖機的通用 best-effort 行為見 $lib/store-warm.test.ts)。
  it('只打 GET /orders/me，不打 GET /users/me、GET /points/me、GET /subscriptions/me(水合與暖機移到頁面層)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /orders/me?per_page=100': { orders: [], total: 0, page: 1, per_page: 20 } })
    );

    await getAccount();

    const paths = vi.mocked(api).mock.calls.map(([p]) => p);
    expect(paths).toEqual(['/orders/me?per_page=100']);
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /orders/me?per_page=100': { orders: [], total: 0, page: 1, per_page: 20 } })
    );
    expect(getAccount()).toBeInstanceOf(Promise);
  });
});

describe('getCourses', () => {
  it('復用 public seam：listCourses + listCoaches join，映射為 CatalogCourse[]（coach 取真 name，非 title）', async () => {
    vi.mocked(listCourses).mockResolvedValue([
      {
        id: 'course-uuid-1', name: '競技啦啦隊 進階班', slug: 'advanced', level: 'advanced',
        description: '描述', duration_minutes: 90, price_cents: 480000, max_students: 12,
        min_age: 10, max_age: 16, features: [], is_active: true, coach_id: 'coach-1',
        category: '競技啦啦隊', schedule_text: '週二 / 週四 19:00', is_highlighted: true,
        created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        enrolled_count: 10, waitlist_count: 0
      }
    ]);
    vi.mocked(listCoaches).mockResolvedValue([
      { id: 'coach-1', user_id: 'u1', name: '林雅婷', title: '資深競技啦啦隊教練', bio: null, experience: null, specialties: [], certifications: [], is_active: true, display_order: 1, slug: null, photo_url: null, created_at: '2026-01-01T00:00:00Z' }
    ]);

    const d = await getCourses();

    expect(d).toEqual({
      catalog: [
        {
          id: 'course-uuid-1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊',
          age: '10–16 歲', days: '週二 / 週四 19:00', price: 4800, hot: true, coach: '林雅婷',
          desc: '描述', spots: 2
        }
      ]
    });
  });

  it('coach_id 為 null 時 coach 名稱為空字串(不觸發教練 join)', async () => {
    vi.mocked(listCourses).mockResolvedValue([
      {
        id: 'course-uuid-2', name: '親子體操', slug: 'kids', level: 'beginner', description: null,
        duration_minutes: 60, price_cents: 260000, max_students: 8, min_age: null, max_age: null,
        features: [], is_active: true, coach_id: null, category: null, schedule_text: null,
        is_highlighted: false, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
        enrolled_count: 0, waitlist_count: 0
      }
    ]);
    vi.mocked(listCoaches).mockResolvedValue([]);

    const d = await getCourses();
    expect(d.catalog[0].coach).toBe('');
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(listCourses).mockResolvedValue([]);
    vi.mocked(listCoaches).mockResolvedValue([]);
    expect(getCourses()).toBeInstanceOf(Promise);
  });
});

describe('getPoints — Task 14：rewards 換成真 GET /rewards（expiring/expiryDate 仍沿用 mock，後端無點數到期排程）', () => {
  it('rewards 映射為 UI 形狀(points_cost→pointsCost 改名；is_active/display_order 不進 UI)，並順手 hydrate points/pointsLedger store', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /rewards': {
          rewards: [
            { id: 'rw-1', name: '報名費折抵 NT$100', description: '下次報名課程可折抵 NT$100。', points_cost: 100, stock: null, is_active: true, display_order: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
            { id: 'rw-2', name: '限量托特包', description: null, points_cost: 300, stock: 0, is_active: true, display_order: 2, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' }
          ]
        },
        'GET /points/me': pointsMe({
          balance: 999,
          ledger: [{ id: 'l1', delta: 120, balance_after: 999, reason: 'checkout_earn', order_id: 'o1', created_at: '2026-07-01T00:00:00Z' }]
        })
      })
    );

    const d = await getPoints();

    expect(d).toEqual({
      rewards: [
        { id: 'rw-1', name: '報名費折抵 NT$100', description: '下次報名課程可折抵 NT$100。', pointsCost: 100, stock: null },
        { id: 'rw-2', name: '限量托特包', description: null, pointsCost: 300, stock: 0 }
      ],
      expiring: '360 點',
      expiryDate: '2026/12/31'
    });
    expect(get(points)).toBe(999);
    expect(get(pointsLedger)).toEqual([{ id: 'l1', date: '2026/07/01', desc: '消費獲得點數', type: 'earn', delta: 120 }]);
  });

  it('沒有任何品項時 rewards 回傳空陣列', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /rewards': { rewards: [] }, 'GET /points/me': pointsMe() })
    );
    const d = await getPoints();
    expect(d.rewards).toEqual([]);
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /rewards': { rewards: [] }, 'GET /points/me': pointsMe() })
    );
    expect(getPoints()).toBeInstanceOf(Promise);
  });
});
