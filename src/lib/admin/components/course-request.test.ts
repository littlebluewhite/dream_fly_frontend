import { describe, it, expect } from 'vitest';
import {
	courseDraftOf,
	checkCourseDraft,
	buildCreateCourseBody,
	buildUpdateCourseBody,
	blankClassRow,
	COURSE_NAME_ERROR,
	COURSE_COACH_ERROR,
	COURSE_AGE_FORMAT_ERROR,
	COURSE_AGE_RANGE_ERROR,
	COURSE_CAP_ERROR,
	COURSE_PRICE_ERROR,
	COURSE_DURATION_ERROR,
	type CourseDraft,
	type CourseErrors,
	type ValidCourse
} from './course-request';
import { CATS, type ClassRow } from '$lib/admin/data';
import type { Coach } from '$lib/domain/coaches';
import { COURSE_LEVEL_LABEL, type Level } from '$lib/domain/course-level';

/* course-request.ts — 課程寫入 module（R13 Task 4 / C2）：draft → check → body。全部是純
 * 函式，不需渲染。表單（ClassEditDialog / mobile ClassForm）的測試只剩接線。 */
const COACHES: Coach[] = [
	{ id: 'co1', userId: 'u1', name: '林雅婷', initial: '林', title: '教練', color: '#000', tags: [], isActive: true },
	{ id: 'co2', userId: 'u2', name: '陳冠宇', initial: '陳', title: '教練', color: '#000', tags: [], isActive: true }
];
const BASE_CLASS: ClassRow = { id: 'k1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', coach: '林雅婷', room: '', day: '週二', time: '19:00–20:30', enrolled: 11, cap: 12, age: '8–14 歲', price: 4800, status: '招生中', wait: 0, term: '', sessions: 0, startDate: '', checkinRate: 0, makeup: 0, durationMinutes: 90 };

function validOf(d: CourseDraft): ValidCourse {
	const r = checkCourseDraft(d, COACHES);
	if (r.kind !== 'valid') throw new Error('expected valid, got ' + JSON.stringify(r.errors));
	return r.course;
}
const draft = (over: Partial<CourseDraft> = {}): CourseDraft => ({ ...courseDraftOf(BASE_CLASS), ...over });

describe('buildUpdateCourseBody — 年齡上下限兩個都送(後端 PATCH 會合併缺的那一邊)', () => {
	it('8–14 歲 改成 12 歲以上 ⇒ { min_age: 12, max_age: null }', () => {
		const body = buildUpdateCourseBody(validOf(draft({ age: '12 歲以上' })));
		expect(body.min_age).toBe(12);
		expect(body.max_age).toBeNull();
	});

	it('改成 9 歲以下 ⇒ { min_age: null, max_age: 9 }', () => {
		const body = buildUpdateCourseBody(validOf(draft({ age: '9 歲以下' })));
		expect(body.min_age).toBeNull();
		expect(body.max_age).toBe(9);
	});

	it('清空 時段 / 年齡 / 分類 ⇒ 送 null(不是省略)', () => {
		const body = buildUpdateCourseBody(validOf(draft({ day: ' ', time: '', age: '', cat: '' })));
		expect(body).toMatchObject({ schedule_text: null, min_age: null, max_age: null, category: null });
	});

	it('每個 draft 鍵都會進 body(無 undefined 值)', () => {
		const body = buildUpdateCourseBody(validOf(draft()));
		expect(Object.keys(body).sort()).toEqual(
			['name', 'level', 'category', 'coach_id', 'schedule_text', 'min_age', 'max_age', 'price_cents', 'max_students', 'duration_minutes'].sort()
		);
		expect(Object.values(body)).not.toContain(undefined);
	});
});

describe('buildCreateCourseBody — ValidCourse → POST body', () => {
	it('組出完整 body(level 轉 enum、季費轉 cents、時段組回 schedule_text)', () => {
		const body = buildCreateCourseBody(
			validOf(draft({ name: '測試班級', coach: '陳冠宇', cat: '競技體操', day: '週二、四', time: '17:00-19:00', priceText: '4800', capText: '12', durationText: '60' }))
		);
		expect(body).toEqual({
			name: '測試班級',
			level: 'advanced',
			category: '競技體操',
			coach_id: 'co2',
			schedule_text: '週二、四 17:00-19:00',
			min_age: 8,
			max_age: 14,
			price_cents: 480000,
			max_students: 12,
			duration_minutes: 60
		});
	});

	it('每一級 level 都對到自己的後端 enum(無 5→3 摺疊)', () => {
		for (const [code, label] of Object.entries(COURSE_LEVEL_LABEL)) {
			expect(buildCreateCourseBody(validOf(draft({ level: label as Level }))).level).toBe(code);
		}
	});

	it('時段只填一邊時只送那一邊', () => {
		expect(buildCreateCourseBody(validOf(draft({ day: '週日', time: '' }))).schedule_text).toBe('週日');
		expect(buildCreateCourseBody(validOf(draft({ day: '', time: '15:00' }))).schedule_text).toBe('15:00');
	});
});

