import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { waitlist, leaveRequests, toasts, hydrateWaitlist, hydrateLeaveRequests, type LeaveRequest } from '$lib/member/stores';
import { api, ApiError } from '$lib/api/client';
import Page from './+page.svelte';
import { fakeRouter } from '$lib/testing/fake-router';
import { MEMBER_ROUTES } from '$lib/testing/member-routes';
import { attendanceEntry, myEnrolment } from '$lib/testing/wire-fixtures';
import type { AttendanceStatus } from '$lib/api/generated';

// 只替換 api()，ApiError 用回真實類別。真的 getMine / getEnrolmentAttendance + mapper 會跑——
// 候補/請假清單的映射與 hydrate 失敗不擋主資料等水合語意由 member/api.test.ts、
// $lib/store-warm.test.ts 把關，這裡的路由只交代報名/出席明細，加上動作端點：取消的
// DELETE（/waitlist/{id}、/leave-requests/{id}）與 dialog 的場次查詢（GET /courses/{id}/sessions）。
vi.mock('$lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/api/client')>();
  return { ...actual, api: vi.fn() };
});

// R15(候選 F2)：候補/請假的暖機搬到本頁的 gate.fetch 自己宣告(與 getMine() 並行)——
// hydrateWaitlist/hydrateLeaveRequests 在此整支 mock 掉，候補/請假清單一律改 store
// 直接 seed，這個檔案只驗頁面渲染與取消動作佈線，不重複測 hydrate 本身的語意。
vi.mock('$lib/member/stores', async (importOriginal) => {
  const actual = await importOriginal<typeof import('$lib/member/stores')>();
  return { ...actual, hydrateWaitlist: vi.fn(), hydrateLeaveRequests: vi.fn() };
});

// 原 EnrolledCourse 畫面形狀 fixture 改為 wire 輸入(2 筆,沿用真實種子 k1/k6 的欄位值;
// 下方多處斷言依賴 index 0/1 各自的 id/name 相異)。att 98 → attended 49 / total 50、
// att 88 → attended 22 / total 25(att 由 mapper 相除而來)。
const ENROLMENTS = [
  myEnrolment({ id: 'k1', course_name: '競技啦啦隊 進階班', course_level: 'advanced', schedule_text: '週二 / 週四 19:00–20:30', attended: 49, total: 50 }),
  myEnrolment({ id: 'k6', course_name: '競技體操 選手班', course_level: 'elite', schedule_text: '週四 17:00–19:00', attended: 22, total: 25 })
];

/** 預設:兩筆報名、空出勤明細——不關心出席明細內容的既有測試(候補/請假相關)不用逐一配置。 */
const route = (over: Record<string, unknown> = {}) =>
  vi.mocked(api).mockImplementation(
    fakeRouter(over, {
      ...MEMBER_ROUTES,
      'GET /enrolments/me': ENROLMENTS,
      'GET /enrolments/k1/attendance': [],
      'GET /enrolments/k6/attendance': []
    })
  );

beforeEach(() => {
  vi.mocked(api).mockReset();
  vi.mocked(hydrateWaitlist).mockReset().mockResolvedValue(undefined);
  vi.mocked(hydrateLeaveRequests).mockReset().mockResolvedValue(undefined);
  waitlist.set([]);
  leaveRequests.set([]);
});

