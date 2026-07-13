import { describe, it, expect } from 'vitest';
import { stepValid, TW_PHONE, buildTrialInquiry, type TrialState } from './trialValidation';

const base: TrialState = { cat: '', age: '', day: '', slot: '', parent: '', phone: '', student: '' };

describe('stepValid step 0 (課程 + 年齡)', () => {
	it('requires both a course category and an age', () => {
		expect(stepValid(0, base)).toBe(false);
		expect(stepValid(0, { ...base, cat: '幼兒體操' })).toBe(false);
		expect(stepValid(0, { ...base, age: '3–5 歲' })).toBe(false);
		expect(stepValid(0, { ...base, cat: '幼兒體操', age: '3–5 歲' })).toBe(true);
	});
});

describe('stepValid step 1 (日期 + 時段)', () => {
	it('requires both a day and a slot', () => {
		expect(stepValid(1, { ...base, day: '06/14' })).toBe(false);
		expect(stepValid(1, { ...base, slot: 't1' })).toBe(false);
		expect(stepValid(1, { ...base, day: '06/14', slot: 't1' })).toBe(true);
	});
});

describe('stepValid step 2 (聯絡資料)', () => {
	const filled: TrialState = { ...base, parent: '王先生', phone: '0912-345-678', student: '小恩' };

	it('passes with name, valid phone, and student', () => {
		expect(stepValid(2, filled)).toBe(true);
	});
	it('fails on a blank / whitespace-only required field', () => {
		expect(stepValid(2, { ...filled, parent: '   ' })).toBe(false);
		expect(stepValid(2, { ...filled, student: '' })).toBe(false);
	});
	it('rejects a malformed phone', () => {
		expect(stepValid(2, { ...filled, phone: '12345' })).toBe(false);
		expect(stepValid(2, { ...filled, phone: '0812-345-678' })).toBe(false);
	});
});

describe('TW_PHONE', () => {
	it('accepts dashed, spaced, and bare 09xx numbers', () => {
		expect(TW_PHONE.test('0912-345-678')).toBe(true);
		expect(TW_PHONE.test('0912 345 678')).toBe(true);
		expect(TW_PHONE.test('0912345678')).toBe(true);
	});
	it('rejects wrong prefix or length', () => {
		expect(TW_PHONE.test('0812345678')).toBe(false);
		expect(TW_PHONE.test('091234567')).toBe(false);
	});
});

describe('stepValid step 3 (完成)', () => {
	it('is always open (no gate on the success step)', () => {
		expect(stepValid(3, base)).toBe(true);
	});
});

describe('buildTrialInquiry', () => {
	const filled: TrialState = { cat: '幼兒體操', age: '3–5 歲', day: '06/14', slot: 't1', parent: '王先生', phone: '0912-345-678', student: '小恩' };
	const lookup = {
		days: [{ d: '06/14', full: '2026/06/14 (六)' }],
		slots: [{ id: 't1', time: '10:00–11:15' }]
	};

	it('assembles the 8-field submitTrialInquiry body, resolving day/slot lookup hits to full/time', () => {
		expect(buildTrialInquiry(filled, '曾學過舞蹈', lookup)).toEqual({
			category: '幼兒體操',
			studentAge: '3–5 歲',
			preferredDay: '2026/06/14 (六)',
			preferredSlot: '10:00–11:15',
			parentName: '王先生',
			parentPhone: '0912-345-678',
			studentName: '小恩',
			note: '曾學過舞蹈'
		});
	});

	it('falls back to the raw day string when the day lookup misses', () => {
		const result = buildTrialInquiry({ ...filled, day: '99/99' }, '', lookup);
		expect(result.preferredDay).toBe('99/99');
	});

	it('falls back to the raw slot string when the slot lookup misses', () => {
		const result = buildTrialInquiry({ ...filled, slot: 'unknown' }, '', lookup);
		expect(result.preferredSlot).toBe('unknown');
	});

	it('passes an empty note through unchanged (not undefined/null)', () => {
		const result = buildTrialInquiry(filled, '', lookup);
		expect(result.note).toBe('');
	});
});
