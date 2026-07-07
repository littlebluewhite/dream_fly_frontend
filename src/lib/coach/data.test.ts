import { describe, it, expect } from 'vitest';
import { LEVELS } from '$lib/domain/course-level';
import {
	TODAY_CLASSES,
	STUDENTS,
	SCHED_DAYS,
	SCHED_HOURS,
	SCHED_COURSES,
	ATT_ROSTER,
	ATT_CLASS,
	ATT_TODAY_CLASSES,
	CONVERSATIONS,
	THREAD,
	SHARED_FILES,
	NOTIFS,
	CLASS_STATUS,
	LEVEL_TINT,
	CAT_COLOR
} from './data';

describe('coach data — shape', () => {
	it('has the expected collection lengths', () => {
		expect(TODAY_CLASSES).toHaveLength(5);
		expect(STUDENTS).toHaveLength(12);
		expect(SCHED_DAYS).toHaveLength(7);
		expect(SCHED_HOURS).toHaveLength(8);
		expect(SCHED_COURSES).toHaveLength(10);
		expect(ATT_ROSTER).toHaveLength(11);
		expect(CONVERSATIONS).toHaveLength(6);
		expect(THREAD).toHaveLength(7);
		expect(SHARED_FILES).toHaveLength(2);
		expect(NOTIFS).toHaveLength(4);
	});

	it('marks exactly one schedule day as today (Sat 5/30)', () => {
		const today = SCHED_DAYS.filter((d) => d.today);
		expect(today).toHaveLength(1);
		expect(today[0].key).toBe('Sat');
	});
});

describe('coach data — referential integrity', () => {
	it('every TODAY_CLASSES.status resolves in CLASS_STATUS', () => {
		for (const c of TODAY_CLASSES) expect(CLASS_STATUS[c.status]).toBeDefined();
	});

	// FE#17: TodayClass.level now shares the same 5-level vocabulary as admin/
	// member (啟蒙/入門/基礎/進階/選手, $lib/domain/course-level) instead of the
	// old divergent TodayLevel type (初級/中級/啟蒙/高級/基礎).
	it('every TODAY_CLASSES.level is one of the shared 5 levels', () => {
		const valid = new Set(LEVELS);
		for (const c of TODAY_CLASSES) expect(valid.has(c.level)).toBe(true);
	});

	it('every STUDENTS.level resolves in LEVEL_TINT', () => {
		for (const s of STUDENTS) expect(LEVEL_TINT[s.level]).toBeDefined();
	});

	it('every SCHED_COURSES.cat resolves in CAT_COLOR', () => {
		for (const c of SCHED_COURSES) expect(CAT_COLOR[c.cat]).toBeDefined();
	});

	it('every ATT_ROSTER.def is a valid attendance default', () => {
		const valid = new Set(['present', 'late', 'leave', 'absent']);
		for (const r of ATT_ROSTER) expect(valid.has(r.def)).toBe(true);
	});

	it('every CONVERSATIONS.slaTone is a valid tone', () => {
		const valid = new Set(['warning', 'muted', 'error', 'success']);
		for (const c of CONVERSATIONS) expect(valid.has(c.slaTone)).toBe(true);
	});

	it('every THREAD message carries exactly one of text / attach / failed', () => {
		for (const m of THREAD) {
			const kinds = [m.text, m.attach, m.failed].filter((x) => x != null);
			expect(kinds).toHaveLength(1);
		}
	});

	it('every SCHED_COURSES.venue is one of the 3 valid venues', () => {
		const valid = new Set(['主場館', '競技訓練館', '副館']);
		for (const c of SCHED_COURSES) expect(valid.has(c.venue)).toBe(true);
	});
});

describe('coach data — ATT_TODAY_CLASSES (switch-class roster)', () => {
	it('has at least 3 classes', () => {
		expect(ATT_TODAY_CLASSES.length).toBeGreaterThanOrEqual(3);
	});

	it('first class reuses the existing ATT_CLASS + ATT_ROSTER', () => {
		expect(ATT_TODAY_CLASSES[0].roster).toBe(ATT_ROSTER);
		expect(ATT_TODAY_CLASSES[0].name).toBe(ATT_CLASS.name);
	});

	it('every class has a stable id and a non-empty roster', () => {
		const ids = new Set<string>();
		for (const c of ATT_TODAY_CLASSES) {
			expect(c.id).toBeTruthy();
			ids.add(c.id);
			expect(c.roster.length).toBeGreaterThan(0);
		}
		expect(ids.size).toBe(ATT_TODAY_CLASSES.length); // ids unique
	});
});
