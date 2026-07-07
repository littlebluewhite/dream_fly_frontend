/* Dream Fly — 管理後台 · ClassRow → POST/PATCH /courses body 組裝（Task 8 piece 1）。
 * 純函式，供 classes/+page.svelte 儲存課程時使用；反向對照 admin/api.ts 唯讀映射用到
 * 的三個小函式（COURSE_LEVEL_TO_CLASS_LEVEL / splitSchedule / ageRange）。 */
import type { ClassRow, Level, Coach } from '$lib/admin/data';
import { COURSE_LEVEL_LABEL } from '$lib/domain/course-level';
import { toCents } from '$lib/public/adapters';
import type { CourseWriteBody } from '$lib/admin/api';

/** 5 態本地分級 → 後端 5 態 course_level enum。由讀側單一 source of truth
 *  `COURSE_LEVEL_LABEL`（$lib/domain/course-level，後端 enum → 繁中標籤）反向推導，
 *  不再手動維護第二份對照表——這裡先前手刻的版本是失真的 5→3 摺疊（啟蒙/選手各自
 *  就近併入 beginner/advanced），會讓建立/編輯 foundation、elite 課程時靜默降級。
 *  反向推導後兩份表恆等，新增/調整分級只需改 COURSE_LEVEL_LABEL 一處。 */
const LEVEL_TO_API: Record<Level, string> = Object.fromEntries(
	Object.entries(COURSE_LEVEL_LABEL).map(([code, label]) => [label, code] as const)
) as Record<Level, string>;
export const levelToApi = (level: Level): string => LEVEL_TO_API[level];

/** day/time 組回 schedule_text（api.ts splitSchedule 的反向）；兩者皆空回 undefined
 *  （PATCH 省略＝維持原值，POST 省略＝無排定時段）。 */
export function scheduleTextOf(day: string, time: string): string | undefined {
	const d = day.trim();
	const t = time.trim();
	if (!d && !t) return undefined;
	if (!d) return t;
	if (!t) return d;
	return `${d} ${t}`;
}

const AGE_RANGE_RE = /^(\d+)–(\d+)\s*歲$/;
const AGE_MIN_RE = /^(\d+)\s*歲以上$/;
const AGE_MAX_RE = /^(\d+)\s*歲以下$/;

/** age 顯示字串反向解析為 min_age/max_age（api.ts ageRange 的反向）。只認得該函式
 *  產生的三種既有格式；格式外的自由文字（含空字串）一律視為未設定，不猜測。 */
export function parseAgeRange(age: string): { min_age?: number; max_age?: number } {
	const s = age.trim();
	const range = AGE_RANGE_RE.exec(s);
	if (range) return { min_age: Number(range[1]), max_age: Number(range[2]) };
	const min = AGE_MIN_RE.exec(s);
	if (min) return { min_age: Number(min[1]) };
	const max = AGE_MAX_RE.exec(s);
	if (max) return { max_age: Number(max[1]) };
	return {};
}

/** coach 姓名比對 coaches 清單取得 id；找不到（含無教練的空字串）回 undefined——
 *  JSON.stringify 會整個丟掉 undefined 欄位，PATCH 省略＝維持原值，POST 省略＝先
 *  不指派教練。 */
export function coachIdOf(coachName: string, coaches: Coach[]): string | undefined {
	return coaches.find((c) => c.name === coachName)?.id;
}

/** ClassRow 目前的編輯內容 → POST/PATCH /courses 共用欄位。不含 duration_minutes——
 *  ClassRow 的 durationMinutes 走 ClassEditDialog 自己的文字欄位（人數上限/季費/
 *  本期堂數同一種「文字緩衝」模式），新增/編輯兩種流程都由呼叫端（classes/+page.svelte）
 *  另外併入 body，見該檔的 save()（FE#18 起編輯流程也會送出）。 */
export function buildCourseBody(k: ClassRow, coaches: Coach[]): CourseWriteBody {
	return {
		name: k.name,
		level: levelToApi(k.level),
		category: k.cat,
		coach_id: coachIdOf(k.coach, coaches),
		schedule_text: scheduleTextOf(k.day, k.time),
		...parseAgeRange(k.age),
		price_cents: toCents(k.price),
		max_students: k.cap
	};
}
