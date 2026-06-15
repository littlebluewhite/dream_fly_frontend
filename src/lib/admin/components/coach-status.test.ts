import { describe, it, expect } from 'vitest';
import { coachStatus, COACH_STATUS } from './coach-status';

/* coach-status — pure map of CoachStatus → [label, cssColor]. Labels follow the
 * admin.jsx COACH_STATUS_OPTS (線上 / 忙碌 / 離線); colours mirror the Avatar
 * status dot (online→success green, busy→warning amber, offline→muted grey). */
describe('coachStatus', () => {
	it('online → 線上 + success (green) token', () => {
		expect(coachStatus('online')).toEqual(['線上', 'var(--df-success)']);
	});

	it('busy → 忙碌 + warning (amber) token', () => {
		expect(coachStatus('busy')).toEqual(['忙碌', 'var(--df-warning)']);
	});

	it('offline → 離線 + text-muted (grey) token', () => {
		expect(coachStatus('offline')).toEqual(['離線', 'var(--df-text-muted)']);
	});

	it('exposes the same data as the COACH_STATUS record', () => {
		expect(coachStatus('online')).toBe(COACH_STATUS.online);
		expect(Object.keys(COACH_STATUS)).toEqual(['online', 'busy', 'offline']);
	});
});
