/* Dream Fly — member/api.ts 單測(Task 17：8 個 getter 換真 API)。
 *
 * 只 mock $lib/api/client 的 api() 與 $lib/public/api 的 listCourses/listCoaches ——
 * 其餘(stores.ts 的 refreshPoints/refreshSubscriptions/refreshNotifications、
 * data.ts 的 mapNotification)一律用真實實作，這樣才是「後端形狀進、UI 形狀出」
 * 的端對端斷言，而不是把邏輯也一起 mock 掉。 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { getDashboard, getReports, getSchedule, getMine, getEnrolmentAttendance, getAccount, saveBirthDate, getCourses, getPoints, getNotifications } from './api';
import { api, ApiError } from '$lib/api/client';
import { listCourses, listCoaches } from '$lib/public/api';
import { points, pointsLedger, subscriptions, notifications, notificationsHydrated, waitlist, waitlistHydrated, leaveRequests, leaveRequestsHydrated } from './stores';
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE } from './data';

vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

vi.mock('$lib/public/api', () => ({
  listCourses: vi.fn(),
  listCoaches: vi.fn()
}));

/** 極小 fake router：依 "METHOD path" key 回應覆寫值；未交代的端點一律丟錯，
 *  讓漏掉某支 mock 的測試直接失敗而不是悄悄回傳 undefined(同 checkout-api.test.ts)。 */
function fakeRouter(overrides: Record<string, unknown>) {
  return vi.fn(async (path: string, init: RequestInit = {}) => {
    const method = (init.method ?? 'GET').toString().toUpperCase();
    const key = `${method} ${path}`;
    if (key in overrides) {
      const value = overrides[key];
      if (value instanceof Error) throw value;
      return value;
    }
    throw new Error(`unexpected api call: ${key}`);
  });
}

beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(listCourses).mockReset();
  vi.mocked(listCoaches).mockReset();
  points.set(0);
  pointsLedger.set([]);
  subscriptions.set([]);
  notifications.set([]);
  notificationsHydrated.set(false);
  waitlist.set([]);
  waitlistHydrated.set(false); // 模組單例旗標,不重置會跨 it 洩漏、讓 getMine 的旁路 hydrate 短路
  leaveRequests.set([]);
  leaveRequestsHydrated.set(false);
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

  it('nextClass 來自最新一筆有效報名的 schedule_text；track 空字串；skills/upcoming/announce 仍是 mock；stats 三卡改接 GET /reports/me(只換 value,icon/tint/color/label 沿用 STATS 版型)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'e1', course_id: 'c1', course_name: '競技啦啦隊 進階班', course_level: 'advanced', schedule_text: '週二 / 週四 19:00–20:30', status: 'active', enrolled_at: '2026-06-01T00:00:00Z' },
          { id: 'e2', course_id: 'c2', course_name: '已取消課程', course_level: 'beginner', schedule_text: '週三 10:00', status: 'cancelled', enrolled_at: '2026-01-01T00:00:00Z' }
        ],
        'GET /reports/me': STATS_API,
        'GET /points/me': { balance: 500, ledger: [] },
        'GET /notifications': []
      })
    );

    const d = await getDashboard();

    expect(d).toEqual({
      me: ME,
      stats: [
        { ...STATS[0], value: '2' },
        { ...STATS[1], value: '90%' },
        { ...STATS[2], value: '1,250' }
      ],
      skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
      nextClass: '週二 / 週四 19:00–20:30',
      track: ''
    });
  });

  it('attendanceRate 為 null(無點名資料，裁決 3)時 stats[1].value 顯示「—」，不是 0%', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API,
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /notifications': []
      })
    );

    const d = await getDashboard();
    expect(d.stats[1].value).toBe('—');
  });

  it('沒有任何有效報名時 nextClass 為空字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API,
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /notifications': []
      })
    );

    const d = await getDashboard();
    expect(d.nextClass).toBe('');
  });

  it('順手 hydrate points/notifications store(Topbar/Sidebar 角標一開始就是真資料)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API,
        'GET /points/me': { balance: 777, ledger: [] },
        'GET /notifications': [
          { id: 'n1', type: 'order_placed', title: '付款成功', message: '訂單已完成', is_read: false, metadata: null, created_at: '2026-07-04T06:00:00Z' }
        ]
      })
    );

    await getDashboard();

    expect(get(points)).toBe(777);
    expect(get(notifications)).toHaveLength(1);
    expect(get(notificationsHydrated)).toBe(true);
  });

  it('points/notifications hydrate 失敗不影響 dashboard 本身(仍正常回傳，只記錄錯誤)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API,
        'GET /points/me': new Error('network down'),
        'GET /notifications': []
      })
    );

    const d = await getDashboard();
    expect(d.nextClass).toBe('');
  });

  it('points/notifications hydrate 失敗時 console.error 記錄「getDashboard: <資源> hydrate 失敗」+ reason（雙端點皆失敗，逐字格式釘）', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pointsError = new Error('points network down');
    const notifError = new Error('notifications network down');
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API,
        'GET /points/me': pointsError,
        'GET /notifications': notifError
      })
    );

    await getDashboard();

    expect(errorSpy).toHaveBeenCalledWith('getDashboard: 點數 hydrate 失敗', pointsError);
    expect(errorSpy).toHaveBeenCalledWith('getDashboard: 通知 hydrate 失敗', notifError);
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /reports/me': EMPTY_STATS_API,
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /notifications': []
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
  // 卡 6：getMine 現在順手水合候補/請假 store（best-effort，與主 fetch 並行——mine
  // 頁原本的旁路 Promise.all 收進接縫）。既有 its 的 router 一律補上兩支端點的空
  // 陣列 entry：hydrate 是 best-effort、撞到 fakeRouter 的未交代拋錯不會讓 getMine
  // 失敗，但會留下 console.error 噪音。
  it('GET /enrolments/me → EnrolledCourse[]；只留 active；level 轉繁中；cat/coach/room 缺省空字串；attended/total 為真值、att 為兩者比率', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'enrol-1', course_id: 'course-1', course_name: '競技啦啦隊 進階班', course_level: 'advanced', schedule_text: '週二 / 週四 19:00–20:30', status: 'active', enrolled_at: '2026-06-01T00:00:00Z', attended: 18, total: 24 },
          { id: 'enrol-2', course_id: 'course-2', course_name: '已取消課程', course_level: 'beginner', schedule_text: '週三 10:00', status: 'cancelled', enrolled_at: '2026-01-01T00:00:00Z', attended: 5, total: 5 }
        ],
        'GET /waitlist/me': [],
        'GET /leave-requests/me': []
      })
    );

    const d = await getMine();

    expect(d).toEqual({
      courses: [
        {
          // FE#17：level 走共用 5 級對照(advanced → 進階)，不再是舊的三態 初/中/高級。
          id: 'enrol-1', course_id: 'course-1', name: '競技啦啦隊 進階班', cat: '', level: '進階', coach: '',
          icon: 'sparkles', color: '#0066CC', schedule: '週二 / 週四 19:00–20:30', room: '',
          att: 75, attended: 18, total: 24, next: '', term: '', remain: 0
        }
      ]
    });
  });

  it('沒有任何點名紀錄(total 為 0)時 attended/total/att 皆為 0，不除以零', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'e1', course_id: 'c1', course_name: '幼兒體操 啟蒙班', course_level: 'beginner', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 }
        ],
        'GET /waitlist/me': [],
        'GET /leave-requests/me': []
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
        ],
        'GET /waitlist/me': [],
        'GET /leave-requests/me': []
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
        ],
        'GET /waitlist/me': [],
        'GET /leave-requests/me': []
      })
    );
    const d = await getMine();
    expect(d.courses[0].schedule).toBe('');
  });

  it('順手 hydrate waitlist/leaveRequests store（候補只留 status=waiting，同 hydrateWaitlist 語意；請假映射丟棄 decided_at）', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /waitlist/me': [
          { id: 'wl-1', course_id: 'course-x', course_name: '候補課程 X', status: 'waiting', created_at: '2026-07-01T00:00:00Z' },
          { id: 'wl-2', course_id: 'course-y', course_name: '候補課程 Y（已取消）', status: 'cancelled', created_at: '2026-06-01T00:00:00Z' }
        ],
        'GET /leave-requests/me': [
          { id: 'lr-1', course_id: 'c1', course_name: '競技啦啦隊 進階班', session_id: 's1', session_date: '2026-07-10', start_time: '19:00:00', reason: '生病', status: 'pending', makeup_session_id: null, makeup_session_date: null, makeup_start_time: null, decided_at: null, created_at: '2026-07-01T00:00:00Z' }
        ]
      })
    );

    await getMine();

    expect(get(waitlist)).toEqual([{ id: 'wl-1', course_id: 'course-x', course_name: '候補課程 X' }]);
    expect(get(leaveRequests)).toEqual([
      { id: 'lr-1', course_id: 'c1', course_name: '競技啦啦隊 進階班', session_id: 's1', session_date: '2026-07-10', start_time: '19:00:00', reason: '生病', status: 'pending', makeup_session_id: null, makeup_session_date: null, makeup_start_time: null, created_at: '2026-07-01T00:00:00Z' }
    ]);
  });

  it('waitlist/leaveRequests hydrate 失敗不影響 getMine 主結果(主 fetch fail-hard、旁路 best-effort,同 getDashboard 模式)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [
          { id: 'e1', course_id: 'c1', course_name: '幼兒體操 啟蒙班', course_level: 'beginner', schedule_text: null, status: 'active', enrolled_at: '2026-01-01T00:00:00Z', attended: 0, total: 0 }
        ],
        'GET /waitlist/me': new Error('network down'),
        'GET /leave-requests/me': new Error('network down')
      })
    );

    const d = await getMine();
    expect(d.courses).toHaveLength(1);
    expect(d.courses[0].name).toBe('幼兒體操 啟蒙班');
  });

  it('hydrate 失敗時 console.error 記錄「getMine: <資源> hydrate 失敗」+ reason（雙端點皆失敗，逐字格式釘）', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const waitlistError = new Error('waitlist network down');
    const leaveError = new Error('leave network down');
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /enrolments/me': [],
        'GET /waitlist/me': waitlistError,
        'GET /leave-requests/me': leaveError
      })
    );

    await getMine();

    expect(errorSpy).toHaveBeenCalledWith('getMine: 候補清單 hydrate 失敗', waitlistError);
    expect(errorSpy).toHaveBeenCalledWith('getMine: 我的請假 hydrate 失敗', leaveError);
  });

  it('水合與主 fetch 並行啟動（主 fetch 未 resolve 前旁路已發出——卡 6 等價保證，退化成尾端序列會紅）', async () => {
    const seen: string[] = [];
    let resolveEnrolments!: (v: unknown) => void;
    vi.mocked(api).mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? 'GET').toString().toUpperCase();
      const key = `${method} ${path}`;
      seen.push(key);
      if (key === 'GET /enrolments/me') return new Promise((res) => { resolveEnrolments = res; });
      if (key === 'GET /waitlist/me' || key === 'GET /leave-requests/me') return [];
      throw new Error(`unexpected api call: ${key}`);
    });

    const p = getMine();
    await vi.waitFor(() => {
      expect(seen).toContain('GET /waitlist/me');
      expect(seen).toContain('GET /leave-requests/me');
    });

    resolveEnrolments([]);
    const d = await p;
    expect(d.courses).toEqual([]);
  });

  it('是 async 接縫(回 Promise)', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /enrolments/me': [], 'GET /waitlist/me': [], 'GET /leave-requests/me': [] })
    );
    const p = getMine();
    expect(p).toBeInstanceOf(Promise);
    await p; // 卡 6：等 hydrate 副作用落定，store 寫入不逸出到下一個 it
  });
});

