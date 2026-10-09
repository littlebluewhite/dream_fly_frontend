import { describe, it, expect } from 'vitest';
import { ATT_STATE, attStateBadge } from './attendance';

describe('ATT_STATE — 出勤狀態查表', () => {
	it('matches the known 3-state literal (出席/請假/缺席)', () => {
		expect(ATT_STATE).toEqual({
			present: ['success', '出席'],
			leave: ['info', '請假'],
			absent: ['error', '缺席']
		});
	});
});

describe('attStateBadge — 出勤狀態查表自帶未知值後備', () => {
	it('三個已知值回 ATT_STATE 的 [tone, label]', () => {
		expect(attStateBadge('present')).toEqual(['success', '出席']);
		expect(attStateBadge('leave')).toEqual(['info', '請假']);
		expect(attStateBadge('absent')).toEqual(['error', '缺席']);
	});

	it('未知值 → [neutral, 原字串]，不是 undefined', () => {
		expect(attStateBadge('excused')).toEqual(['neutral', 'excused']);
	});

	it('Object.prototype 上的鍵（constructor 等）也走後備，不回繼承來的成員', () => {
		for (const k of ['constructor', 'toString', '__proto__']) {
			expect(attStateBadge(k)).toEqual(['neutral', k]);
		}
	});
});
