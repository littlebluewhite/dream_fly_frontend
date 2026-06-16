import { describe, it, expect } from 'vitest';
import { stepValid, TW_PHONE, type TrialState } from './trialValidation';

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