describe('getEnrolmentAttendance — GET /enrolments/{id}/attendance（Task F7；逐堂出勤明細，§3.12）', () => {
  it('session_date(YYYY-MM-DD) → date(MM/DD)；status 原樣映射為 state；依端點回應順序輸出(後端已保證舊到新)', async () => {
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
      { date: '05/14', state: 'present' },
      { date: '05/21', state: 'leave' },
      { date: '05/28', state: 'absent' }
    ]);
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
  it('GET /users/me + GET /orders/me → profile + orders 映射；順手 hydrate points/subscriptions store', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /users/me': { id: 'user-uuid-1', email: 'wang@example.com', name: '王承恩', phone: '0911222333', created_at: '2023-09-15T00:00:00Z' },
        'GET /orders/me': {
          orders: [{
            id: 'order-1', order_number: 'DF-20260701AAAA', status: 'paid', total_cents: 480000, created_at: '2026-07-01T10:00:00Z',
            items: [{ name: '競技啦啦隊 進階班', quantity: 1 }]
          }],
          total: 1, page: 1, per_page: 20
        },
        'GET /points/me': { balance: 1250, ledger: [] },
        'GET /subscriptions/me': []
      })
    );

    const d = await getAccount();

    expect(d).toEqual({
      orders: [
        { id: 'DF-20260701AAAA', item: '競技啦啦隊 進階班', amount: 4800, status: ['success', '已付款'], date: '2026-07-01' }
      ],
      profile: {
        name: '王承恩', initial: '王', color: '#0066CC', id: 'user-uuid-1', since: '2023/09',
        points: 1250, age: 0, birth: '', phone: '0911222333', email: 'wang@example.com',
        guardian: '', remind: true, promo: false
      }
    });
    expect(get(subscriptions)).toEqual([]);
  });

  it('item 摘要依 items 數量組成：0 項 fallback 訂單編號、1 項用該項名稱、N>1 項用「第一項 外 N-1 項」', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /users/me': { id: 'u1', email: 'a@b.com', name: '測試', phone: null, created_at: '2026-01-01T00:00:00Z' },
        'GET /orders/me': {
          orders: [
            { id: 'o1', order_number: 'DF-1', status: 'paid', total_cents: 100000, created_at: '2026-01-01T00:00:00Z', items: [] },
            { id: 'o2', order_number: 'DF-2', status: 'paid', total_cents: 100000, created_at: '2026-01-01T00:00:00Z', items: [{ name: '體操基礎班', quantity: 1 }] },
            {
              id: 'o3', order_number: 'DF-3', status: 'paid', total_cents: 100000, created_at: '2026-01-01T00:00:00Z',
              items: [
                { name: '體操基礎班', quantity: 1 },
                { name: '護具組', quantity: 2 },
                { name: '月票 · 自由練習', quantity: 1 }
              ]
            }
          ],
          total: 3, page: 1, per_page: 20
        },
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /subscriptions/me': []
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
        'GET /users/me': { id: 'u1', email: 'a@b.com', name: '測試', phone: null, created_at: '2026-01-01T00:00:00Z' },
        'GET /orders/me': {
          orders: [
            { id: 'o1', order_number: 'DF-1', status: 'pending', total_cents: 100000, created_at: '2026-01-01T00:00:00Z', items: [{ name: 'X', quantity: 1 }] },
            { id: 'o2', order_number: 'DF-2', status: 'processing', total_cents: 200000, created_at: '2026-01-02T00:00:00Z', items: [{ name: 'X', quantity: 1 }] },
            { id: 'o3', order_number: 'DF-3', status: 'cancelled', total_cents: 300000, created_at: '2026-01-03T00:00:00Z', items: [{ name: 'X', quantity: 1 }] },
            { id: 'o4', order_number: 'DF-4', status: 'refunded', total_cents: 400000, created_at: '2026-01-04T00:00:00Z', items: [{ name: 'X', quantity: 1 }] },
            { id: 'o5', order_number: 'DF-5', status: 'brand_new_status', total_cents: 500000, created_at: '2026-01-05T00:00:00Z', items: [{ name: 'X', quantity: 1 }] }
          ],
          total: 5, page: 1, per_page: 20
        },
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /subscriptions/me': []
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

  it('側效 hydrate(points/subscriptions)失敗時仍成功回傳 profile+orders(主資料 fail-hard、側效 best-effort,同 getDashboard 模式)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /users/me': { id: 'u3', email: 'a@b.com', name: '測試三', phone: null, created_at: '2026-01-01T00:00:00Z' },
        'GET /orders/me': {
          orders: [{ id: 'o9', order_number: 'DF-9', status: 'paid', total_cents: 100000, created_at: '2026-02-01T00:00:00Z', items: [] }],
          total: 1, page: 1, per_page: 20
        },
        'GET /points/me': new Error('network down'),
        'GET /subscriptions/me': new Error('network down')
      })
    );

    const d = await getAccount();

    expect(d.profile.name).toBe('測試三');
    expect(d.orders).toEqual([
      { id: 'DF-9', item: '訂單 DF-9', amount: 1000, status: ['success', '已付款'], date: '2026-02-01' }
    ]);
  });

  it('側效 hydrate 失敗時 console.error 記錄「getAccount: <資源> hydrate 失敗」+ reason（雙端點皆失敗，逐字格式釘）', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pointsError = new Error('points network down');
    const subsError = new Error('subscriptions network down');
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /users/me': { id: 'u6', email: 'a@b.com', name: '測試六', phone: null, created_at: '2026-01-01T00:00:00Z' },
        'GET /orders/me': { orders: [], total: 0, page: 1, per_page: 20 },
        'GET /points/me': pointsError,
        'GET /subscriptions/me': subsError
      })
    );

    await getAccount();

    expect(errorSpy).toHaveBeenCalledWith('getAccount: 點數 hydrate 失敗', pointsError);
    expect(errorSpy).toHaveBeenCalledWith('getAccount: 訂閱 hydrate 失敗', subsError);
  });

  it('phone 為 null 時映射為空字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /users/me': { id: 'u2', email: 'a@b.com', name: '測試二', phone: null, created_at: '2026-01-01T00:00:00Z' },
        'GET /orders/me': { orders: [], total: 0, page: 1, per_page: 20 },
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /subscriptions/me': []
      })
    );
    const d = await getAccount();
    expect(d.profile.phone).toBe('');
  });

  it('birth_date（Round 4 Task P4-F4）：ISO 字串直接沿用；null 映射為空字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /users/me': { id: 'u4', email: 'a@b.com', name: '測試四', phone: null, created_at: '2026-01-01T00:00:00Z', birth_date: '2013-05-18' },
        'GET /orders/me': { orders: [], total: 0, page: 1, per_page: 20 },
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /subscriptions/me': []
      })
    );
    const d = await getAccount();
    expect(d.profile.birth).toBe('2013-05-18');
  });

  it('birth_date 為 null 時映射為空字串', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /users/me': { id: 'u5', email: 'a@b.com', name: '測試五', phone: null, created_at: '2026-01-01T00:00:00Z', birth_date: null },
        'GET /orders/me': { orders: [], total: 0, page: 1, per_page: 20 },
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /subscriptions/me': []
      })
    );
    const d = await getAccount();
    expect(d.profile.birth).toBe('');
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /users/me': { id: 'u', email: 'a@b.com', name: 'x', phone: null, created_at: '2026-01-01T00:00:00Z' },
        'GET /orders/me': { orders: [], total: 0, page: 1, per_page: 20 },
        'GET /points/me': { balance: 0, ledger: [] },
        'GET /subscriptions/me': []
      })
    );
    expect(getAccount()).toBeInstanceOf(Promise);
  });
});

