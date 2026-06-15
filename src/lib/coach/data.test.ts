import { describe, it, expect } from 'vitest';
import {
	TODAY_CLASSES,
	STUDENTS,
	SCHED_DAYS,
	SCHED_HOURS,
	SCHED_COURSES,
	ATT_ROSTER,
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
});
