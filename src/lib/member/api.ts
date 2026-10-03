/* 會員中心 API 接縫。Task 17：8 個 getter 換成真後端資料；Task 9：getSchedule 換成真
 * 後端資料(GET /schedule/me，見 integration-contract.md §3.18)；Task 13：getReports
 * 換成真後端資料(GET /report-cards/me + GET /certificates/me，見 §3.22)；Task 14：
 * getPoints 的 rewards 換成真後端資料(GET /rewards，見 §3.23)。回傳「形狀」盡量
 * 維持不變，頁面不用重寫樣板。 */
import { api } from '$lib/api/client';
import { fmtRatio } from '$lib/format';
import { listCourses, listCoaches } from '$lib/public/api';
import { toCatalogCourse, ntd, orderItemsSummary, type CatalogCourse } from '$lib/public/adapters';
import { COURSE_LEVEL_LABEL } from '$lib/domain/course-level';
import { orderStatusBadge, BRAND_PRIMARY_HEX, orderIdentity, isoDate, hhmm } from '$lib/api/wire';
import type {
  AttendanceEntryResponse,
  CertificateResponse,
  MemberReportResponse,
  MyEnrolmentResponse,
  MyScheduleEntryResponse,
  OrderListResponse,
  OrderSummary,
  ReportCardResponse,
  RewardListResponse,
  RewardResponse
} from '$lib/api/generated';
import { refreshPoints } from './stores';
import { UPCOMING, ANNOUNCE } from './data';
import type { UpcomingClass, Announcement, ScheduleBlock, Order } from './data';
import { STATS, SKILLS } from '$lib/domain/member-app';
import type { Stat, Skill, EnrolledCourse, AttRecord } from '$lib/domain/member-app';

export interface DashboardData {
  stats: Stat[];
  skills: Skill[];
  upcoming: UpcomingClass[];
  announce: Announcement[];
  nextClass: string; // banner「下一堂課」— 進接縫(原為 markup 硬編)
}

/** GET /enrolments/me 是純陣列、新到舊；member 端只認 active —— cancelled 不算「已
 *  報名」（同 stores.ts 的 refreshSubscriptions 對 subscription status 的處理）。 */
async function activeEnrolments(): Promise<MyEnrolmentResponse[]> {
  const list = await api<MyEnrolmentResponse[]>('/enrolments/me');
  return list.filter((e) => e.status === 'active');
}

/** 儀表板 — nextClass 來自最新一筆有效報名的 schedule_text（沒有報名則空字串）；
 *  技巧卡 track badge 後端無對應資料，R16 Task 2c 起拿掉。stats 三卡(報名課程數/本月出席率/會員點數)
 *  改接 GET /reports/me(經 getReportStats() 映射,§3.24)——只換 value,icon/tint/
 *  color/label 沿用既有 STATS 版型；attendanceRate 為 null(無點名資料,裁決 3)
 *  顯示「—」,不是 0%(0% 會誤導成「有資料、出席率為零」)。skills/upcoming/announce
 *  不在本次映射範圍內(無後端資料源、頁面也不直接讀 store),沿用 mock。
 *  R14(候選 F3):不再順手水合任何共享 store——首頁沒有讀點數的地方,通知改由 layout
 *  暖機(見 $lib/store-warm)。 */
export const getDashboard = async (): Promise<DashboardData> => {
  const [active, stats] = await Promise.all([activeEnrolments(), getReportStats()]);
  return {
    stats: [
      { ...STATS[0], value: String(stats.activeEnrolments) },
      { ...STATS[1], value: fmtRatio(stats.attendanceRate, '—') },
      { ...STATS[2], value: stats.pointsBalance.toLocaleString('en-US') }
    ],
    skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
    nextClass: active[0]?.schedule_text ?? ''
  };
};

export interface ReportCard {
  id: string;
  courseName: string;
  termLabel: string;
  comment: string | null;
  rating: number | null;
  issuerName: string;
  createdAt: string;
}

export interface Certificate {
  id: string;
  title: string;
  level: string | null;
  courseName: string | null;
  issuedOn: string;
  note: string | null;
  createdAt: string;
}

