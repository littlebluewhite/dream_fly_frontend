/* Dream Fly — 管理後台 · 課程寫入 module（R13 Task 4 / C2 加深，原 Task 8 piece 1）。
 * 桌面 ClassEditDialog 與 mobile-admin ClassForm 共用：ClassRow → CourseDraft（只含
 * 可寫欄位，數字欄位是文字緩衝）→ checkCourseDraft() 驗證 → ValidCourse →
 * buildCreateCourseBody()/buildUpdateCourseBody() 組 POST/PATCH /courses body。
 *
 * 欄位規則（D2）：後端有的欄位才有 draft 鍵；招生狀態由後端依人數推導（唯讀，不進
 * draft）；場地/期別/堂數後端沒有，不進 draft。驗證文案住本檔（exported const，
 * ADR-0012 ④），toast 與 API 錯誤文案留頁面（ADR-0011）。
 *
 * 驗證上限對齊後端 CreateCourseRequest/UpdateCourseRequest 與 AgeRange：名稱 1–100、
 * max_students 1–10000、price_cents 0–100,000,000（＝NT$0–1,000,000）、duration 1–1440、
 * 年齡 0–150 且 min ≤ max。 */
// C4 批4:Level/Coach 改直取對應 $lib/domain 各 entity 檔(原經 $lib/admin/data 純
// 轉手,零附加型別事實);ClassRow 是 admin/data.ts 本檔真內容(.map 衍生形狀),續留
// 原處。Level 與既有 COURSE_LEVEL_LABEL 同源,合併進同一行 import。
import { CATS, type ClassRow } from '$lib/admin/data';
import { COURSE_LEVEL_LABEL, type Level } from '$lib/domain/course-level';
import type { Coach } from '$lib/domain/coaches';
import { toCents } from '$lib/public/adapters';
import type { CreateCourseBody, UpdateCourseBody } from '$lib/admin/api';

/** 5 態本地分級 → 後端 5 態 course_level enum。由讀側單一 source of truth
 *  `COURSE_LEVEL_LABEL`（$lib/domain/course-level，後端 enum → 繁中標籤）反向推導，
 *  不再手動維護第二份對照表——先前手刻的版本是失真的 5→3 摺疊，會讓建立/編輯
 *  foundation、elite 課程時靜默降級。 */
const LEVEL_TO_API: Record<Level, string> = Object.fromEntries(
	Object.entries(COURSE_LEVEL_LABEL).map(([code, label]) => [label, code] as const)
) as Record<Level, string>;

/** 表單編輯中的課程——只含後端可寫欄位；人數/季費/時長是 Input 的文字緩衝。 */
export interface CourseDraft {
	name: string;
	level: Level;
	cat: string;
	coach: string;
	day: string;
	time: string;
	age: string;
	capText: string;
	priceText: string;
	durationText: string;
}

/** 驗證通過的課程。可清空的欄位以 null 表示「無」；coachId 恆為清單內的在職教練。 */
export interface ValidCourse {
	name: string;
	level: Level;
	category: string | null;
	coachId: string;
	scheduleText: string | null;
	minAge: number | null;
	maxAge: number | null;
	maxStudents: number;
	/** NT$（整數），body 組裝時才轉 cents。 */
	price: number;
	durationMinutes: number;
}

export type CourseErrors = Partial<Record<'name' | 'coach' | 'age' | 'cap' | 'price' | 'duration', string>>;

export type CourseCheck = { kind: 'valid'; course: ValidCourse } | { kind: 'invalid'; errors: CourseErrors };

export const COURSE_NAME_ERROR = '請輸入班級名稱（1–100 字）';
export const COURSE_COACH_ERROR = '請選擇授課教練';
export const COURSE_AGE_FORMAT_ERROR = '年齡格式不符，例如 8–14 歲 / 12 歲以上 / 9 歲以下';
export const COURSE_AGE_RANGE_ERROR = '年齡需介於 0–150 歲，且下限不可大於上限';
export const COURSE_CAP_ERROR = '人數上限需為 1–10000 的整數';
export const COURSE_PRICE_ERROR = '季費需為 0–1,000,000 的整數';
export const COURSE_DURATION_ERROR = '單堂時長需為 1–1440 分鐘的整數';

export function courseDraftOf(row: ClassRow): CourseDraft {
	return {
		name: row.name,
		level: row.level,
		cat: row.cat,
		coach: row.coach,
		day: row.day,
		time: row.time,
		age: row.age,
		capText: String(row.cap),
		priceText: String(row.price),
		durationText: String(row.durationMinutes)
	};
}

/** day/time 組回 schedule_text（api.ts splitSchedule 的反向）；兩者皆空回 null。 */
function scheduleTextOf(day: string, time: string): string | null {
	const d = day.trim();
	const t = time.trim();
	if (!d && !t) return null;
	if (!d) return t;
	if (!t) return d;
	return `${d} ${t}`;
}

