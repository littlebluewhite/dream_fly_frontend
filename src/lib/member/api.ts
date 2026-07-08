/* 會員中心 API 接縫。Task 17：8 個 getter 換成真後端資料；Task 9：getSchedule 換成真
 * 後端資料(GET /schedule/me，見 integration-contract.md §3.18)；Task 13：getReports
 * 換成真後端資料(GET /report-cards/me + GET /certificates/me，見 §3.22)；Task 14：
 * getPoints 的 rewards 換成真後端資料(GET /rewards，見 §3.23)。回傳「形狀」盡量
 * 維持不變，頁面不用重寫樣板。 */
import { get } from 'svelte/store';
import { api } from '$lib/api/client';
import { listCourses, listCoaches } from '$lib/public/api';
import { toCatalogCourse, ntd, orderItemsSummary, type CatalogCourse } from '$lib/public/adapters';
import { COURSE_LEVEL_LABEL } from '$lib/domain/course-level';
import { orderStatusBadge, initialOf, BRAND_PRIMARY_HEX } from '$lib/api/wire';
import type { ApiPage, ApiReportCard, ApiCertificate } from '$lib/api/wire';
import { refreshPoints, refreshSubscriptions, refreshNotifications, points } from './stores';
import { ME, STATS, SKILLS, UPCOMING, ANNOUNCE, mapNotification } from './data';
import type { Member, Stat, Skill, UpcomingClass, Announcement, EnrolledCourse, AttRecord, ScheduleBlock, Order, Notification, ApiNotification } from './data';

/** 「會員本人」單一內部來源;未來 fetch 只改此處。 */
const me = (): Member => ME;

export interface DashboardData {
  me: Member;
  stats: Stat[];
  skills: Skill[];
  upcoming: UpcomingClass[];
  announce: Announcement[];
  nextClass: string; // banner「下一堂課」— 進接縫(原為 markup 硬編)
  track: string;     // 技巧卡 track badge — 進接縫(原為 markup 硬編)
}

interface ApiEnrolment {
  id: string;
  course_id: string;
  course_name: string;
  course_level: string;
  schedule_text: string | null;
  status: string;
  enrolled_at: string;
  attended: number;
  total: number;
}

/** GET /enrolments/me 是純陣列、新到舊；member 端只認 active —— cancelled 不算「已
 *  報名」（同 stores.ts 的 refreshSubscriptions 對 subscription status 的處理）。 */
async function activeEnrolments(): Promise<ApiEnrolment[]> {
  const list = await api<ApiEnrolment[]>('/enrolments/me');
  return list.filter((e) => e.status === 'active');
}

/** 儀表板 — nextClass 來自最新一筆有效報名的 schedule_text（沒有報名則空字串）；
 *  track 後端無對應資料，一律空字串。stats 三卡(報名課程數/本月出席率/會員點數)
 *  改接 GET /reports/me(經 getReportStats() 映射,§3.24)——只換 value,icon/tint/
 *  color/label 沿用既有 STATS 版型；attendanceRate 為 null(無點名資料,裁決 3)
 *  顯示「—」,不是 0%(0% 會誤導成「有資料、出席率為零」)。skills/upcoming/announce
 *  不在本次映射範圍內(無後端資料源、頁面也不直接讀 store),沿用 mock。
 *  順手 refresh points/notifications store —— 這是會員登入後第一個會進的頁面，
 *  讓 Topbar/Sidebar 的未讀角標、CheckoutDialog 的 $points 一開始就是真資料，不用
 *  等使用者先逛過點數頁/通知頁才 hydrate。這兩支只是「順便」，失敗不影響 dashboard
 *  本身能否顯示，所以用 allSettled、只記錄錯誤（同 stores.ts 的 placeOrder() 對
 *  post-checkout hydrate 失敗的處理方式）。 */