describe('checkCourseDraft — 驗證', () => {
	it('名稱 trim 後送出', () => {
		expect(validOf(draft({ name: '  新班級  ' })).name).toBe('新班級');
	});

	it.each([
		['8–14 歲', 8, 14],
		['8-14 歲', 8, 14],
		['8~14歲', 8, 14],
		['8 – 14 歲', 8, 14],
		['12 歲以上', 12, null],
		['9 歲以下', null, 9],
		['0–150 歲', 0, 150],
		['', null, null]
	])('年齡 %j ⇒ min %s / max %s', (age, min, max) => {
		const c = validOf(draft({ age }));
		expect([c.minAge, c.maxAge]).toEqual([min, max]);
	});

	it.each<[string, Partial<CourseDraft>, keyof CourseErrors, string]>([
		['名稱空白', { name: '   ' }, 'name', COURSE_NAME_ERROR],
		['名稱 101 字', { name: '班'.repeat(101) }, 'name', COURSE_NAME_ERROR],
		['教練不在清單', { coach: '查無此人' }, 'coach', COURSE_COACH_ERROR],
		['教練空白', { coach: '' }, 'coach', COURSE_COACH_ERROR],
		['年齡自由文字', { age: '國小以上' }, 'age', COURSE_AGE_FORMAT_ERROR],
		['年齡缺 歲', { age: '8-14' }, 'age', COURSE_AGE_FORMAT_ERROR],
		['年齡下限大於上限', { age: '14–8 歲' }, 'age', COURSE_AGE_RANGE_ERROR],
		['年齡超過 150', { age: '151 歲以上' }, 'age', COURSE_AGE_RANGE_ERROR],
		['人數 0', { capText: '0' }, 'cap', COURSE_CAP_ERROR],
		['人數 10001', { capText: '10001' }, 'cap', COURSE_CAP_ERROR],
		['人數非整數', { capText: '12.5' }, 'cap', COURSE_CAP_ERROR],
		['人數空白', { capText: '' }, 'cap', COURSE_CAP_ERROR],
		['季費負數', { priceText: '-1' }, 'price', COURSE_PRICE_ERROR],
		['季費超過 1,000,000', { priceText: '1000001' }, 'price', COURSE_PRICE_ERROR],
		['時長 0', { durationText: '0' }, 'duration', COURSE_DURATION_ERROR],
		['時長 1441', { durationText: '1441' }, 'duration', COURSE_DURATION_ERROR]
	])('%s ⇒ invalid', (_label, over, key, message) => {
		expect(errorsOf(draft(over))).toEqual({ [key]: message });
	});

	it.each<[string, Partial<CourseDraft>]>([
		['名稱 1 字', { name: '班' }],
		['名稱 100 字', { name: '班'.repeat(100) }],
		['人數 1', { capText: '1' }],
		['人數 10000', { capText: '10000' }],
		['季費 0', { priceText: '0' }],
		['季費 1,000,000', { priceText: '1000000' }],
		['時長 1', { durationText: '1' }],
		['時長 1440', { durationText: '1440' }]
	])('邊界 %s ⇒ valid', (_label, over) => {
		expect(checkCourseDraft(draft(over), COACHES).kind).toBe('valid');
	});

	it('多個欄位同時不合法 ⇒ 每個都有錯誤', () => {
		expect(Object.keys(errorsOf(draft({ name: '', capText: 'x', durationText: '' }))).sort()).toEqual(['cap', 'duration', 'name']);
	});
});

function errorsOf(d: CourseDraft) {
	const r = checkCourseDraft(d, COACHES);
	return r.kind === 'invalid' ? r.errors : {};
}

describe('courseDraftOf — ClassRow → draft(只含可寫欄位)', () => {
	it('數字欄位轉文字緩衝，不帶場地/期別/堂數/招生狀態', () => {
		expect(courseDraftOf(BASE_CLASS)).toEqual({
			name: '競技啦啦隊 進階班',
			level: '進階',
			cat: '競技啦啦隊',
			coach: '林雅婷',
			day: '週二',
			time: '19:00–20:30',
			age: '8–14 歲',
			capText: '12',
			priceText: '4800',
			durationText: '90'
		});
	});
});

describe('blankClassRow — 新增課程 flow 的空白 ClassRow（桌面 blankClass 預設，Task 2 單一來源）', () => {
	it('seeds the desktop defaults, with cat = CATS[0] and coach = coaches[0].name', () => {
		expect(blankClassRow(COACHES)).toEqual({
			id: '',
			name: '',
			level: '基礎',
			cat: CATS[0],
			coach: '林雅婷',
			room: '',
			day: '',
			time: '',
			enrolled: 0,
			cap: 12,
			age: '',
			price: 3200,
			status: '招生中',
			wait: 0,
			term: '2026 春季',
			sessions: 16,
			startDate: '',
			checkinRate: 0,
			makeup: 0,
			durationMinutes: 90
		});
	});

	it('falls back to an empty coach name when there are no coaches', () => {
		expect(blankClassRow([]).coach).toBe('');
	});
});