describe('saveBirthDate — PATCH /users/me { birth_date }（Round 4 Task P4-F4）', () => {
  it('送出 YYYY-MM-DD 字串；回應經 mapProfile 映射回 AccountProfile', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'PATCH /users/me': { id: 'u1', email: 'a@b.com', name: '測試', phone: null, created_at: '2026-01-01T00:00:00Z', birth_date: '2015-06-12' }
      })
    );

    const profile = await saveBirthDate('2015-06-12');

    expect(api).toHaveBeenCalledWith('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ birth_date: '2015-06-12' })
    });
    expect(profile.birth).toBe('2015-06-12');
  });

  it('空字串 → 送出顯式 JSON null（清空），不是省略欄位', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'PATCH /users/me': { id: 'u1', email: 'a@b.com', name: '測試', phone: null, created_at: '2026-01-01T00:00:00Z', birth_date: null }
      })
    );

    const profile = await saveBirthDate('');

    expect(api).toHaveBeenCalledWith('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({ birth_date: null })
    });
    expect(profile.birth).toBe('');
  });

  it('422（範圍外日期）原樣拋出', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'PATCH /users/me': new ApiError(422, 'birth_date out of range') })
    );

    await expect(saveBirthDate('1899-12-31')).rejects.toMatchObject({ status: 422 });
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
        'GET /points/me': {
          balance: 999,
          ledger: [{ id: 'l1', delta: 120, balance_after: 999, reason: 'checkout_earn', order_id: 'o1', created_at: '2026-07-01T00:00:00Z' }]
        }
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
      fakeRouter({ 'GET /rewards': { rewards: [] }, 'GET /points/me': { balance: 0, ledger: [] } })
    );
    const d = await getPoints();
    expect(d.rewards).toEqual([]);
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({ 'GET /rewards': { rewards: [] }, 'GET /points/me': { balance: 0, ledger: [] } })
    );
    expect(getPoints()).toBeInstanceOf(Promise);
  });
});

