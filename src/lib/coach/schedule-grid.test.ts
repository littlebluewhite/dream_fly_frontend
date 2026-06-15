import { describe, it, expect } from 'vitest';
import { ROW_H, hourIdx, toY, dur } from './schedule-grid';

// SCHED_HOURS = ['08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00']
// idx:            0       1       2       3       4       5       6       7

describe('ROW_H', () => {
	it('is 64', () => {
		expect(ROW_H).toBe(64);
	});
});

describe('hourIdx', () => {
	it('08:00 → 0', () => expect(hourIdx('08:00')).toBe(0));
	it('14:00 → 4', () => expect(hourIdx('14:00')).toBe(4));
	it('17:00 → 7', () => expect(hourIdx('17:00')).toBe(7));
});

describe('toY', () => {
	it('08:00 === 0', () => expect(toY('08:00')).toBe(0));
	// 09:00 → idx 1, minutes 0 → 64*(1+0) = 64
	it('09:00 === 64', () => expect(toY('09:00')).toBe(64));
	// 09:30 → idx 1, minutes 30 → 64*(1+0.5) = 96
	it('09:30 === 96', () => expect(toY('09:30')).toBe(96));
	// 14:00 → idx 4, minutes 0 → 64*4 = 256
	it('14:00 === 256', () => expect(toY('14:00')).toBe(256));
});

describe('dur', () => {
	// 09:00→10:00: toY('10:00')-toY('09:00') = 128-64 = 64
	it('09:00 to 10:00 === 64', () => expect(dur('09:00', '10:00')).toBe(64));
	// 15:00→16:30: toY('16:30')-toY('15:00')
	//   toY('16:30') = 64*(6+0.5) = 416
	//   toY('15:00') = 64*5 = 320
	//   416-320 = 96
	it('15:00 to 16:30 === 96', () => expect(dur('15:00', '16:30')).toBe(96));
	// 17:00→18:00: clock duration 60min → 64 (end is one slot past the last SCHED_HOURS)
	it('17:00 to 18:00 === 64', () => expect(dur('17:00', '18:00')).toBe(64));
});