describe('member/mine 頁', () => {
  it('先骨架,async 載入後顯示資料', async () => {
    route();
    render(Page);
    // 出席紀錄(ready 專屬內容)尚未出現
    expect(screen.queryByText('出席紀錄')).toBeNull();
    // 載入後出現
    expect(await screen.findByText('出席紀錄')).toBeInTheDocument();
  });

  it('載入失敗顯示 ErrorState', async () => {
    route({ 'GET /enrolments/me': new Error('boom') });
    render(Page);
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();
  });

  it('KPI 只留出席率;課程卡/詳情不再顯示後端沒有的教練、季別、教室、下一堂、剩餘堂數(R16 Task 2c)', async () => {
    route();
    const { container } = render(Page);
    await screen.findByText('出席紀錄');
    const txt = container.textContent ?? '';
    expect(txt).toContain('98%');
    for (const gone of ['下一堂', '剩餘堂數', ' 教練 · ', ' · undefined']) expect(txt).not.toContain(gone);
    // 詳情標題下只顯示時段，不接落單的「 · 」
    expect(screen.getByText('週二 / 週四 19:00–20:30')).toBeInTheDocument();
  });

  // 迴歸:出席紀錄若以顯示文字/日期為 key,同日同狀態時 Svelte 擲 each_key_duplicate。
  // 改用 index key 後即使有同日同狀態項目也不崩潰。
  it('出席紀錄含同日同狀態項目時仍正常渲染(index-key 迴歸)', async () => {
    const dupRec = attendanceEntry({ session_date: '2026-06-06', status: 'present' });
    route({ 'GET /enrolments/k1/attendance': [dupRec, dupRec] });
    render(Page);
    // 出席紀錄標題出現即代表清單正常渲染,未因重複 key 崩潰
    expect(await screen.findByText('出席紀錄')).toBeInTheDocument();
  });

  it('loading 分支有可辨識骨架標記', () => {
    // 永遠 pending — 不 flush
    route({ 'GET /enrolments/me': () => new Promise(() => {}) });
    const { container } = render(Page);
    expect(container.querySelector('[data-testid="mine-skeleton"]')).not.toBeNull();
  });

  // 迴歸:新會員 courses:[] 時,成功 resolve 不應落入 catch → error state。
  // 修正前:d.courses[0].id 擲 TypeError → .catch → 顯示「載入失敗」
  it('courses 為空陣列時成功載入並顯示空狀態(不進 error state)', async () => {
    route({ 'GET /enrolments/me': [] });
    render(Page);
    // 空狀態訊息出現代表頁面到達 ready
    expect(await screen.findByText('尚未報名任何課程')).toBeInTheDocument();
    // 不得顯示錯誤狀態
    expect(screen.queryByText('載入失敗')).toBeNull();
  });

  // R15(候選 F2)：候補清單/我的請假的暖機收進本頁的 gate.fetch，與主 getMine() 同一個
  // Promise.all 並行發出——退化成「等 getMine 完成才暖機」的尾端序列會紅(主 fetch
  // 未 resolve 前，暖機已經先發出)。
  it('候補清單/我的請假暖機與主 getMine() 並行發出，不是等主 fetch 完成才暖機', async () => {
    let resolveMine!: (v: never[]) => void;
    route({ 'GET /enrolments/me': () => new Promise((res) => { resolveMine = res; }) });

    render(Page);

    await vi.waitFor(() => {
      expect(hydrateWaitlist).toHaveBeenCalled();
      expect(hydrateLeaveRequests).toHaveBeenCalled();
    });

    resolveMine([]);
    expect(await screen.findByText('尚未報名任何課程')).toBeInTheDocument();
  });
});

