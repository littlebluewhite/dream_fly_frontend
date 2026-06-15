/* Dream Fly — 管理後台 · shared data, types + derivations
 * Ported from the admin handoff source (docs/design/admin/data.jsx). The React
 * source enriches base arrays by mutation (forEach); here we translate that to
 * immutable `.map((x,i) => ({...x, derived}))` so the exported arrays are fully
 * materialised and strictly typed (a missing derivation is a compile error). */

/* ───────────────────────── unions ───────────────────────── */
export type Tone =
	| 'primary'
	| 'accent'
	| 'success'
	| 'warning'
	| 'error'
	| 'info'
	| 'neutral';

export type MemberStatus = 'active' | 'warning' | 'paused';
export type PayStatus = 'paid' | 'due' | 'trial';
export type OrderStatus = 'paid' | 'pending' | 'refunded';
export type AttMark = 'p' | 'a' | 'l' | 'v';
export type TicketType = 'pass' | 'trial' | 'event';
export type VenueStatus = 'available' | 'maintenance';
export type Level = '啟蒙' | '入門' | '基礎' | '進階' | '選手';
export type ClassStatus = '招生中' | '候補' | '額滿';
export type CoachStatus = 'online' | 'busy' | 'offline';
export type TodayState = 'done' | 'prep' | 'live' | 'soon' | 'wait';

/* ───────────────────────── coaches ───────────────────────── */
export interface Coach {
	id: string;
	name: string;
	initial: string;
	title: string;
	color: string;
	tags: string[];
	years: number;
	students: number;
	awards: number;
	classes: number;
	status: CoachStatus;
	phone: string;
}

export const COACHES: Coach[] = [
	{ id: 'c1', name: '林雅婷', initial: '林', title: '資深競技體操教練 · 國家級認證', color: '#0066CC', tags: ['競技啦啦隊', '競技體操'], years: 12, students: 86, awards: 9, classes: 5, status: 'online', phone: '0912-345-678' },
	{ id: 'c2', name: '陳冠宇', initial: '陳', title: '兒童體操主教練 · 體操C級教練', color: '#0EA5E9', tags: ['兒童基礎', '幼兒體操'], years: 8, students: 64, awards: 3, classes: 4, status: 'online', phone: '0922-118-220' },
	{ id: 'c3', name: '黃詩涵', initial: '黃', title: '幼兒啟蒙教練 · 幼兒體適能認證', color: '#10B981', tags: ['幼兒體操', '親子課'], years: 5, students: 48, awards: 1, classes: 3, status: 'busy', phone: '0933-554-117' },
	{ id: 'c4', name: '王思齊', initial: '王', title: '跑酷與成人體操教練', color: '#F59E0B', tags: ['跑酷', '成人體操'], years: 7, students: 39, awards: 2, classes: 3, status: 'offline', phone: '0955-882-031' },
	{ id: 'c5', name: '張育誠', initial: '張', title: '競技啦啦隊助理教練', color: '#8B5CF6', tags: ['競技啦啦隊'], years: 4, students: 31, awards: 0, classes: 2, status: 'offline', phone: '0966-201-447' },
	{ id: 'c6', name: '周曉彤', initial: '周', title: '競技啦啦隊編排教練 · 啦啦隊 B 級', color: '#EC4899', tags: ['競技啦啦隊'], years: 6, students: 42, awards: 4, classes: 3, status: 'online', phone: '0977-114-258' },
	{ id: 'c7', name: '蘇建宏', initial: '蘇', title: '體能與跑酷專項教練 · 體適能C級', color: '#14B8A6', tags: ['跑酷', '成人體操'], years: 9, students: 53, awards: 5, classes: 4, status: 'busy', phone: '0988-336-470' },
	{ id: 'c8', name: '李孟潔', initial: '李', title: '幼兒啟蒙教練 · 幼兒體適能認證', color: '#0EA5E9', tags: ['幼兒體操', '親子課'], years: 6, students: 45, awards: 2, classes: 3, status: 'online', phone: '0912-556-330' },
	{ id: 'c9', name: '鄭凱文', initial: '鄭', title: '成人體操與體能教練 · 重訓專項', color: '#F59E0B', tags: ['成人體操', '跑酷'], years: 8, students: 41, awards: 3, classes: 3, status: 'busy', phone: '0921-667-441' }
];

/* ───────────────────────── classes ───────────────────────── */
interface ClassBase {
	id: string;
	name: string;
	level: Level;
	cat: string;
	coach: string;
	room: string;
	day: string;
	time: string;
	enrolled: number;
	cap: number;
	age: string;
	price: number;
	status: ClassStatus;
	wait: number;
	term: string;
	sessions: number;
}
export interface ClassRow extends ClassBase {
	startDate: string;
	checkinRate: number;
	makeup: number;
}