// 範圍分隔符：既有顯示格式用 EN DASH（wire.ts ageRange），另收 `-` 與 `~`。
const AGE_RANGE_RE = /^(\d+)\s*[–\-~]\s*(\d+)\s*歲$/;
const AGE_MIN_RE = /^(\d+)\s*歲以上$/;
const AGE_MAX_RE = /^(\d+)\s*歲以下$/;

type AgeParse = { min: number | null; max: number | null } | 'format' | 'range';

/** age 顯示字串反向解析（wire.ts ageRange 的反向）。空字串＝不限；格式外的文字報錯，
 *  不再靜默當成「未設定」。 */
function parseAge(age: string): AgeParse {
	const s = age.trim();
	if (!s) return { min: null, max: null };
	let min: number | null = null;
	let max: number | null = null;
	const range = AGE_RANGE_RE.exec(s);
	const lo = AGE_MIN_RE.exec(s);
	const hi = AGE_MAX_RE.exec(s);
	if (range) [min, max] = [Number(range[1]), Number(range[2])];
	else if (lo) min = Number(lo[1]);
	else if (hi) max = Number(hi[1]);
	else return 'format';
	// \d+ 已排除負數，只需檢查上限與先後
	if ((min ?? 0) > 150 || (max ?? 0) > 150 || (min !== null && max !== null && min > max)) return 'range';
	return { min, max };
}

/** 整數文字 → [lo, hi] 內的整數；不合法回 null。 */
function intIn(text: string, lo: number, hi: number): number | null {
	const s = text.trim();
	if (!/^\d+$/.test(s)) return null;
	const n = Number(s);
	return n >= lo && n <= hi ? n : null;
}

export function checkCourseDraft(d: CourseDraft, coaches: Coach[]): CourseCheck {
	const errors: CourseErrors = {};
	const name = d.name.trim();
	if (name.length < 1 || [...name].length > 100) errors.name = COURSE_NAME_ERROR;
	const coachId = coaches.find((c) => c.name === d.coach)?.id;
	if (!coachId) errors.coach = COURSE_COACH_ERROR;
	const age = parseAge(d.age);
	if (age === 'format') errors.age = COURSE_AGE_FORMAT_ERROR;
	if (age === 'range') errors.age = COURSE_AGE_RANGE_ERROR;
	const maxStudents = intIn(d.capText, 1, 10_000);
	if (maxStudents === null) errors.cap = COURSE_CAP_ERROR;
	const price = intIn(d.priceText, 0, 1_000_000);
	if (price === null) errors.price = COURSE_PRICE_ERROR;
	const durationMinutes = intIn(d.durationText, 1, 1440);
	if (durationMinutes === null) errors.duration = COURSE_DURATION_ERROR;

	// 後半的逐項判斷與 errors 等價，只為了讓 TS 收窄型別
	if (
		Object.keys(errors).length > 0 ||
		!coachId ||
		typeof age === 'string' ||
		maxStudents === null ||
		price === null ||
		durationMinutes === null
	) {
		return { kind: 'invalid', errors };
	}
	return {
		kind: 'valid',
		course: {
			name,
			level: d.level,
			category: d.cat.trim() || null,
			coachId,
			scheduleText: scheduleTextOf(d.day, d.time),
			minAge: age.min,
			maxAge: age.max,
			maxStudents,
			price,
			durationMinutes
		}
	};
}

/** ValidCourse 的每個欄位都進 body，可清空的欄位送 null。PATCH 必須如此：後端對省略的
 *  欄位是「維持原值」，年齡上下限還會跟舊值合併（「8–14 歲」改「12 歲以上」若省略
 *  max_age，會存成 12–14）。POST 送 null 與省略同義，共用同一份欄位組裝。 */
function courseFields(c: ValidCourse) {
	return {
		name: c.name,
		level: LEVEL_TO_API[c.level],
		category: c.category,
		coach_id: c.coachId,
		schedule_text: c.scheduleText,
		min_age: c.minAge,
		max_age: c.maxAge,
		price_cents: toCents(c.price),
		max_students: c.maxStudents,
		duration_minutes: c.durationMinutes
	};
}

export function buildCreateCourseBody(c: ValidCourse): CreateCourseBody {
	return courseFields(c);
}

export function buildUpdateCourseBody(c: ValidCourse): UpdateCourseBody {
	return courseFields(c);
}

/** 新增課程 flow 的空白 ClassRow（Task 2：桌面與 mobile-admin 共用同一份預設值）。
 *  ClassRow 型別桌面/mobile-admin 結構相同，純函式可直接吃兩種。 */
export function blankClassRow(coaches: Coach[]): ClassRow {
	return {
		id: '',
		name: '',
		level: '基礎',
		cat: CATS[0],
		coach: coaches[0]?.name ?? '',
		day: '',
		time: '',
		enrolled: 0,
		cap: 12,
		age: '',
		price: 3200,
		status: '招生中',
		wait: 0,
		durationMinutes: 90
	};
}