describe('getNotifications', () => {
  it('type→cat/icon/tone 對照表涵蓋所有後端型別，含未知值 fallback', async () => {
    const make = (id: string, type: string) => ({ id, type, title: 't-' + id, message: 'm-' + id, is_read: false, metadata: null, created_at: '2026-07-04T06:30:00Z' });
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /notifications': [
          make('n1', 'booking_confirmed'),
          make('n2', 'booking_cancelled'),
          make('n3', 'order_placed'),
          make('n4', 'order_status'),
          make('n5', 'system'),
          make('n6', 'promotion'),
          make('n7', 'brand_new_unknown_type')
        ]
      })
    );

    const list = await getNotifications();

    expect(list.map((n) => [n.cat, n.icon, n.tone])).toEqual([
      ['class', 'calendar-check', 'success'],
      ['class', 'calendar-off', 'warning'],
      ['order', 'credit-card', 'success'],
      ['order', 'rotate-cw', 'info'],
      ['system', 'bell', 'neutral'],
      ['system', 'megaphone', 'accent'],
      ['system', 'bell', 'neutral'] // 未知型別 fallback，不因後端新增 enum 值而炸掉
    ]);
  });

  it('id/title/message/is_read 直接映射；time 取 created_at 的 YYYY-MM-DD HH:mm', async () => {
    vi.mocked(api).mockImplementation(
      fakeRouter({
        'GET /notifications': [
          { id: 'n9', type: 'system', title: '標題', message: '內容', is_read: true, metadata: null, created_at: '2026-07-04T06:30:00Z' }
        ]
      })
    );
    const [n] = await getNotifications();
    expect(n).toEqual({ id: 'n9', cat: 'system', icon: 'bell', tone: 'neutral', title: '標題', body: '內容', time: '2026-07-04 06:30', read: true });
  });

  it('是 async 接縫(回 Promise)', () => {
    vi.mocked(api).mockImplementation(fakeRouter({ 'GET /notifications': [] }));
    expect(getNotifications()).toBeInstanceOf(Promise);
  });
});