describe('member/mine 頁 — 出席明細(Task F7：GET /enrolments/{id}/attendance，§3.12)', () => {
  it('進頁以第一筆報名 id 呼叫 getEnrolmentAttendance，渲染回傳的出席紀錄', async () => {
    route({
      'GET /waitlist/me': [], 'GET /leave-requests/me': [],
      'GET /enrolments/k1/attendance': [
        attendanceEntry({ session_date: '2026-06-06', status: 'present' }),
        attendanceEntry({ session_date: '2026-05-21', status: 'leave' })
      ]
    });

    render(Page);

    expect(await screen.findByText('出席紀錄')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith(`/enrolments/${ENROLMENTS[0].id}/attendance`);
    expect(screen.getByText('06/06')).toBeInTheDocument();
  });

  it('後端多一個出勤狀態(未知值)時照樣渲染：徽章顯示原字串，其他紀錄不受影響', async () => {
    route({
      'GET /waitlist/me': [], 'GET /leave-requests/me': [],
      'GET /enrolments/k1/attendance': [
        attendanceEntry({ session_date: '2026-06-06', status: 'present' }),
        attendanceEntry({ session_date: '2026-05-21', status: 'excused' as AttendanceStatus })
      ]
    });

    render(Page);

    expect(await screen.findByText('excused')).toBeInTheDocument();
    expect(screen.getByText('出席')).toBeInTheDocument();
  });

  it('切換選取的課程時，以該課程 id 重新呼叫 getEnrolmentAttendance', async () => {
    route({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [] });

    render(Page);
    await screen.findByText('出席紀錄');
    expect(api).toHaveBeenCalledWith(`/enrolments/${ENROLMENTS[0].id}/attendance`);

    await fireEvent.click(screen.getByText(ENROLMENTS[1].course_name));

    await vi.waitFor(() => expect(api).toHaveBeenCalledWith(`/enrolments/${ENROLMENTS[1].id}/attendance`));
  });

  it('無出勤紀錄時顯示「尚無出勤紀錄」空狀態', async () => {
    route({ 'GET /waitlist/me': [], 'GET /leave-requests/me': [] });

    render(Page);

    expect(await screen.findByText('尚無出勤紀錄')).toBeInTheDocument();
  });

  it('出席明細載入失敗顯示錯誤狀態，點「重新載入」可重試', async () => {
    let attendanceCalls = 0;
    route({
      'GET /waitlist/me': [], 'GET /leave-requests/me': [],
      // 第一次失敗、重試成功
      'GET /enrolments/k1/attendance': () =>
        ++attendanceCalls === 1 ? new Error('boom') : [attendanceEntry({ session_date: '2026-06-06', status: 'present' })]
    });

    render(Page);
    await screen.findByText('出席紀錄');
    expect(await screen.findByText('載入失敗')).toBeInTheDocument();

    await fireEvent.click(screen.getByText('重新載入'));

    await vi.waitFor(() => expect(screen.getByText('06/06')).toBeInTheDocument());
  });
});

describe('member/mine 頁 — 候補中課程（Task 3：waitlist store 清單 + DELETE 取消）', () => {
  // 卡 6：GET /waitlist/me 的水合（含 waiting 過濾）收進 getMine() 接縫，由
  // member/api.test.ts 把關——這裡改 store 直接 seed，只驗清單渲染與取消動作佈線。
  const WL_ENTRY = { id: 'wl-1', course_id: 'course-x', course_name: '候補課程 X' };

  it('沒有候補中的課程時顯示空狀態', async () => {
    route();

    render(Page);

    await screen.findByText('出席紀錄'); // 等頁面進 ready
    expect(await screen.findByText('目前沒有候補中的課程')).toBeInTheDocument();
  });

  it('點擊「取消候補」→ DELETE /waitlist/{id} 成功後從清單移除', async () => {
    waitlist.set([WL_ENTRY]);
    route({ 'DELETE /waitlist/wl-1': undefined });

    render(Page);
    const btn = await screen.findByRole('button', { name: '取消候補' });
    await fireEvent.click(btn);

    await vi.waitFor(() => expect(screen.queryByText('候補課程 X')).toBeNull());
    expect(api).toHaveBeenCalledWith('/waitlist/wl-1', { method: 'DELETE' });
    expect(await screen.findByText('目前沒有候補中的課程')).toBeInTheDocument();
  });

  it('取消候補失敗 → 顯示錯誤 toast，清單不變', async () => {
    waitlist.set([WL_ENTRY]);
    route({ 'DELETE /waitlist/wl-1': new ApiError(404, 'waitlist entry not found') });

    render(Page);
    const btn = await screen.findByRole('button', { name: '取消候補' });
    await fireEvent.click(btn);

    await vi.waitFor(() => {
      expect(get(toasts).some((t) => t.tone === 'error' && t.title === '取消候補失敗')).toBe(true);
    });
    expect(screen.getByText('候補課程 X')).toBeInTheDocument(); // 未從清單移除
  });
});

describe('member/mine 頁 — 請假入口（Task 11：每門課「請假」按鈕開啟 LeaveDialog）', () => {
  it('課程詳情動作列只有「請假」與「聯絡教練」（不再有課程層級的「預約補課」——補課現在是「我的請假」清單裡逐筆的動作）', async () => {
    route();
    render(Page);
    await screen.findByText('出席紀錄');
    // 出席紀錄裡也有一筆「請假」狀態 badge（非按鈕）——用 role 精準鎖定動作列按鈕。
    expect(screen.getByRole('button', { name: '請假' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '聯絡教練' })).toBeInTheDocument();
  });

  it('點擊「請假」開啟請假申請 dialog', async () => {
    route();
    render(Page);
    await screen.findByText('出席紀錄');
    await fireEvent.click(screen.getByRole('button', { name: '請假' }));
    expect(await screen.findByText('請假申請')).toBeInTheDocument();
  });
});

describe('member/mine 頁 — 我的請假（Task 11：leaveRequests store 清單 + 取消/預約補課）', () => {
  // 卡 6：GET /leave-requests/me 的水合（含 hydrate 失敗不擋主資料）收進 getMine()
  // 接縫，由 member/api.test.ts 把關——fixture 改 UI 形 LeaveRequest 直接 seed store。
  const LR_PENDING: LeaveRequest = {
    id: 'lr-1', course_id: 'c1', course_name: '請假課程 A', session_id: 's1',
    session_date: '2026-07-10', start_time: '19:00:00', reason: '生病',
    status: 'pending', makeup_session_id: null, makeup_session_date: null, makeup_start_time: null,
    created_at: '2026-07-01T00:00:00Z'
  };
  const LR_APPROVED_UNBOOKED: LeaveRequest = { ...LR_PENDING, id: 'lr-2', course_name: '請假課程 B', status: 'approved', reason: null };
  const LR_APPROVED_BOOKED: LeaveRequest = {
    ...LR_PENDING, id: 'lr-3', course_name: '請假課程 C', status: 'approved',
    makeup_session_id: 'sess-9', makeup_session_date: '2026-07-20', makeup_start_time: '18:00:00'
  };
  const LR_REJECTED: LeaveRequest = { ...LR_PENDING, id: 'lr-4', course_name: '請假課程 D', status: 'rejected' };
  const LR_CANCELLED: LeaveRequest = { ...LR_PENDING, id: 'lr-5', course_name: '請假課程 E', status: 'cancelled' };

  it('沒有請假紀錄時顯示空狀態', async () => {
    route();
    render(Page);
    await screen.findByText('出席紀錄');
    expect(await screen.findByText('目前沒有請假紀錄')).toBeInTheDocument();
  });

  it('pending → 顯示待審核 badge 與「取消」按鈕', async () => {
    route();
    leaveRequests.set([LR_PENDING]);
    render(Page);
    await screen.findByText('請假課程 A');
    expect(screen.getByText('待審核')).toBeInTheDocument();
    expect(screen.getByText('取消')).toBeInTheDocument();
    expect(screen.queryByText('預約補課')).toBeNull();
  });

  it('approved 且未補課 → 顯示已核准 badge 與「預約補課」按鈕（不顯示取消）', async () => {
    route();
    leaveRequests.set([LR_APPROVED_UNBOOKED]);
    render(Page);
    await screen.findByText('請假課程 B');
    expect(screen.getByText('已核准')).toBeInTheDocument();
    expect(screen.getByText('預約補課')).toBeInTheDocument();
    expect(screen.queryByText('取消')).toBeNull();
  });

  it('approved 且已補課 → 顯示補課場次資訊，不顯示「預約補課」按鈕', async () => {
    route();
    leaveRequests.set([LR_APPROVED_BOOKED]);
    render(Page);
    await screen.findByText('請假課程 C');
    expect(screen.getByText('已核准')).toBeInTheDocument();
    expect(screen.getByText(/已預約補課/)).toBeInTheDocument();
    expect(screen.queryByText('預約補課')).toBeNull();
  });

  it('rejected → 顯示已婉拒 badge，不顯示任何動作按鈕', async () => {
    route();
    leaveRequests.set([LR_REJECTED]);
    render(Page);
    await screen.findByText('請假課程 D');
    expect(screen.getByText('已婉拒')).toBeInTheDocument();
    expect(screen.queryByText('取消')).toBeNull();
    expect(screen.queryByText('預約補課')).toBeNull();
  });

  it('cancelled → 顯示已取消 badge，不顯示任何動作按鈕', async () => {
    route();
    leaveRequests.set([LR_CANCELLED]);
    render(Page);
    await screen.findByText('請假課程 E');
    expect(screen.getByText('已取消')).toBeInTheDocument();
    expect(screen.queryByText('取消')).toBeNull();
    expect(screen.queryByText('預約補課')).toBeNull();
  });

  it('點擊「取消」→ DELETE /leave-requests/{id} 成功後狀態原地變為已取消（清單不移除該筆）', async () => {
    leaveRequests.set([LR_PENDING]);
    route({ 'DELETE /leave-requests/lr-1': undefined });
    render(Page);
    const btn = await screen.findByRole('button', { name: '取消' });
    await fireEvent.click(btn);

    await vi.waitFor(() => expect(screen.getByText('已取消')).toBeInTheDocument());
    expect(api).toHaveBeenCalledWith('/leave-requests/lr-1', { method: 'DELETE' });
    expect(screen.getByText('請假課程 A')).toBeInTheDocument(); // 仍在清單中，只是狀態改變
  });

  it('取消失敗 → 顯示錯誤 toast，狀態不變', async () => {
    leaveRequests.set([LR_PENDING]);
    route({ 'DELETE /leave-requests/lr-1': new ApiError(409, '僅待審核假單可取消') });
    render(Page);
    const btn = await screen.findByRole('button', { name: '取消' });
    await fireEvent.click(btn);

    await vi.waitFor(() => {
      expect(
        get(toasts).some((t) => t.tone === 'error' && t.title === '取消請假失敗' && t.body === '僅待審核假單可取消')
      ).toBe(true);
    });
    expect(screen.getByText('待審核')).toBeInTheDocument(); // 狀態未變
  });

  // 卡 6：busy 旗標佈線的可證偽測試——取消 in-flight（DELETE 未 resolve）期間按鈕
  // 必須停用；resolve 後走完既有成功路徑（狀態原地變已取消）。
  it('取消進行中（DELETE 尚未完成）時「取消」按鈕停用', async () => {
    leaveRequests.set([LR_PENDING]);
    let resolveDelete!: () => void;
    route({ 'DELETE /leave-requests/lr-1': () => new Promise<void>((res) => { resolveDelete = res; }) });
    render(Page);
    const btn = await screen.findByRole('button', { name: '取消' });
    expect(btn).not.toBeDisabled();

    await fireEvent.click(btn);

    await vi.waitFor(() => expect(btn).toBeDisabled());
    resolveDelete(); // 收尾不留 in-flight——resolve 後狀態原地變為已取消
    await vi.waitFor(() => expect(screen.getByText('已取消')).toBeInTheDocument());
  });

  it('點擊「預約補課」開啟補課 dialog，並用該假單的 course_id（而非目前選取課程）查詢場次', async () => {
    leaveRequests.set([LR_APPROVED_UNBOOKED]);
    route({
        'GET /courses/c1/sessions': [
          { id: 'sess-9', course_id: 'c1', session_date: '2026-07-20', start_time: '18:00:00', end_time: '19:00:00' }
        ]
      });
    render(Page);
    await screen.findByText('預約補課');
    await fireEvent.click(screen.getByText('預約補課'));

    expect(await screen.findByText('確認預約')).toBeInTheDocument();
    expect(api).toHaveBeenCalledWith('/courses/c1/sessions');
  });
});