function mapReportCard(r: ReportCardResponse): ReportCard {
  return {
    id: r.id,
    courseName: r.course_name,
    termLabel: r.term_label,
    comment: r.comment,
    rating: r.rating,
    issuerName: r.created_by_name,
    createdAt: r.created_at
  };
}

function mapCertificate(c: CertificateResponse): Certificate {
  return {
    id: c.id,
    title: c.title,
    level: c.level,
    courseName: c.course_name,
    issuedOn: c.issued_on,
    note: c.note,
    createdAt: c.created_at
  };
}

export interface MemberReportStats {
  attendedTotal: number;
  attendanceRate: number | null; // null = 無出勤資料(裁決 3)，非 0
  pointsBalance: number;
  activeEnrolments: number;
  upcomingSessions7d: number;
}

function mapReportStats(s: MemberReportResponse): MemberReportStats {
  return {
    attendedTotal: s.attended_total,
    attendanceRate: s.attendance_rate,
    pointsBalance: s.points_balance,
    activeEnrolments: s.active_enrolments,
    upcomingSessions7d: s.upcoming_sessions_7d
  };
}

/** GET /reports/me 統計欄位(§3.24)——member 桌面 getDashboard() 與 mobile
 *  getMine() 共用同一支端點，不透過下面的 getReports()(那支順帶抓 report-cards/
 *  certificates，兩處都用不到)。 */
export const getReportStats = async (): Promise<MemberReportStats> => {
  const stats = await api<MemberReportResponse>('/reports/me');
  return mapReportStats(stats);
};

export interface ReportsData {
  reportCards: ReportCard[];
  certificates: Certificate[];
  stats: MemberReportStats;
}

/** GET /report-cards/me + GET /certificates/me（純陣列，不分頁，新到舊，見 §3.22）+
 *  GET /reports/me（統計欄位，見 §3.24）——三者互不相依，平行拉取。成績單/證書 v1 純
 *  metadata，無 PDF/檔案欄位(Task 13 既有邏輯，本次未變動)；stats 是本任務新增的統計
 *  彙總(出席次數/出席率/點數餘額/有效報名/未來 7 天場次)。 */
export const getReports = async (): Promise<ReportsData> => {
  const [reportCards, certificates, stats] = await Promise.all([
    api<ReportCardResponse[]>('/report-cards/me'),
    api<CertificateResponse[]>('/certificates/me'),
    getReportStats()
  ]);
  return {
    reportCards: reportCards.map(mapReportCard),
    certificates: certificates.map(mapCertificate),
    stats
  };
};

export interface ScheduleData { schedule: ScheduleBlock[]; }

/** day_of_week(後端 0=Sun..6=Sat，PostgreSQL EXTRACT(DOW) / JS Date.getDay() 慣例)→ ScheduleBlock.day(既有 UI 週欄位索引 0=Mon..6=Sun，
 *  即 WEEK[0]='一'…WEEK[6]='日'；見 +page.svelte 的 colOf 慣例與 SCHEDULE mock 的既有
 *  day 用法)。 */
const DOW_TO_SCHEDULE_DAY = [6, 0, 1, 2, 3, 4, 5];

/** MyScheduleEntryResponse（§3.18；與 GET /schedule 場館時段行事曆 §3.6 是不同資源，
 *  §3.18 裁決 1）→ 既有 ScheduleBlock 形狀。coach_name 為 null(尚未指定教練)
 *  /venue 為 null(無場地資料)時一律給空字串；color/tone 無對應後端欄位，一律給預設
 *  主色(P2，後端無品牌色欄位時的預設慣例)。 */
function mapScheduleEntry(e: MyScheduleEntryResponse): ScheduleBlock {
  return {
    day: DOW_TO_SCHEDULE_DAY[e.day_of_week],
    start: hhmm(e.start_time),
    end: hhmm(e.end_time),
    name: e.course_name,
    room: e.venue ?? '', // P2: 無場地資料
    coach: e.coach_name ?? '', // 尚未指定教練
    color: BRAND_PRIMARY_HEX, // P2: 後端無區塊顏色欄位
    tone: 'primary' // P2: 同上
  };
}

/** GET /schedule/me — 回呼叫者 active enrolments 對應課程的週模式(§3.18)。 */
export const getSchedule = async (): Promise<ScheduleData> => {
  const entries = await api<MyScheduleEntryResponse[]>('/schedule/me');
  return { schedule: entries.map(mapScheduleEntry) };
};