const CLASSES_BASE: ClassBase[] = [
	{ id: 'k1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', coach: '林雅婷', room: 'A 訓練館', day: '週二 / 週四', time: '19:00–20:30', enrolled: 11, cap: 12, age: '10–16 歲', price: 4800, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k2', name: '兒童基礎 B 班', level: '基礎', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週一 / 週三', time: '17:30–18:30', enrolled: 8, cap: 10, age: '7–9 歲', price: 3200, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k3', name: '幼兒體操 啟蒙班', level: '啟蒙', cat: '幼兒體操', coach: '黃詩涵', room: 'C 軟墊區', day: '週六', time: '10:00–11:00', enrolled: 6, cap: 8, age: '3–5 歲', price: 2800, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k4', name: '成人體操 基礎班', level: '基礎', cat: '成人體操', coach: '王思齊', room: 'A 訓練館', day: '週五', time: '20:00–21:30', enrolled: 9, cap: 12, age: '16 歲以上', price: 3600, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k5', name: '跑酷入門班', level: '入門', cat: '跑酷', coach: '王思齊', room: '戶外場', day: '週日', time: '15:00–16:30', enrolled: 7, cap: 10, age: '12 歲以上', price: 3400, status: '候補', wait: 2, term: '2026 春季', sessions: 12 },
	{ id: 'k6', name: '競技體操 選手班', level: '選手', cat: '競技體操', coach: '林雅婷', room: 'A 訓練館', day: '週二 / 週五', time: '17:00–19:00', enrolled: 12, cap: 12, age: '8–14 歲', price: 6200, status: '額滿', wait: 4, term: '2026 春季', sessions: 20 },
	{ id: 'k7', name: '親子體操 同樂班', level: '啟蒙', cat: '幼兒體操', coach: '黃詩涵', room: 'C 軟墊區', day: '週日', time: '10:00–11:00', enrolled: 5, cap: 8, age: '2–4 歲', price: 2600, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k8', name: '兒童基礎 A 班', level: '基礎', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週二 / 週四', time: '16:30–17:30', enrolled: 10, cap: 10, age: '7–9 歲', price: 3200, status: '額滿', wait: 3, term: '2026 春季', sessions: 16 },
	{ id: 'k9', name: '競技啦啦隊 基礎班', level: '基礎', cat: '競技啦啦隊', coach: '張育誠', room: 'A 訓練館', day: '週三 / 週六', time: '18:00–19:30', enrolled: 9, cap: 12, age: '8–12 歲', price: 4200, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k10', name: '幼兒體操 律動班', level: '啟蒙', cat: '幼兒體操', coach: '黃詩涵', room: 'C 軟墊區', day: '週三', time: '16:00–17:00', enrolled: 7, cap: 8, age: '3–5 歲', price: 2800, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k11', name: '成人體操 進階班', level: '進階', cat: '成人體操', coach: '王思齊', room: 'A 訓練館', day: '週四', time: '20:00–21:30', enrolled: 8, cap: 12, age: '16 歲以上', price: 3900, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k12', name: '競技體操 預備班', level: '進階', cat: '競技體操', coach: '林雅婷', room: 'A 訓練館', day: '週一 / 週四', time: '17:00–18:30', enrolled: 10, cap: 12, age: '7–12 歲', price: 5200, status: '招生中', wait: 0, term: '2026 春季', sessions: 18 },
	{ id: 'k13', name: '跑酷 進階班', level: '進階', cat: '跑酷', coach: '王思齊', room: '戶外場', day: '週六', time: '15:00–16:30', enrolled: 8, cap: 10, age: '14 歲以上', price: 3800, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k14', name: '兒童基礎 假日班', level: '基礎', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週日', time: '13:30–14:30', enrolled: 9, cap: 10, age: '7–9 歲', price: 3200, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k15', name: '競技啦啦隊 兒童班', level: '入門', cat: '競技啦啦隊', coach: '張育誠', room: 'A 訓練館', day: '週六', time: '16:00–17:30', enrolled: 11, cap: 12, age: '6–9 歲', price: 3800, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k16', name: '幼兒體操 親子探索', level: '啟蒙', cat: '幼兒體操', coach: '黃詩涵', room: 'C 軟墊區', day: '週日', time: '11:30–12:30', enrolled: 6, cap: 8, age: '2–4 歲', price: 2600, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k17', name: '幼兒體操 探索班', level: '啟蒙', cat: '幼兒體操', coach: '李孟潔', room: 'C 軟墊區', day: '週六', time: '09:00–10:00', enrolled: 7, cap: 8, age: '3–5 歲', price: 2800, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k18', name: '成人體適能 入門班', level: '入門', cat: '成人體操', coach: '鄭凱文', room: 'F 體能訓練室', day: '週二', time: '20:00–21:00', enrolled: 10, cap: 14, age: '16 歲以上', price: 3400, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k19', name: '競技啦啦隊 青少班', level: '進階', cat: '競技啦啦隊', coach: '周曉彤', room: 'A 訓練館', day: '週三 / 週五', time: '19:30–21:00', enrolled: 10, cap: 12, age: '13–17 歲', price: 5000, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k20', name: '兒童基礎 體驗班', level: '啟蒙', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週六', time: '14:00–15:00', enrolled: 6, cap: 10, age: '6–8 歲', price: 1800, status: '招生中', wait: 0, term: '2026 春季', sessions: 8 },
	{ id: 'k21', name: '跑酷 體能班', level: '基礎', cat: '跑酷', coach: '蘇建宏', room: '戶外場', day: '週四', time: '19:00–20:30', enrolled: 9, cap: 12, age: '12 歲以上', price: 3600, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k22', name: '競技體操 菁英班', level: '選手', cat: '競技體操', coach: '林雅婷', room: 'A 訓練館', day: '週三 / 週六', time: '19:00–21:00', enrolled: 11, cap: 12, age: '9–15 歲', price: 6800, status: '候補', wait: 3, term: '2026 春季', sessions: 20 }
];

export const CLASSES: ClassRow[] = CLASSES_BASE.map((k, i) => ({
	...k,
	startDate: '2026/03/' + String((i % 27) + 1).padStart(2, '0'),
	checkinRate: 86 + (i % 12),
	makeup: i % 3
}));

/* ───────────────────────── members ───────────────────────── */
interface MemberBase {
	id: string;
	name: string;
	initial: string;
	color: string;
	course: string;
	coach: string;
	att: number;
	status: MemberStatus;
	age: number;
	parent: string;
	phone: string;
	joined: string;
	points: number;
	pay: PayStatus;
	remain: number;
	lastSeen: string;
	recent: AttMark[];
	emName: string;
	emPhone: string;
}
export interface Member extends MemberBase {
	campus: string;
	source: string;
	birthday: string;
	tier: string;
	tierColor: string;
	renewDue: string;
	lineId: string;
}

const MEMBERS_BASE: MemberBase[] = [
	{ id: 'GY2024001', name: '王承恩', initial: '王', color: '#0066CC', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 98, status: 'active', age: 13, parent: '王先生', phone: '0911-222-333', joined: '2023/09', points: 420, pay: 'paid', remain: 14, lastSeen: '06/10', recent: ['p', 'p', 'p', 'l', 'p', 'p'], emName: '王媽媽', emPhone: '0911-222-330' },
	{ id: 'GY2024002', name: '李宥蓁', initial: '李', color: '#0EA5E9', course: '兒童基礎 B 班', coach: '陳冠宇', att: 92, status: 'active', age: 8, parent: '李太太', phone: '0922-333-444', joined: '2024/01', points: 260, pay: 'paid', remain: 9, lastSeen: '06/09', recent: ['p', 'p', 'p', 'p', 'a', 'p'], emName: '李先生', emPhone: '0922-333-440' },
	{ id: 'GY2024003', name: '張宇辰', initial: '張', color: '#10B981', course: '兒童基礎 B 班', coach: '陳冠宇', att: 76, status: 'warning', age: 9, parent: '張先生', phone: '0933-444-555', joined: '2024/02', points: 180, pay: 'due', remain: 3, lastSeen: '06/05', recent: ['p', 'a', 'p', 'a', 'a', 'p'], emName: '張媽媽', emPhone: '0933-444-550' },
	{ id: 'GY2024004', name: '林佳穎', initial: '林', color: '#F59E0B', course: '幼兒體操 啟蒙班', coach: '黃詩涵', att: 100, status: 'active', age: 4, parent: '林太太', phone: '0955-666-777', joined: '2024/03', points: 150, pay: 'paid', remain: 11, lastSeen: '06/08', recent: ['p', 'p', 'p', 'p', 'p', 'p'], emName: '林先生', emPhone: '0955-666-770' },
	{ id: 'GY2024005', name: '黃柏睿', initial: '黃', color: '#8B5CF6', course: '成人體操 基礎班', coach: '王思齊', att: 64, status: 'paused', age: 27, parent: '—', phone: '0966-777-888', joined: '2023/11', points: 310, pay: 'due', remain: 0, lastSeen: '05/20', recent: ['a', 'a', 'p', 'a', 'a', 'a'], emName: '緊急聯絡', emPhone: '0966-777-880' },
	{ id: 'GY2024006', name: '陳思妤', initial: '陳', color: '#EC4899', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 95, status: 'active', age: 14, parent: '陳先生', phone: '0911-888-999', joined: '2023/08', points: 488, pay: 'paid', remain: 16, lastSeen: '06/10', recent: ['p', 'p', 'p', 'p', 'p', 'l'], emName: '陳媽媽', emPhone: '0911-888-990' },
	{ id: 'GY2024007', name: '吳冠霖', initial: '吳', color: '#0066CC', course: '競技體操 選手班', coach: '林雅婷', att: 88, status: 'active', age: 11, parent: '吳太太', phone: '0922-101-202', joined: '2024/02', points: 360, pay: 'paid', remain: 12, lastSeen: '06/10', recent: ['p', 'p', 'l', 'p', 'p', 'p'], emName: '吳先生', emPhone: '0922-101-200' },
	{ id: 'GY2024008', name: '劉芷晴', initial: '劉', color: '#0EA5E9', course: '幼兒體操 啟蒙班', coach: '黃詩涵', att: 90, status: 'active', age: 5, parent: '劉太太', phone: '0933-303-404', joined: '2024/04', points: 120, pay: 'trial', remain: 2, lastSeen: '06/07', recent: ['p', 'p', 'p', 'v', 'p', 'p'], emName: '劉先生', emPhone: '0933-303-400' },
	{ id: 'GY2024009', name: '周哲瑋', initial: '周', color: '#10B981', course: '跑酷入門班', coach: '王思齊', att: 71, status: 'warning', age: 15, parent: '周先生', phone: '0955-505-606', joined: '2024/01', points: 200, pay: 'due', remain: 4, lastSeen: '06/02', recent: ['p', 'a', 'l', 'a', 'p', 'a'], emName: '周媽媽', emPhone: '0955-505-600' },
	{ id: 'GY2024010', name: '蔡昀軒', initial: '蔡', color: '#F59E0B', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 97, status: 'active', age: 12, parent: '蔡太太', phone: '0966-707-808', joined: '2023/10', points: 405, pay: 'paid', remain: 15, lastSeen: '06/10', recent: ['p', 'p', 'p', 'p', 'l', 'p'], emName: '蔡先生', emPhone: '0966-707-800' },
	{ id: 'GY2024011', name: '鄭宇翔', initial: '鄭', color: '#8B5CF6', course: '成人體操 基礎班', coach: '王思齊', att: 82, status: 'active', age: 31, parent: '—', phone: '0911-909-010', joined: '2024/03', points: 175, pay: 'paid', remain: 7, lastSeen: '06/06', recent: ['p', 'p', 'a', 'p', 'p', 'p'], emName: '緊急聯絡', emPhone: '0911-909-018' },
	{ id: 'GY2024012', name: '謝佩珊', initial: '謝', color: '#EC4899', course: '兒童基礎 B 班', coach: '陳冠宇', att: 86, status: 'active', age: 8, parent: '謝先生', phone: '0922-111-213', joined: '2024/02', points: 240, pay: 'paid', remain: 10, lastSeen: '06/09', recent: ['p', 'l', 'p', 'p', 'p', 'a'], emName: '謝媽媽', emPhone: '0922-111-210' },
	{ id: 'GY2024013', name: '許恩綺', initial: '許', color: '#10B981', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 80, status: 'active', age: 11, parent: '許太太', phone: '0933-220-114', joined: '2024/03', points: 215, pay: 'due', remain: 5, lastSeen: '06/03', recent: ['p', 'p', 'v', 'p', 'a', 'p'], emName: '許先生', emPhone: '0933-220-110' },
	{ id: 'GY2024014', name: '潘柏宏', initial: '潘', color: '#0EA5E9', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 84, status: 'active', age: 12, parent: '潘先生', phone: '0922-330-225', joined: '2024/02', points: 230, pay: 'paid', remain: 9, lastSeen: '06/10', recent: ['l', 'p', 'p', 'p', 'p', 'l'], emName: '潘媽媽', emPhone: '0922-330-220' },
	{ id: 'GY2024015', name: '曾子涵', initial: '曾', color: '#8B5CF6', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 93, status: 'active', age: 13, parent: '曾太太', phone: '0955-440-336', joined: '2023/12', points: 312, pay: 'paid', remain: 13, lastSeen: '06/10', recent: ['p', 'p', 'p', 'p', 'p', 'p'], emName: '曾先生', emPhone: '0955-440-330' },
	{ id: 'GY2024016', name: '葉珞晴', initial: '葉', color: '#EF4444', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 91, status: 'active', age: 10, parent: '葉先生', phone: '0966-550-447', joined: '2024/01', points: 198, pay: 'paid', remain: 11, lastSeen: '06/09', recent: ['p', 'p', 'a', 'p', 'p', 'p'], emName: '葉媽媽', emPhone: '0966-550-440' },
	{ id: 'GY2024017', name: '賴宥辰', initial: '賴', color: '#0066CC', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 68, status: 'warning', age: 11, parent: '賴太太', phone: '0911-660-558', joined: '2024/04', points: 95, pay: 'trial', remain: 1, lastSeen: '05/28', recent: ['a', 'a', 'p', 'a', 'l', 'a'], emName: '賴先生', emPhone: '0911-660-550' },
	{ id: 'GY2024018', name: '鐘語彤', initial: '鐘', color: '#F59E0B', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 96, status: 'active', age: 12, parent: '鐘先生', phone: '0922-770-669', joined: '2023/11', points: 358, pay: 'paid', remain: 14, lastSeen: '06/10', recent: ['p', 'p', 'p', 'l', 'p', 'p'], emName: '鐘媽媽', emPhone: '0922-770-660' },
	{ id: 'GY2024019', name: '邱柏勳', initial: '邱', color: '#10B981', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 89, status: 'active', age: 13, parent: '邱太太', phone: '0933-880-770', joined: '2024/02', points: 276, pay: 'paid', remain: 12, lastSeen: '06/10', recent: ['p', 'l', 'p', 'p', 'p', 'p'], emName: '邱先生', emPhone: '0933-880-778' },
	{ id: 'GY2024020', name: '馬欣妍', initial: '馬', color: '#EC4899', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 94, status: 'active', age: 11, parent: '馬先生', phone: '0955-990-881', joined: '2023/12', points: 333, pay: 'paid', remain: 13, lastSeen: '06/10', recent: ['p', 'p', 'p', 'p', 'a', 'p'], emName: '馬媽媽', emPhone: '0955-990-880' },
	{ id: 'GY2024021', name: '楊承翰', initial: '楊', color: '#14B8A6', course: '競技體操 選手班', coach: '林雅婷', att: 90, status: 'active', age: 10, parent: '楊太太', phone: '0966-100-992', joined: '2024/01', points: 290, pay: 'paid', remain: 12, lastSeen: '06/10', recent: ['p', 'p', 'p', 'l', 'p', 'p'], emName: '楊先生', emPhone: '0966-100-990' },
	{ id: 'GY2024022', name: '何宜蓁', initial: '何', color: '#0EA5E9', course: '兒童基礎 A 班', coach: '陳冠宇', att: 87, status: 'active', age: 8, parent: '何先生', phone: '0911-210-103', joined: '2024/03', points: 165, pay: 'paid', remain: 10, lastSeen: '06/09', recent: ['p', 'p', 'a', 'p', 'p', 'p'], emName: '何媽媽', emPhone: '0911-210-100' },
	{ id: 'GY2024023', name: '蘇柏丞', initial: '蘇', color: '#F59E0B', course: '跑酷入門班', coach: '王思齊', att: 73, status: 'warning', age: 14, parent: '蘇太太', phone: '0922-320-214', joined: '2024/02', points: 188, pay: 'due', remain: 3, lastSeen: '06/01', recent: ['a', 'p', 'a', 'l', 'a', 'p'], emName: '蘇先生', emPhone: '0922-320-210' },
	{ id: 'GY2024024', name: '江品妍', initial: '江', color: '#8B5CF6', course: '幼兒體操 律動班', coach: '黃詩涵', att: 99, status: 'active', age: 4, parent: '江先生', phone: '0933-430-325', joined: '2024/04', points: 110, pay: 'trial', remain: 2, lastSeen: '06/08', recent: ['p', 'p', 'p', 'p', 'p', 'p'], emName: '江媽媽', emPhone: '0933-430-320' },
	{ id: 'GY2024025', name: '高梓睿', initial: '高', color: '#0066CC', course: '競技啦啦隊 基礎班', coach: '張育誠', att: 85, status: 'active', age: 9, parent: '高太太', phone: '0955-540-436', joined: '2024/01', points: 222, pay: 'paid', remain: 11, lastSeen: '06/10', recent: ['p', 'l', 'p', 'p', 'p', 'a'], emName: '高先生', emPhone: '0955-540-430' },
	{ id: 'GY2024026', name: '范詠晴', initial: '范', color: '#EC4899', course: '成人體操 進階班', coach: '王思齊', att: 78, status: 'warning', age: 29, parent: '—', phone: '0966-650-547', joined: '2023/10', points: 264, pay: 'due', remain: 6, lastSeen: '06/04', recent: ['p', 'a', 'p', 'p', 'a', 'p'], emName: '緊急聯絡', emPhone: '0966-650-540' },
	{ id: 'GY2024027', name: '董昊天', initial: '董', color: '#10B981', course: '競技體操 預備班', coach: '林雅婷', att: 92, status: 'active', age: 9, parent: '董先生', phone: '0911-760-658', joined: '2024/02', points: 207, pay: 'paid', remain: 12, lastSeen: '06/10', recent: ['p', 'p', 'p', 'a', 'p', 'p'], emName: '董媽媽', emPhone: '0911-760-650' },
	{ id: 'GY2024028', name: '鄧子萱', initial: '鄧', color: '#0EA5E9', course: '兒童基礎 假日班', coach: '陳冠宇', att: 81, status: 'active', age: 7, parent: '鄧太太', phone: '0922-870-769', joined: '2024/03', points: 143, pay: 'paid', remain: 9, lastSeen: '06/08', recent: ['p', 'p', 'l', 'p', 'a', 'p'], emName: '鄧先生', emPhone: '0922-870-760' },
	{ id: 'GY2024029', name: '石宥廷', initial: '石', color: '#F59E0B', course: '跑酷 進階班', coach: '王思齊', att: 70, status: 'warning', age: 16, parent: '石先生', phone: '0933-980-870', joined: '2024/01', points: 176, pay: 'due', remain: 4, lastSeen: '05/30', recent: ['a', 'p', 'a', 'a', 'p', 'l'], emName: '石媽媽', emPhone: '0933-980-878' },
	{ id: 'GY2024030', name: '韓欣怡', initial: '韓', color: '#8B5CF6', course: '幼兒體操 親子探索', coach: '黃詩涵', att: 100, status: 'active', age: 3, parent: '韓太太', phone: '0955-110-981', joined: '2024/04', points: 88, pay: 'trial', remain: 3, lastSeen: '06/07', recent: ['p', 'p', 'p', 'p', 'p', 'p'], emName: '韓先生', emPhone: '0955-110-980' },
	{ id: 'GY2024031', name: '龔睿哲', initial: '龔', color: '#0066CC', course: '競技啦啦隊 兒童班', coach: '張育誠', att: 88, status: 'active', age: 8, parent: '龔先生', phone: '0966-220-102', joined: '2024/02', points: 191, pay: 'paid', remain: 10, lastSeen: '06/09', recent: ['p', 'p', 'a', 'p', 'p', 'l'], emName: '龔媽媽', emPhone: '0966-220-100' },
	{ id: 'GY2024032', name: '簡若彤', initial: '簡', color: '#EC4899', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 83, status: 'active', age: 12, parent: '簡太太', phone: '0911-330-213', joined: '2023/12', points: 305, pay: 'paid', remain: 13, lastSeen: '06/10', recent: ['p', 'a', 'p', 'p', 'l', 'p'], emName: '簡先生', emPhone: '0911-330-210' },
	{ id: 'GY2024033', name: '宋品睿', initial: '宋', color: '#0EA5E9', course: '兒童基礎 A 班', coach: '陳冠宇', att: 90, status: 'active', age: 8, parent: '宋太太', phone: '0911-240-330', joined: '2024/05', points: 150, pay: 'paid', remain: 10, lastSeen: '06/09', recent: ['p', 'p', 'p', 'l', 'p', 'p'], emName: '宋先生', emPhone: '0911-240-338' },
	{ id: 'GY2024034', name: '卓宥希', initial: '卓', color: '#10B981', course: '幼兒體操 啟蒙班', coach: '黃詩涵', att: 97, status: 'active', age: 5, parent: '卓先生', phone: '0922-350-441', joined: '2024/05', points: 96, pay: 'trial', remain: 2, lastSeen: '06/08', recent: ['p', 'p', 'p', 'p', 'p', 'p'], emName: '卓媽媽', emPhone: '0922-350-448' },
	{ id: 'GY2024035', name: '方梓晴', initial: '方', color: '#F59E0B', course: '競技啦啦隊 基礎班', coach: '張育誠', att: 84, status: 'active', age: 9, parent: '方太太', phone: '0933-460-552', joined: '2024/03', points: 210, pay: 'paid', remain: 9, lastSeen: '06/10', recent: ['p', 'l', 'p', 'p', 'a', 'p'], emName: '方先生', emPhone: '0933-460-558' },
	{ id: 'GY2024036', name: '孔柏睿', initial: '孔', color: '#8B5CF6', course: '跑酷 進階班', coach: '王思齊', att: 74, status: 'warning', age: 15, parent: '孔先生', phone: '0955-570-663', joined: '2024/02', points: 188, pay: 'due', remain: 3, lastSeen: '06/01', recent: ['a', 'p', 'a', 'l', 'p', 'a'], emName: '孔媽媽', emPhone: '0955-570-668' },
	{ id: 'GY2024037', name: '白宜蓁', initial: '白', color: '#EC4899', course: '競技體操 預備班', coach: '林雅婷', att: 93, status: 'active', age: 10, parent: '白太太', phone: '0966-680-774', joined: '2024/01', points: 268, pay: 'paid', remain: 12, lastSeen: '06/10', recent: ['p', 'p', 'p', 'p', 'l', 'p'], emName: '白先生', emPhone: '0966-680-778' },
	{ id: 'GY2024038', name: '金宇辰', initial: '金', color: '#14B8A6', course: '成人體操 進階班', coach: '王思齊', att: 80, status: 'active', age: 33, parent: '—', phone: '0911-790-885', joined: '2023/12', points: 230, pay: 'paid', remain: 8, lastSeen: '06/06', recent: ['p', 'a', 'p', 'p', 'p', 'a'], emName: '緊急聯絡', emPhone: '0911-790-888' },
	{ id: 'GY2024039', name: '廖芷妍', initial: '廖', color: '#0066CC', course: '競技啦啦隊 兒童班', coach: '張育誠', att: 96, status: 'active', age: 7, parent: '廖先生', phone: '0922-810-996', joined: '2024/04', points: 132, pay: 'paid', remain: 11, lastSeen: '06/09', recent: ['p', 'p', 'p', 'p', 'p', 'l'], emName: '廖媽媽', emPhone: '0922-810-998' },
	{ id: 'GY2024040', name: '侯昊瑋', initial: '侯', color: '#0EA5E9', course: '競技體操 選手班', coach: '林雅婷', att: 88, status: 'active', age: 12, parent: '侯太太', phone: '0933-920-107', joined: '2023/11', points: 372, pay: 'paid', remain: 13, lastSeen: '06/10', recent: ['p', 'p', 'l', 'p', 'p', 'p'], emName: '侯先生', emPhone: '0933-920-108' },
	{ id: 'GY2024041', name: '武品妍', initial: '武', color: '#10B981', course: '幼兒體操 律動班', coach: '黃詩涵', att: 100, status: 'active', age: 4, parent: '武太太', phone: '0955-130-218', joined: '2024/05', points: 78, pay: 'trial', remain: 3, lastSeen: '06/08', recent: ['p', 'p', 'p', 'p', 'p', 'p'], emName: '武先生', emPhone: '0955-130-228' },
	{ id: 'GY2024042', name: '孫詠晴', initial: '孫', color: '#F59E0B', course: '成人體操 基礎班', coach: '王思齊', att: 68, status: 'warning', age: 28, parent: '—', phone: '0966-240-329', joined: '2023/10', points: 254, pay: 'due', remain: 5, lastSeen: '06/03', recent: ['p', 'a', 'a', 'p', 'a', 'p'], emName: '緊急聯絡', emPhone: '0966-240-338' },
	{ id: 'GY2024043', name: '常宥辰', initial: '常', color: '#8B5CF6', course: '兒童基礎 假日班', coach: '陳冠宇', att: 85, status: 'active', age: 7, parent: '常先生', phone: '0911-350-430', joined: '2024/03', points: 160, pay: 'paid', remain: 9, lastSeen: '06/08', recent: ['p', 'p', 'a', 'p', 'p', 'l'], emName: '常媽媽', emPhone: '0911-350-438' },
	{ id: 'GY2024044', name: '秦語彤', initial: '秦', color: '#EC4899', course: '競技啦啦隊 進階班', coach: '林雅婷', att: 92, status: 'active', age: 12, parent: '秦太太', phone: '0922-460-541', joined: '2023/12', points: 318, pay: 'paid', remain: 13, lastSeen: '06/10', recent: ['p', 'p', 'p', 'l', 'p', 'p'], emName: '秦先生', emPhone: '0922-460-548' },
	{ id: 'GY2024045', name: '莊柏宏', initial: '莊', color: '#0066CC', course: '競技啦啦隊 基礎班', coach: '張育誠', att: 79, status: 'warning', age: 10, parent: '莊先生', phone: '0933-570-652', joined: '2024/04', points: 118, pay: 'trial', remain: 1, lastSeen: '05/29', recent: ['a', 'p', 'a', 'l', 'a', 'p'], emName: '莊媽媽', emPhone: '0933-570-658' },
	{ id: 'GY2024046', name: '葛欣妍', initial: '葛', color: '#14B8A6', course: '兒童基礎 B 班', coach: '陳冠宇', att: 90, status: 'active', age: 8, parent: '葛太太', phone: '0955-680-763', joined: '2024/02', points: 205, pay: 'paid', remain: 10, lastSeen: '06/09', recent: ['p', 'p', 'p', 'a', 'p', 'p'], emName: '葛先生', emPhone: '0955-680-768' },
	{ id: 'GY2024047', name: '歐宇翔', initial: '歐', color: '#0EA5E9', course: '競技體操 預備班', coach: '林雅婷', att: 94, status: 'active', age: 9, parent: '歐先生', phone: '0966-790-874', joined: '2024/01', points: 242, pay: 'paid', remain: 12, lastSeen: '06/10', recent: ['p', 'p', 'p', 'p', 'p', 'l'], emName: '歐媽媽', emPhone: '0966-790-878' },
	{ id: 'GY2024048', name: '賀梓睿', initial: '賀', color: '#10B981', course: '跑酷入門班', coach: '王思齊', att: 76, status: 'warning', age: 14, parent: '賀太太', phone: '0911-900-985', joined: '2024/03', points: 172, pay: 'due', remain: 4, lastSeen: '06/02', recent: ['a', 'p', 'a', 'p', 'l', 'a'], emName: '賀先生', emPhone: '0911-900-988' }
];

const CAMPUSES = ['美村本館', '文心分館', '北屯分館'];
const ENROLL_SOURCES = ['官網預約表單', 'Facebook 廣告', '親友轉介', 'Google 搜尋', '社區體驗活動', 'LINE 官方帳號'];

/** 會員分級：≥350 金卡、≥250 銀卡、≥150 銅卡、其餘一般。回傳 [名稱, 色碼]。 */
export function tierOf(pts: number): [string, string] {
	return pts >= 350
		? ['金卡會員', '#F59E0B']
		: pts >= 250
			? ['銀卡會員', '#94A3B8']
			: pts >= 150
				? ['銅卡會員', '#B45309']
				: ['一般會員', '#64748B'];
}

export const MEMBERS: Member[] = MEMBERS_BASE.map((m, i) => {
	const [tier, tierColor] = tierOf(m.points);
	const by = 2026 - m.age;
	const birthday =
		by + '/' + String(((i * 5) % 12) + 1).padStart(2, '0') + '/' + String(((i * 7) % 27) + 1).padStart(2, '0');
	const renewDue =
		m.pay === 'trial'
			? '體驗 06/30 到期'
			: m.pay === 'due'
				? '已逾期 · ' + ['05/28', '06/01', '06/03', '06/05'][i % 4]
				: '2026/' + ['09', '10', '11', '12'][i % 4] + '/15';
	return {
		...m,
		campus: CAMPUSES[i % CAMPUSES.length],
		source: ENROLL_SOURCES[(i * 2 + 1) % ENROLL_SOURCES.length],
		birthday,
		tier,
		tierColor,
		renewDue,
		lineId: '@df' + m.id.slice(-4)
	};
});

/* ───────────────────────── orders ───────────────────────── */
interface OrderBase {
	id: string;
	member: string;
	initial: string;
	color: string;
	item: string;
	amount: number;
	status: OrderStatus;
	method: string;
	date: string;
	invoice: string;
	discount: string;
	handler: string;
	reason?: string;
}
export interface Order extends OrderBase {
	campus: string;
	tax: number;
	net: number;
	paidAt: string;
	taxId: string;
}

const ORDERS_BASE: OrderBase[] = [
	{ id: 'DF-24061', member: '王承恩', initial: '王', color: '#0066CC', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: '信用卡', date: '06/08 14:22', invoice: 'QX-48120391', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24060', member: '陳思妤', initial: '陳', color: '#EC4899', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: 'LINE Pay', date: '06/08 11:03', invoice: 'QX-48120385', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24059', member: '李宥蓁', initial: '李', color: '#0EA5E9', item: '兒童基礎 B 班 · 春季', amount: 3200, status: 'pending', method: 'ATM 轉帳', date: '06/07 19:45', invoice: 'QX-48120377', discount: '—', handler: '系統自動' },
	{ id: 'DF-24058', member: '吳冠霖', initial: '吳', color: '#0066CC', item: '競技體操 選手班 · 春季', amount: 6200, status: 'paid', method: '信用卡', date: '06/07 16:30', invoice: 'QX-48120362', discount: '續報 -300', handler: '林雅婷' },
	{ id: 'DF-24057', member: '周哲瑋', initial: '周', color: '#10B981', item: '跑酷入門班 · 體驗', amount: 600, status: 'refunded', method: '信用卡', date: '06/06 10:12', invoice: 'QX-48120344', discount: '體驗折抵', handler: '王思齊', reason: '家長申請改期，全額退款' },
	{ id: 'DF-24056', member: '蔡昀軒', initial: '蔡', color: '#F59E0B', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: 'LINE Pay', date: '06/05 20:08', invoice: 'QX-48120331', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24055', member: '鄭宇翔', initial: '鄭', color: '#8B5CF6', item: '成人體操 基礎班 · 春季', amount: 3600, status: 'pending', method: 'ATM 轉帳', date: '06/05 09:55', invoice: 'QX-48120318', discount: '—', handler: '系統自動' },
	{ id: 'DF-24054', member: '劉芷晴', initial: '劉', color: '#0EA5E9', item: '幼兒體操 啟蒙班 · 春季', amount: 2800, status: 'paid', method: '信用卡', date: '06/04 13:40', invoice: 'QX-48120307', discount: '手足 -200', handler: '陳怡君' },
	{ id: 'DF-24053', member: '楊承翰', initial: '楊', color: '#14B8A6', item: '競技體操 選手班 · 春季', amount: 6200, status: 'paid', method: '街口支付', date: '06/04 10:18', invoice: 'QX-48120291', discount: '—', handler: '林雅婷' },
	{ id: 'DF-24052', member: '何宜蓁', initial: '何', color: '#0EA5E9', item: '兒童基礎 A 班 · 春季', amount: 3200, status: 'paid', method: '信用卡', date: '06/03 18:50', invoice: 'QX-48120284', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24051', member: '蘇柏丞', initial: '蘇', color: '#F59E0B', item: '跑酷入門班 · 春季', amount: 3400, status: 'pending', method: 'ATM 轉帳', date: '06/03 14:05', invoice: 'QX-48120270', discount: '—', handler: '系統自動' },
	{ id: 'DF-24050', member: '江品妍', initial: '江', color: '#8B5CF6', item: '幼兒體操 律動班 · 春季', amount: 2800, status: 'paid', method: 'LINE Pay', date: '06/02 11:22', invoice: 'QX-48120263', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24049', member: '高梓睿', initial: '高', color: '#0066CC', item: '競技啦啦隊 基礎班 · 春季', amount: 4200, status: 'paid', method: '信用卡', date: '06/02 09:40', invoice: 'QX-48120251', discount: '手足 -200', handler: '陳怡君' },
	{ id: 'DF-24048', member: '范詠晴', initial: '范', color: '#EC4899', item: '成人體操 進階班 · 春季', amount: 3900, status: 'pending', method: '現金', date: '06/01 19:30', invoice: 'QX-48120240', discount: '—', handler: '王思齊' },
	{ id: 'DF-24047', member: '董昊天', initial: '董', color: '#10B981', item: '競技體操 預備班 · 春季', amount: 5200, status: 'paid', method: '信用卡', date: '06/01 15:12', invoice: 'QX-48120233', discount: '續報 -300', handler: '林雅婷' },
	{ id: 'DF-24046', member: '鄧子萱', initial: '鄧', color: '#0EA5E9', item: '兒童基礎 假日班 · 春季', amount: 3200, status: 'paid', method: 'LINE Pay', date: '05/31 16:48', invoice: 'QX-48120221', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24045', member: '石宥廷', initial: '石', color: '#F59E0B', item: '跑酷 進階班 · 春季', amount: 3800, status: 'refunded', method: '信用卡', date: '05/31 10:05', invoice: 'QX-48120214', discount: '—', handler: '王思齊', reason: '重複報名，退一筆' },
	{ id: 'DF-24044', member: '韓欣怡', initial: '韓', color: '#8B5CF6', item: '幼兒體操 親子探索 · 體驗', amount: 600, status: 'paid', method: '現金', date: '05/30 11:30', invoice: 'QX-48120208', discount: '體驗折抵', handler: '黃詩涵' },
	{ id: 'DF-24043', member: '龔睿哲', initial: '龔', color: '#0066CC', item: '競技啦啦隊 兒童班 · 春季', amount: 3800, status: 'paid', method: '信用卡', date: '05/30 09:18', invoice: 'QX-48120197', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24042', member: '簡若彤', initial: '簡', color: '#EC4899', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: 'LINE Pay', date: '05/29 20:40', invoice: 'QX-48120185', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24041', member: '王承恩', initial: '王', color: '#0066CC', item: '月票 · 自由練習', amount: 2800, status: 'paid', method: '信用卡', date: '05/29 13:02', invoice: 'QX-48120172', discount: '—', handler: '系統自動' },
	{ id: 'DF-24040', member: '陳思妤', initial: '陳', color: '#EC4899', item: '10 堂回數票', amount: 5400, status: 'paid', method: 'LINE Pay', date: '05/28 18:25', invoice: 'QX-48120166', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24039', member: '周哲瑋', initial: '周', color: '#10B981', item: '比賽觀賽票 × 2', amount: 700, status: 'pending', method: 'ATM 轉帳', date: '05/28 10:50', invoice: 'QX-48120154', discount: '—', handler: '系統自動' },
	{ id: 'DF-24038', member: '蔡昀軒', initial: '蔡', color: '#F59E0B', item: '體驗券 · 單堂', amount: 600, status: 'paid', method: '街口支付', date: '05/27 17:15', invoice: 'QX-48120147', discount: '體驗折抵', handler: '陳怡君' },
	{ id: 'DF-24037', member: '葛欣妍', initial: '葛', color: '#14B8A6', item: '兒童基礎 B 班 · 春季', amount: 3200, status: 'paid', method: '信用卡', date: '05/27 11:08', invoice: 'QX-48120138', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24036', member: '侯昊瑋', initial: '侯', color: '#0EA5E9', item: '競技體操 選手班 · 春季', amount: 6200, status: 'paid', method: 'LINE Pay', date: '05/26 19:52', invoice: 'QX-48120125', discount: '續報 -300', handler: '林雅婷' },
	{ id: 'DF-24035', member: '孫詠晴', initial: '孫', color: '#F59E0B', item: '成人體操 基礎班 · 春季', amount: 3600, status: 'pending', method: 'ATM 轉帳', date: '05/26 10:30', invoice: 'QX-48120119', discount: '—', handler: '系統自動' },
	{ id: 'DF-24034', member: '白宜蓁', initial: '白', color: '#EC4899', item: '競技體操 預備班 · 春季', amount: 5200, status: 'paid', method: '信用卡', date: '05/25 16:14', invoice: 'QX-48120104', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24033', member: '方梓晴', initial: '方', color: '#F59E0B', item: '競技啦啦隊 基礎班 · 春季', amount: 4200, status: 'paid', method: '街口支付', date: '05/25 09:48', invoice: 'QX-48120097', discount: '手足 -200', handler: '陳怡君' },
	{ id: 'DF-24032', member: '卓宥希', initial: '卓', color: '#10B981', item: '幼兒體操 啟蒙班 · 體驗', amount: 600, status: 'paid', method: '現金', date: '05/24 11:20', invoice: 'QX-48120085', discount: '體驗折抵', handler: '黃詩涵' },
	{ id: 'DF-24031', member: '孔柏睿', initial: '孔', color: '#8B5CF6', item: '跑酷 進階班 · 春季', amount: 3800, status: 'pending', method: 'ATM 轉帳', date: '05/24 09:05', invoice: 'QX-48120078', discount: '—', handler: '系統自動' },
	{ id: 'DF-24030', member: '宋品睿', initial: '宋', color: '#0EA5E9', item: '兒童基礎 A 班 · 春季', amount: 3200, status: 'paid', method: '信用卡', date: '05/23 18:36', invoice: 'QX-48120066', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24029', member: '秦語彤', initial: '秦', color: '#EC4899', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: 'LINE Pay', date: '05/23 14:02', invoice: 'QX-48120051', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24028', member: '歐宇翔', initial: '歐', color: '#0EA5E9', item: '競技體操 預備班 · 春季', amount: 5200, status: 'paid', method: '信用卡', date: '05/22 10:44', invoice: 'QX-48120043', discount: '續報 -300', handler: '林雅婷' },
	{ id: 'DF-24027', member: '賀梓睿', initial: '賀', color: '#10B981', item: '跑酷入門班 · 春季', amount: 3400, status: 'refunded', method: '信用卡', date: '05/21 15:25', invoice: 'QX-48120034', discount: '—', handler: '王思齊', reason: '改報週四班，原班退款' },
	{ id: 'DF-24026', member: '武品妍', initial: '武', color: '#10B981', item: '親子體驗組', amount: 1000, status: 'paid', method: 'LINE Pay', date: '05/20 11:10', invoice: 'QX-48120021', discount: '—', handler: '黃詩涵' }
];

export const ORDERS: Order[] = ORDERS_BASE.map((o, i) => {
	const tax = Math.round(o.amount - o.amount / 1.05);
	return {
		...o,
		campus: CAMPUSES[i % CAMPUSES.length],
		tax,
		net: o.amount - tax,
		paidAt: o.status === 'paid' ? o.date : o.status === 'pending' ? '—（待付款）' : o.date,
		taxId: i % 5 === 0 ? '539012' + String(40 + i).slice(0, 2) : '—'
	};
});

/* ───────────────────────── status maps (shapes differ!) ───────────────────────── */
/** [Tone, label] tuples. */
export const MEMBER_STATUS: Record<MemberStatus, [Tone, string]> = {
	active: ['success', '在學中'],
	warning: ['warning', '出席偏低'],
	paused: ['neutral', '暫停中']
};
export const PAY_STATUS: Record<PayStatus, [Tone, string]> = {
	paid: ['success', '已繳清'],
	due: ['warning', '待續費'],
	trial: ['info', '體驗中']
};
export const ORDER_STATUS: Record<OrderStatus, [Tone, string]> = {
	paid: ['success', '已付款'],
	pending: ['warning', '待付款'],
	refunded: ['neutral', '已退款']
};
export const VENUE_STATUS: Record<VenueStatus, [Tone, string]> = {
	available: ['success', '可預約'],
	maintenance: ['warning', '維護中']
};
export const TICKET_TYPE: Record<TicketType, [Tone, string]> = {
	pass: ['primary', '通行票'],
	trial: ['success', '體驗票'],
	event: ['accent', '活動票']
};
/** ⚠ raw hex colour + label (NOT a Tone) — used for the 6-dot attendance strip. */
export const ATT_MARK: Record<AttMark, [string, string]> = {
	p: ['#10B981', '出'],
	a: ['#EF4444', '缺'],
	l: ['#F59E0B', '遲'],
	v: ['#94A3B8', '假']
};
/** plain Tone lookups. */
export const LEVEL_TONE: Record<Level, Tone> = {
	啟蒙: 'info',
	入門: 'info',
	基礎: 'primary',
	進階: 'warning',
	選手: 'accent'
};
export const STATUS_TONE: Record<ClassStatus, Tone> = {
	招生中: 'success',
	候補: 'warning',
	額滿: 'neutral'
};

/* ───────────────────────── form constants ───────────────────────── */
export const LEVELS: Level[] = ['啟蒙', '入門', '基礎', '進階', '選手'];
export const CATS: string[] = ['競技體操', '競技啦啦隊', '兒童基礎', '幼兒體操', '成人體操', '跑酷'];
export const CLASS_STATUS: ClassStatus[] = ['招生中', '候補', '額滿'];
export const MEMBER_COLORS: string[] = ['#0066CC', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#EF4444'];

/* ───────────────────────── today schedule (admin) ───────────────────────── */
export interface TodayClass {
	time: string;
	name: string;
	coach: string;
	room: string;
	count: number;
	state: TodayState;
	tone: Tone;
	label: string;
}
export const TODAY: TodayClass[] = [
	{ time: '10:00', name: '幼兒體操 啟蒙班', coach: '黃詩涵', room: 'C 軟墊區', count: 6, state: 'done', tone: 'neutral', label: '已結束' },
	{ time: '16:00', name: '親子體操 同樂班', coach: '黃詩涵', room: 'C 軟墊區', count: 5, state: 'prep', tone: 'info', label: '備課中' },
	{ time: '17:30', name: '兒童基礎 B 班', coach: '陳冠宇', room: 'B 教室', count: 8, state: 'live', tone: 'success', label: '進行中' },
	{ time: '19:00', name: '競技啦啦隊 進階班', coach: '林雅婷', room: 'A 訓練館', count: 11, state: 'soon', tone: 'warning', label: '即將開始' },
	{ time: '20:00', name: '成人體操 基礎班', coach: '王思齊', room: 'A 訓練館', count: 9, state: 'wait', tone: 'neutral', label: '尚未開始' }
];

/* ───────────────────────── admin activity feed ───────────────────────── */
export interface Activity {
	icon: string;
	tone: string;
	bg: string;
	text: string;
	time: string;
}
export const ACTIVITY: Activity[] = [
	{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '新學員 謝佩珊 完成報名兒童基礎 B 班', time: '12 分鐘前' },
	{ icon: 'credit-card', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', text: '訂單 DF-24061 已付款 NT$4,800', time: '38 分鐘前' },
	{ icon: 'calendar-off', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', text: '許恩綺 為今日 19:00 課堂請假', time: '1 小時前' },
	{ icon: 'award', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', text: '林雅婷 教練更新競技體操選手班技能評量', time: '2 小時前' },
	{ icon: 'refresh-cw', tone: 'var(--df-text-light)', bg: 'var(--df-bg-light)', text: '訂單 DF-24057 已退款 NT$600', time: '3 小時前' },
	{ icon: 'user-check', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '李孟潔 教練 完成幼兒體操探索班建檔', time: '20 分鐘前' },
	{ icon: 'ticket', tone: '#8B5CF6', bg: '#F3EEFE', text: '季票 · 暢遊 售出 2 張，金額 NT$14,400', time: '1 小時前' },
	{ icon: 'user-plus', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', text: '新學員 秦語彤 完成報名競技啦啦隊 進階班', time: '4 小時前' }
];

/* ───────────────────────── venues ───────────────────────── */
export interface Venue {
	id: string;
	name: string;
	type: string;
	area: string;
	cap: number;
	equip: string[];
	status: VenueStatus;
	today: number;
}
export const VENUES: Venue[] = [
	{ id: 'A', name: 'A 訓練館', type: '競技主訓練場', area: '180 ㎡', cap: 16, equip: ['彈翻床', '平衡木', '單槓', '海綿池'], status: 'available', today: 4 },
	{ id: 'B', name: 'B 教室', type: '兒童基礎教室', area: '96 ㎡', cap: 12, equip: ['軟墊', '低平衡木', '跳箱'], status: 'available', today: 3 },
	{ id: 'C', name: 'C 軟墊區', type: '幼兒啟蒙區', area: '72 ㎡', cap: 10, equip: ['軟墊', '海綿障礙', '彩虹梯'], status: 'available', today: 3 },
	{ id: 'D', name: '戶外場', type: '跑酷 / 體能', area: '240 ㎡', cap: 14, equip: ['跑酷箱', '欄架', '攀爬架'], status: 'maintenance', today: 0 },
	{ id: 'E', name: 'E 多功能教室', type: '律動 / 體適能', area: '110 ㎡', cap: 14, equip: ['地墊', '鏡牆', '律動球', '彈力帶'], status: 'available', today: 2 },
	{ id: 'F', name: 'F 體能訓練室', type: '重訓 / 體能', area: '88 ㎡', cap: 10, equip: ['槓鈴', '壺鈴', 'TRX', '跳箱'], status: 'available', today: 1 }
];

/* ───────────────────────── tickets ───────────────────────── */
export interface Ticket {
	id: string;
	name: string;
	type: TicketType;
	price: number;
	sold: number;
	quota: number;
	color: string;
	icon: string;
	desc: string;
}
export const TICKETS: Ticket[] = [
	{ id: 'T-MONTH', name: '月票 · 自由練習', type: 'pass', price: 2800, sold: 128, quota: 200, color: 'var(--df-primary)', icon: 'calendar-days', desc: '當月不限堂數自由練習' },
	{ id: 'T-TRIAL', name: '體驗券 · 單堂', type: 'trial', price: 600, sold: 86, quota: 120, color: '#10B981', icon: 'sparkles', desc: '首次報名單堂體驗' },
	{ id: 'T-COMP', name: '比賽觀賽票', type: 'event', price: 350, sold: 234, quota: 400, color: '#8B5CF6', icon: 'trophy', desc: '年度成果發表與賽事入場' },
	{ id: 'T-CLASS10', name: '10 堂回數票', type: 'pass', price: 5400, sold: 64, quota: 100, color: 'var(--df-warning)', icon: 'tickets', desc: '彈性使用 · 半年內有效' },
	{ id: 'T-SEASON', name: '季票 · 暢遊', type: 'pass', price: 7200, sold: 52, quota: 120, color: '#0EA5E9', icon: 'calendar-range', desc: '單季不限堂數自由練習' },
	{ id: 'T-FAMILY', name: '親子體驗組', type: 'trial', price: 1000, sold: 73, quota: 150, color: '#EC4899', icon: 'users', desc: '親子雙人單堂體驗' }
];

/* ═════════════════════════ 報表分析 datasets ═════════════════════════ */
export interface ReportKpi {
	icon: string;
	label: string;
	value: string;
	delta: string;
	tint: string;
	color: string;
}
export const REPORT_KPIS: ReportKpi[] = [
	{ icon: 'dollar-sign', label: '本月營收', value: 'NT$ 458,200', delta: '+12.5%', tint: '#0066CC14', color: 'var(--df-primary)' },
	{ icon: 'book-open', label: '課程報名', value: '142 筆', delta: '+8.3%', tint: '#10B98114', color: '#10B981' },
	{ icon: 'user-plus', label: '新增會員', value: '86 位', delta: '+24.8%', tint: '#F59E0B14', color: '#F59E0B' },
	{ icon: 'ticket', label: '票券銷售', value: '234 張', delta: '+18.7%', tint: '#8B5CF614', color: '#8B5CF6' },
	{ icon: 'repeat', label: '會員留存率', value: '88.4%', delta: '+3.1%', tint: '#0EA5E914', color: '#0EA5E9' },
	{ icon: 'calendar-check', label: '平均出席率', value: '91.2%', delta: '+1.4%', tint: '#10B98114', color: '#10B981' }
];

export interface RevenueRow {
	name: string;
	meta: string;
	amount: string;
	drill: string;
	dot: string;
}
export const REVENUE_BREAKDOWN: RevenueRow[] = [
	{ name: '課程報名訂單', meta: '142 筆 · 平均客單 NT$ 2,197', amount: 'NT$ 312,000', drill: '下鑽班級／訂單', dot: 'var(--df-primary)' },
	{ name: '票券銷售', meta: '234 張 · 月票 / 體驗券 / 比賽票', amount: 'NT$ 98,400', drill: '下鑽票券來源', dot: '#8B5CF6' },
	{ name: '裝備與週邊', meta: '86 筆 · 護具 / 隊服', amount: 'NT$ 47,800', drill: '下鑽訂單', dot: 'var(--df-warning)' }
];
export const REVENUE_TOTAL = 'NT$ 458,200';

export interface TrendBar {
	m: string;
	h: number;
	peak?: boolean;
}
export const REVENUE_TREND: TrendBar[] = [
	{ m: '1月', h: 102 }, { m: '2月', h: 112 }, { m: '3月', h: 107 }, { m: '4月', h: 121 },
	{ m: '5月', h: 128 }, { m: '6月', h: 138 }, { m: '7月', h: 133 }, { m: '8月', h: 144 },
	{ m: '9月', h: 151 }, { m: '10月', h: 160, peak: true }, { m: '11月', h: 148 }, { m: '12月', h: 156 }
];

/** label + pct + colour — shared by the category / age / payment splits. */
export interface PctSlice {
	label: string;
	pct: number;
	color: string;
}
export const CATEGORY_SPLIT: PctSlice[] = [
	{ label: '競技體操', pct: 35, color: 'var(--df-primary)' },
	{ label: '幼兒體操', pct: 28, color: '#10B981' },
	{ label: '韻律體操', pct: 20, color: 'var(--df-warning)' },
	{ label: '彈翻床', pct: 17, color: '#8B5CF6' }
];

export interface TopCourse {
	rank: number;
	name: string;
	count: number;
}
export const TOP_COURSES: TopCourse[] = [
	{ rank: 1, name: '兒童體操初階班', count: 96 },
	{ rank: 2, name: '競技體操選手班', count: 78 },
	{ rank: 3, name: '幼兒體操啟蒙班', count: 64 },
	{ rank: 4, name: '成人體適能班', count: 52 },
	{ rank: 5, name: '韻律體操進階班', count: 41 }
];

export interface IncomeSource {
	label: string;
	amount: string;
	pct: number;
	color: string;
}
export const INCOME_SOURCES: IncomeSource[] = [
	{ label: '課程學費', amount: 'NT$ 2.61M', pct: 58, color: 'var(--df-primary)' },
	{ label: '票券銷售', amount: 'NT$ 992K', pct: 22, color: '#10B981' },
	{ label: '裝備販售', amount: 'NT$ 541K', pct: 12, color: 'var(--df-warning)' },
	{ label: '場地租借', amount: 'NT$ 361K', pct: 8, color: '#8B5CF6' }
];

export interface CoachPerf {
	name: string;
	initial: string;
	color: string;
	students: number;
	revenue: string;
	revPct: number;
	att: number;
}
export const COACH_PERF: CoachPerf[] = [
	{ name: '林雅婷', initial: '林', color: '#0066CC', students: 86, revenue: 'NT$ 168K', revPct: 100, att: 96 },
	{ name: '陳冠宇', initial: '陳', color: '#0EA5E9', students: 64, revenue: 'NT$ 121K', revPct: 72, att: 92 },
	{ name: '蘇建宏', initial: '蘇', color: '#14B8A6', students: 53, revenue: 'NT$ 98K', revPct: 58, att: 89 },
	{ name: '黃詩涵', initial: '黃', color: '#10B981', students: 48, revenue: 'NT$ 86K', revPct: 51, att: 95 },
	{ name: '周曉彤', initial: '周', color: '#EC4899', students: 42, revenue: 'NT$ 72K', revPct: 43, att: 93 },
	{ name: '王思齊', initial: '王', color: '#F59E0B', students: 39, revenue: 'NT$ 64K', revPct: 38, att: 88 },
	{ name: '張育誠', initial: '張', color: '#8B5CF6', students: 31, revenue: 'NT$ 48K', revPct: 29, att: 90 }
];

export interface VenueUsage {
	name: string;
	pct: number;
	hours: string;
	color: string;
}
export const VENUE_USAGE: VenueUsage[] = [
	{ name: 'A 訓練館', pct: 86, hours: '148 小時', color: 'var(--df-primary)' },
	{ name: 'B 教室', pct: 72, hours: '124 小時', color: '#0EA5E9' },
	{ name: 'C 軟墊區', pct: 64, hours: '110 小時', color: '#10B981' },
	{ name: 'E 多功能教室', pct: 55, hours: '92 小時', color: '#8B5CF6' },
	{ name: 'F 體能訓練室', pct: 41, hours: '68 小時', color: '#EC4899' },
	{ name: '戶外場', pct: 38, hours: '62 小時', color: 'var(--df-warning)' }
];

/** label + count + colour — shared by attendance / tier distributions. */
export interface CountBar {
	label: string;
	count: number;
	color: string;
}
export const ATT_DIST: CountBar[] = [
	{ label: '95–100%', count: 11, color: 'var(--df-success)' },
	{ label: '85–94%', count: 10, color: 'var(--df-primary)' },
	{ label: '75–84%', count: 5, color: '#0EA5E9' },
	{ label: '低於 75%', count: 6, color: 'var(--df-warning)' }
];

export interface RetentionBar {
	m: string;
	nu: number;
	re: number;
}
export const RETENTION: RetentionBar[] = [
	{ m: '1月', nu: 14, re: 38 }, { m: '2月', nu: 18, re: 41 }, { m: '3月', nu: 22, re: 44 },
	{ m: '4月', nu: 16, re: 47 }, { m: '5月', nu: 20, re: 49 }, { m: '6月', nu: 24, re: 52 }
];

export const AGE_DIST: PctSlice[] = [
	{ label: '3–5 歲', pct: 22, color: '#10B981' },
	{ label: '6–9 歲', pct: 34, color: 'var(--df-primary)' },
	{ label: '10–13 歲', pct: 28, color: '#0EA5E9' },
	{ label: '14 歲以上', pct: 16, color: '#8B5CF6' }
];

export interface CampusRevenue {
	name: string;
	amount: string;
	pct: number;
	students: number;
	color: string;
}
export const CAMPUS_REVENUE: CampusRevenue[] = [
	{ name: '美村本館', amount: 'NT$268K', pct: 100, students: 142, color: 'var(--df-primary)' },
	{ name: '文心分館', amount: 'NT$121K', pct: 45, students: 68, color: '#0EA5E9' },
	{ name: '北屯分館', amount: 'NT$69K', pct: 26, students: 38, color: '#10B981' }
];

export const PAYMENT_SPLIT: PctSlice[] = [
	{ label: '信用卡', pct: 46, color: 'var(--df-primary)' },
	{ label: 'LINE Pay', pct: 24, color: '#10B981' },
	{ label: 'ATM 轉帳', pct: 16, color: '#0EA5E9' },
	{ label: '街口支付', pct: 9, color: '#8B5CF6' },
	{ label: '現金', pct: 5, color: 'var(--df-warning)' }
];

export interface FunnelStage {
	label: string;
	count: number;
	pct: number;
	color: string;
}
export const FUNNEL: FunnelStage[] = [
	{ label: '預約體驗', count: 318, pct: 100, color: 'var(--df-primary)' },
	{ label: '完成體驗', count: 246, pct: 77, color: '#0EA5E9' },
	{ label: '正式報名', count: 142, pct: 45, color: '#10B981' },
	{ label: '季末續報', count: 112, pct: 35, color: 'var(--df-accent-dark)' }
];

export interface WeekdayLoad {
	d: string;
	classes: number;
	rate: number;
}
export const WEEKDAY_LOAD: WeekdayLoad[] = [
	{ d: '一', classes: 8, rate: 92 }, { d: '二', classes: 11, rate: 95 }, { d: '三', classes: 9, rate: 90 },
	{ d: '四', classes: 12, rate: 94 }, { d: '五', classes: 10, rate: 88 }, { d: '六', classes: 14, rate: 96 }, { d: '日', classes: 9, rate: 85 }
];

export const TIER_DIST: CountBar[] = [
	{ label: '金卡', count: 9, color: '#F59E0B' },
	{ label: '銀卡', count: 13, color: '#94A3B8' },
	{ label: '銅卡', count: 16, color: '#B45309' },
	{ label: '一般', count: 10, color: '#64748B' }
];