export const getDashboard = async (): Promise<DashboardData> => {
  const [active, stats] = await Promise.all([activeEnrolments(), getReportStats()]);
  const [pointsResult, notifResult] = await Promise.allSettled([refreshPoints(), refreshNotifications()]);
  if (pointsResult.status === 'rejected') console.error('getDashboard: 點數 hydrate 失敗', pointsResult.reason);
  if (notifResult.status === 'rejected') console.error('getDashboard: 通知 hydrate 失敗', notifResult.reason);
  return {
    me: me(),
    stats: [
      { ...STATS[0], value: String(stats.activeEnrolments) },
      { ...STATS[1], value: stats.attendanceRate == null ? '—' : `${Math.round(stats.attendanceRate * 100)}%` },
      { ...STATS[2], value: stats.pointsBalance.toLocaleString('en-US') }
    ],
    skills: SKILLS, upcoming: UPCOMING, announce: ANNOUNCE,
    nextClass: active[0]?.schedule_text ?? '',
    track: ''
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

function mapReportCard(r: ApiReportCard): ReportCard {
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

function mapCertificate(c: ApiCertificate): Certificate {
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

/** GET /reports/me 回應（integration-contract.md §3.24）。 */
interface ApiMemberReportStats {
  attended_total: number;
  attendance_rate: number | null;
  points_balance: number;
  active_enrolments: number;
  upcoming_sessions_7d: number;
}

export interface MemberReportStats {
  attendedTotal: number;
  attendanceRate: number | null; // null = 無出勤資料(裁決 3)，非 0
  pointsBalance: number;
  activeEnrolments: number;
  upcomingSessions7d: number;
}

function mapReportStats(s: ApiMemberReportStats): MemberReportStats {
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
  const stats = await api<ApiMemberReportStats>('/reports/me');
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
    api<ApiReportCard[]>('/report-cards/me'),
    api<ApiCertificate[]>('/certificates/me'),
    getReportStats()
  ]);
  return {
    reportCards: reportCards.map(mapReportCard),
    certificates: certificates.map(mapCertificate),
    stats
  };
};

export interface ScheduleData { schedule: ScheduleBlock[]; }

/** MyScheduleEntryResponse（integration-contract.md §3.18）。與 GET /schedule(場館時段
 *  行事曆，§3.6)是完全不同的資源(§3.18 裁決 1)——這裡是呼叫者 active enrolments 對應
 *  課程的週模式,不物化、不查日期範圍。 */
interface ApiScheduleEntry {
  course_id: string;
  course_name: string;
  coach_name: string | null;
  day_of_week: number; // 0=Sun..6=Sat（PostgreSQL EXTRACT(DOW) / JS Date.getDay() 慣例）
  start_time: string; // "HH:MM:SS"
  end_time: string;
  venue: string | null;
}

/** day_of_week(後端 0=Sun..6=Sat)→ ScheduleBlock.day(既有 UI 週欄位索引 0=Mon..6=Sun，
 *  即 WEEK[0]='一'…WEEK[6]='日'；見 +page.svelte 的 colOf 慣例與 SCHEDULE mock 的既有
 *  day 用法)。 */
const DOW_TO_SCHEDULE_DAY = [6, 0, 1, 2, 3, 4, 5];

/** MyScheduleEntryResponse → 既有 ScheduleBlock 形狀。coach_name 為 null(尚未指定教練)
 *  /venue 為 null(無場地資料)時一律給空字串；color/tone 無對應後端欄位，一律給預設
 *  主色(P2，同 mapProfile 對「無品牌色」欄位的預設慣例)。 */
function mapScheduleEntry(e: ApiScheduleEntry): ScheduleBlock {
  return {
    day: DOW_TO_SCHEDULE_DAY[e.day_of_week],
    start: e.start_time.slice(0, 5),
    end: e.end_time.slice(0, 5),
    name: e.course_name,
    room: e.venue ?? '', // P2: 無場地資料
    coach: e.coach_name ?? '', // 尚未指定教練
    color: BRAND_PRIMARY_HEX, // P2: 後端無區塊顏色欄位
    tone: 'primary' // P2: 同上
  };
}

/** GET /schedule/me — 回呼叫者 active enrolments 對應課程的週模式(§3.18)。 */
export const getSchedule = async (): Promise<ScheduleData> => {
  const entries = await api<ApiScheduleEntry[]>('/schedule/me');
  return { schedule: entries.map(mapScheduleEntry) };
};

export interface MineData {
  courses: EnrolledCourse[];
}

/** GET /enrolments/me → EnrolledCourse。cat/coach/room 後端沒有對應欄位(enrolment
 *  不含課程分類/教練/教室)，icon/color 也沒有，一律給合理預設值(icon 沿用 Task 14
 *  adapter 對「無 icon 欄位」的處理慣例：'sparkles')。
 *
 *  Task 10：attended/total 為真值(§3.19 即時計算——attended 為標記 present 的筆數、
 *  total 為已點名的場次數，尚未點名的場次不計入；無點名紀錄時兩者皆為 0)；att(出席率
 *  百分比)由兩者相除而來，total 為 0 時併為 0 避免除以零，也維持與 attended/total 的
 *  數字一致(不會出現「0% 但 23/24 堂」這種自相矛盾的顯示)。
 *  // P2: next(下一堂)——GET /courses/{id}/sessions 可依「依 session_date, start_time
 *  排序」的第一筆推導最近未來場次，但需要每堂已報名課程各呼叫一次、且要另外處理
 *  「明日/週X」相對日期格式化與 studio_timezone 牆鐘語意(§3.18 裁決 2)；盤點 UI 用途
 *  後(僅 member/mine/+page.svelte 一個「下一堂」KPI 小卡使用，非核心流程)，維持誠實
 *  空字串預設，暫不推導。
 *  // P2: term/remain(學期/剩餘堂數)——後端無對應欄位，一律沿用預設值。 */
export const getMine = async (): Promise<MineData> => {
  const active = await activeEnrolments();
  const courses: EnrolledCourse[] = active.map((e) => ({
    id: e.id,
    course_id: e.course_id, // Task 11：請假入口需要課程 id 呼叫 GET /courses/{id}/sessions
    name: e.course_name,
    cat: '',
    level: COURSE_LEVEL_LABEL[e.course_level] ?? e.course_level,
    coach: '',
    icon: 'sparkles',
    color: BRAND_PRIMARY_HEX,
    schedule: e.schedule_text ?? '',
    room: '',
    att: e.total > 0 ? Math.round((e.attended / e.total) * 100) : 0,
    attended: e.attended,
    total: e.total,
    next: '', // P2: 見上方註解
    term: '',
    remain: 0
  }));
  return { courses };
};

/** GET /enrolments/{id}/attendance 回應（integration-contract.md §3.12）。status 直接
 *  宣告為窄化 union（非後端原始 string）——與 AttRecord.state 同一組字面值，映射時
 *  可以直接指派、不需要 cast 或查表。 */
interface ApiAttendanceEntry {
  session_date: string; // "YYYY-MM-DD"
  start_time: string;
  end_time: string;
  status: 'present' | 'absent' | 'leave';
  marked_at: string;
}

/** session_date("YYYY-MM-DD") → AttRecord.date("MM/DD")，對齊既有 AttRecord 形狀
 *  (原 ATT_HISTORY mock 同一種日期格式)。 */
function mapAttendanceEntry(e: ApiAttendanceEntry): AttRecord {
  return { date: e.session_date.slice(5).replace('-', '/'), state: e.status };
}

/** GET /enrolments/{id}/attendance（Task F7；integration-contract.md §3.12）——這筆
 *  報名的逐堂出勤紀錄，只回已點名場次、依 session_date(次要鍵 start_time)舊到新
 *  排序(後端保證，這裡不重新排序)。無點名紀錄回空陣列(不是 404)。Ownership gate：
 *  非本人呼叫一律 404(刻意遮蔽存在性，與 cancel 的 403 不同)——呼叫端(desktop mine
 *  頁、mobile MyCourseDetail)只會傳自己 active enrolments 的 id，不會踩到這個情況。 */
export const getEnrolmentAttendance = async (id: string): Promise<AttRecord[]> => {
  const entries = await api<ApiAttendanceEntry[]>(`/enrolments/${id}/attendance`);
  return entries.map(mapAttendanceEntry);
};

export interface AccountProfile extends Member {
  birth: string;
  phone: string;
  email: string;
  guardian: string;
  remind: boolean;
  promo: boolean;
}

export interface AccountData {
  orders: Order[];
  profile: AccountProfile;
}

interface ApiUser {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  created_at: string;
}

interface ApiOrderSummary {
  id: string;
  order_number: string;
  status: string;
  total_cents: number;
  created_at: string;
  items: { name: string; quantity: number }[];
}

type ApiOrderListResponse = ApiPage<'orders', ApiOrderSummary>;

/** OrderSummary 現含 items 摘要(見 integration-contract.md §3.10：`{ name, quantity }[]`，
 *  name 是下單當時的快照)；item 欄由 orderItemsSummary 組成(與 admin/api.ts
 *  mapAdminOrder 共用同一份措辭，見 public/adapters.ts)。 */
function mapOrder(o: ApiOrderSummary): Order {
  return {
    id: o.order_number,
    item: orderItemsSummary(o.items, `訂單 ${o.order_number}`),
    amount: ntd(o.total_cents),
    status: orderStatusBadge(o.status),
    date: o.created_at.slice(0, 10)
  };
}

/** UserResponse 沒有「會員編號 / 大頭貼色 / 生日 / 年齡 / 監護人 / 通知偏好」這些
 *  欄位 —— initial 由姓名首字推導，其餘(color/age/birth/guardian/remind/promo)沿用
 *  合理預設值(ProfileEditDialog 本來就只做本地端編輯、不寫回後端，非本次範圍)。
 *  id 直接採用後端真實 uuid(沒有 mock 那種「GY2024001」會員編號可用)。points 借用
 *  剛 refresh 過的 points store 當下值(帳戶頁本身讀 $points，不讀這個欄位，純粹
 *  求型別完整、內容誠實)。 */
function mapProfile(u: ApiUser): AccountProfile {
  return {
    name: u.name,
    initial: initialOf(u.name),
    color: BRAND_PRIMARY_HEX,
    id: u.id,
    since: u.created_at.slice(0, 7).replace('-', '/'),
    points: get(points),
    age: 0,
    birth: '',
    phone: u.phone ?? '',
    email: u.email,
    guardian: '',
    remind: true,
    promo: false
  };
}

/** GET /users/me + GET /orders/me；順手 refresh points/subscriptions —— 帳戶頁直接
 *  讀 $points / $subscriptions store(不是這裡的回傳值)。主資料(profile+orders)
 *  fail-hard(Promise.all)；側效 hydrate 則 best-effort(allSettled、失敗只記錄，
 *  同 getDashboard 模式)——主資料都到手了，不該因為側效暫時失敗把整頁打成 error，
 *  store 保留前值仍可正常顯示。 */
export const getAccount = async (): Promise<AccountData> => {
  const [user, orderList] = await Promise.all([
    api<ApiUser>('/users/me'),
    api<ApiOrderListResponse>('/orders/me')
  ]);
  const [pointsResult, subsResult] = await Promise.allSettled([refreshPoints(), refreshSubscriptions()]);
  if (pointsResult.status === 'rejected') console.error('getAccount: 點數 hydrate 失敗', pointsResult.reason);
  if (subsResult.status === 'rejected') console.error('getAccount: 訂閱 hydrate 失敗', subsResult.reason);
  return {
    orders: orderList.orders.map(mapOrder),
    profile: mapProfile(user)
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

interface ApiReward {
  id: string;
  name: string;
  description: string | null;
  points_cost: number;
  stock: number | null;
  is_active: boolean;
  display_order: number;
}

interface ApiRewardListResponse {
  rewards: ApiReward[];
}

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

function mapReward(r: ApiReward): Reward {
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
  const [rewardsRes] = await Promise.all([api<ApiRewardListResponse>('/rewards'), refreshPoints()]);
  return { rewards: rewardsRes.rewards.map(mapReward), expiring: '360 點', expiryDate: '2026/12/31' };
};

/** 通知中心 feed(store-getter，非包物件)。GET /notifications 是純陣列(吃 page/
 *  per_page 但沒有分頁包裝)；type→cat/icon/tone 對照表在 data.ts 的 mapNotification
 *  (跟 stores.ts 的 refreshNotifications 共用同一份對照表)。 */
export const getNotifications = async (): Promise<Notification[]> => {
  const list = await api<ApiNotification[]>('/notifications');
  return list.map(mapNotification);
};