export interface MineData {
  courses: EnrolledCourse[];
}

/** GET /enrolments/me → EnrolledCourse。enrolment 不含課程分類/教練/教室，R16 Task 2c
 *  起這三欄從 EnrolledCourse 拿掉；icon/color 也沒有，給裝飾用預設值(icon 沿用 Task 14
 *  adapter 對「無 icon 欄位」的處理慣例：'sparkles')。
 *
 *  Task 10：attended/total 為真值(§3.19 即時計算——attended 為標記 present 的筆數、
 *  total 為已點名的場次數，尚未點名的場次不計入；無點名紀錄時兩者皆為 0)；att(出席率
 *  百分比)由兩者相除而來，total 為 0 時併為 0 避免除以零，也維持與 attended/total 的
 *  數字一致(不會出現「0% 但 23/24 堂」這種自相矛盾的顯示)。
 *  下一堂/學期/剩餘堂數後端無對應欄位(下一堂需逐課 GET /courses/{id}/sessions 推導，
 *  未做)，R16 Task 2c 起從 EnrolledCourse 拿掉，不再給空字串/0 佔位。
 *
 *  R15(候選 F2)：只打自己的路徑(GET /enrolments/me)，不再順手 hydrate waitlist/
 *  leaveRequests store——那是呼叫端(member/mine、mobile mine)自己讀的 store,暖不
 *  暖、暖哪些是頁面自己的決定,不該焊在這支 getter 裡(見 member/mine/+page.svelte 的
 *  gate.fetch，暖機與這裡的主 GET 並行同時出發)。 */
export const getMine = async (): Promise<MineData> => {
  const active = await activeEnrolments();
  const courses: EnrolledCourse[] = active.map((e) => ({
    id: e.id,
    course_id: e.course_id, // Task 11：請假入口需要課程 id 呼叫 GET /courses/{id}/sessions
    name: e.course_name,
    level: COURSE_LEVEL_LABEL[e.course_level] ?? e.course_level,
    icon: 'sparkles',
    color: BRAND_PRIMARY_HEX,
    schedule: e.schedule_text ?? '',
    att: e.total > 0 ? Math.round((e.attended / e.total) * 100) : 0,
    attended: e.attended,
    total: e.total
  }));
  return { courses };
};

/** AttendanceEntryResponse（§3.12）的 status 是後端封閉 enum AttendanceStatus，與
 *  AttRecord.state 同一組字面值，映射時直接指派、不需要 cast 或查表。
 *  session_date("YYYY-MM-DD") → AttRecord.date("MM/DD") + AttRecord.year("YYYY")，
 *  對齊既有 AttRecord 形狀(原 ATT_HISTORY mock 同一種日期格式)。 */
function mapAttendanceEntry(e: AttendanceEntryResponse): AttRecord {
  return { date: e.session_date.slice(5).replace('-', '/'), year: e.session_date.slice(0, 4), state: e.status };
}

/** GET /enrolments/{id}/attendance（Task F7；integration-contract.md §3.12）——這筆
 *  報名的逐堂出勤紀錄，只回已點名場次、依 session_date(次要鍵 start_time)舊到新
 *  排序(後端保證，這裡不重新排序)。無點名紀錄回空陣列(不是 404)。Ownership gate：
 *  非本人呼叫一律 404(刻意遮蔽存在性，與 cancel 的 403 不同)——呼叫端(desktop mine
 *  頁、mobile MyCourseDetail)只會傳自己 active enrolments 的 id，不會踩到這個情況。 */
export const getEnrolmentAttendance = async (id: string): Promise<AttRecord[]> => {
  const entries = await api<AttendanceEntryResponse[]>(`/enrolments/${id}/attendance`);
  return entries.map(mapAttendanceEntry);
};

export interface AccountData {
  orders: Order[];
  ordersTotal: number;
}

/** OrderSummary 現含 items 摘要(見 integration-contract.md §3.10：`{ name, quantity }[]`，
 *  name 是下單當時的快照)；item 欄由 orderItemsSummary 組成(與 admin/api.ts
 *  mapAdminOrder 共用同一份措辭，見 public/adapters.ts)。 */
