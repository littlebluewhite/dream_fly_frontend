import { describe, it, expect } from 'vitest';
import { getMore, getCoachHome, getRoster } from './api';
import { PROFILES, COACHES, VENUES, TICKETS, COACH_TODAY, ROSTER } from './data';

describe('getMore', () => {
	it('resolves profiles + coaches + venues + tickets verbatim from data.ts', async () => {
		const d = await getMore();
		expect(d).toEqual({ profiles: PROFILES, coaches: COACHES, venues: VENUES, tickets: TICKETS });
	});
});

describe('getCoachHome', () => {
	it('resolves today’s coach schedule + profiles verbatim from data.ts', async () => {
		const d = await getCoachHome();
		expect(d).toEqual({ coachToday: COACH_TODAY, profiles: PROFILES });
	});
});

describe('getRoster', () => {
	it('resolves the attendance roster verbatim from data.ts', async () => {
		const d = await getRoster();
		expect(d).toEqual({ roster: ROSTER });
	});
});
