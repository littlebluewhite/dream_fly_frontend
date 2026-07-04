import { describe, it, expect } from 'vitest';
import { levelToApi, scheduleTextOf, parseAgeRange, coachIdOf, buildCourseBody } from './course-request';
import { CLASSES, type ClassRow, type Coach } from '$lib/admin/data';

/* course-request.ts — 純函式，組出 POST/PATCH /courses body（Task 8 piece 1）。
 * 反向對照 admin/api.ts 唯讀映射用到的三個小函式（COURSE_LEVEL_TO_CLASS_LEVEL /
 * splitSchedule / ageRange）。全部無需渲染，直接測純函式輸出。 */

describe('levelToApi — 5 態本地分級 → 3 態後端 enum', () => {
	it('maps the 3 exact-match levels', () => {
		expect(levelToApi('入門')).toBe('beginner');
		expect(levelToApi('基礎')).toBe('intermediate');
		expect(levelToApi('進階')).toBe('advanced');
	});

	it('maps the 2 lossy extra levels to the nearest backend enum', () => {
		expect(levelToApi('啟蒙')).toBe('beginner');
		expect(levelToApi('選手')).toBe('advanced');
	});
});

describe('scheduleTextOf — day/time 組回 schedule_text（splitSchedule 的反向）', () => {
	it('combines day + time with a single space', () => {
		expect(scheduleTextOf('週二、四', '17:00-19:00')).toBe('週二、四 17:00-19:00');
	});

	it('day only (no time) returns day alone', () => {
		expect(scheduleTextOf('週日', '')).toBe('週日');
	});

	it('time only (no day) returns time alone', () => {
		expect(scheduleTextOf('', '15:00-16:30')).toBe('15:00-16:30');
	});

	it('both empty returns undefined (PATCH omits, POST sends no schedule)', () => {
		expect(scheduleTextOf('', '')).toBeUndefined();
		expect(scheduleTextOf('  ', '  ')).toBeUndefined();
	});
});

describe('parseAgeRange — age 顯示字串反向解析為 min_age/max_age（ageRange 的反向）', () => {
	it('parses a full "min–max 歲" range', () => {
		expect(parseAgeRange('8–14 歲')).toEqual({ min_age: 8, max_age: 14 });
	});

	it('parses "N 歲以上" (min only)', () => {
		expect(parseAgeRange('12 歲以上')).toEqual({ min_age: 12 });
	});

	it('parses "N 歲以下" (max only)', () => {
		expect(parseAgeRange('9 歲以下')).toEqual({ max_age: 9 });
	});

	it('empty string yields no keys at all (not both undefined values — absent)', () => {
		expect(parseAgeRange('')).toEqual({});
	});

	it('unrecognised free text yields no keys (never guesses)', () => {
		expect(parseAgeRange('國小以上')).toEqual({});
	});
});

describe('coachIdOf — coach 姓名比對 coaches 清單取得 id', () => {
	const coaches: Coach[] = [
		{ id: 'co1', name: '林雅婷', initial: '林', title: '教練', color: '#000', tags: [], years: 0, students: 0, awards: 0, classes: 0, status: 'offline', phone: '' },
		{ id: 'co2', name: '陳冠宇', initial: '陳', title: '教練', color: '#000', tags: [], years: 0, students: 0, awards: 0, classes: 0, status: 'offline', phone: '' }
	];

	it('finds the matching coach id by exact name', () => {
		expect(coachIdOf('陳冠宇', coaches)).toBe('co2');
	});

	it('returns undefined when no coach matches (including empty string)', () => {
		expect(coachIdOf('', coaches)).toBeUndefined();
		expect(coachIdOf('查無此人', coaches)).toBeUndefined();
	});
});

describe('buildCourseBody — ClassRow → 共用寫入 body（不含 duration_minutes）', () => {
	const coaches: Coach[] = [
		{ id: 'co1', name: '林雅婷', initial: '林', title: '教練', color: '#000', tags: [], years: 0, students: 0, awards: 0, classes: 0, status: 'offline', phone: '' }
	];

	it('assembles name/level/category/coach_id/schedule_text/age/price_cents/max_students', () => {
		const k: ClassRow = {
			...CLASSES[0],
			name: '測試班級',
			level: '進階',
			cat: '競技體操',
			coach: '林雅婷',
			day: '週二、四',
			time: '17:00-19:00',
			age: '8–14 歲',
			price: 4800,
			cap: 12
		};
		expect(buildCourseBody(k, coaches)).toEqual({
			name: '測試班級',
			level: 'advanced',
			category: '競技體操',
			coach_id: 'co1',
			schedule_text: '週二、四 17:00-19:00',
			min_age: 8,
			max_age: 14,
			price_cents: 480000,
			max_students: 12
		});
	});

	it('omits coach_id/schedule_text/age keys when there is nothing to derive them from', () => {
		const k: ClassRow = { ...CLASSES[0], coach: '', day: '', time: '', age: '' };
		const body = buildCourseBody(k, coaches);
		expect(body.coach_id).toBeUndefined();
		expect(body.schedule_text).toBeUndefined();
		expect(body.min_age).toBeUndefined();
		expect(body.max_age).toBeUndefined();
	});

	it('price_cents uses toCents (NT$ → cents), never a raw *100 inline', () => {
		const k: ClassRow = { ...CLASSES[0], price: 3200 };
		expect(buildCourseBody(k, coaches).price_cents).toBe(320000);
	});
});