function mapOrder(o: OrderSummary): Order {
  return {
    id: orderIdentity(o).display,
    item: orderItemsSummary(o.items, `訂單 ${o.order_number}`),
    amount: ntd(o.total_cents),
    status: orderStatusBadge(o.status),
    date: isoDate(o.created_at)
  };
}

/** GET /orders/me?per_page=100。per_page=100 顯式帶滿單頁上限(同 coach/api.ts
 *  getPendingLeaveRequests 的既有慣例)——後端預設 per_page=20 會把訂單較多的會員
 *  截斷成只看到最近 20 筆；ordersTotal 另外回傳真正的總筆數，讓呼叫端(mobile 帳戶頁/
 *  OrdersScreen)顯示的「N 筆報名紀錄」不會被這個截斷誤導成 20。
 *
 *  R15(候選 F2)：只打自己的路徑，不再等會員資料水合(hydrateSelfAccount)、也不再順手
 *  hydrate points/subscriptions store——那些是帳戶頁自己讀的 store/資料，暖不暖、
 *  暖哪些是頁面自己的決定(見 member/account/+page.svelte、mobile/account/
 *  +page.svelte 的 gate.fetch，兩處清單不同：桌面暖點數＋訂閱，行動版只暖點數)。 */
export const getAccount = async (): Promise<AccountData> => {
  const orderList = await api<OrderListResponse>('/orders/me?per_page=100');
  return {
    orders: orderList.orders.map(mapOrder),
    ordersTotal: orderList.total
  };
};

export interface CoursesData { catalog: CatalogCourse[]; }

/** 復用 Task 14 的 public seam($lib/public/api + $lib/public/adapters)，不重新
 *  實作課程/教練 join 邏輯 —— 跟行銷版課程介紹頁(src/routes/courses/+page.svelte)
 *  同一套作法：courses + coaches 平行拉、以 coach_id 對照出教練姓名，兩處都取
 *  CoachResponse.name(教練真實姓名，非 title 職稱 —— 見 integration-contract.md §3.4)。 */
export const getCourses = async (): Promise<CoursesData> => {
  const [apiCourses, apiCoaches] = await Promise.all([listCourses(), listCoaches()]);
  const coachNameById = new Map(apiCoaches.map((c) => [c.id, c.name]));
  const catalog = apiCourses.map((c) =>
    toCatalogCourse(c, c.coach_id ? coachNameById.get(c.coach_id) : undefined)
  );
  return { catalog };
};

/** 點數兌換品項(Task 14；integration-contract.md §3.23)。is_active/display_order
 *  不進 UI 形狀——member 端 GET /rewards 已經只回 is_active 品項、且依 display_order
 *  排序，前端不用再過濾/排序一次(見 mapReward)。 */
export interface Reward {
  id: string;
  name: string;
  description: string | null;
  pointsCost: number;
  stock: number | null; // null = 不限量；0 = 已兌換完畢
}

function mapReward(r: RewardResponse): Reward {
  return { id: r.id, name: r.name, description: r.description, pointsCost: r.points_cost, stock: r.stock };
}

export interface PointsData {
  rewards: Reward[];  // GET /rewards（member 僅 is_active，依 display_order 排序，見 §3.23）
  expiring: string;   // 原 markup 硬編「360 點」(即將到期) —— 後端無點數到期排程，沿用 mock
  expiryDate: string; // 原 markup 硬編「2026/12/31」(到期日) —— 同上
}

/** 餘額/明細真正的顯示由 points/pointsLedger store 負責(頁面直接讀 store，見
 *  stores.ts 的 refreshPoints)；兌換品項目錄(GET /rewards)則是這裡唯一的真資料
 *  來源——兩個端點互不相依，平行拉取。兌換動作本身(POST /rewards/{id}/redeem)
 *  在 stores.ts 的 redeemReward()，不在這裡(那是「動作」不是「取資料映射」，
 *  同 checkout 的 placeOrder 慣例留在 stores.ts)。 */
export const getPoints = async (): Promise<PointsData> => {
  const [rewardsRes] = await Promise.all([api<RewardListResponse>('/rewards'), refreshPoints()]);
  return { rewards: rewardsRes.rewards.map(mapReward), expiring: '360 點', expiryDate: '2026/12/31' };
};
