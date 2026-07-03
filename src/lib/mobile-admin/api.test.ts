import { describe, it, expect } from 'vitest';
import { getMore, getCoachHome } from './api';
import { PROFILES, COACHES, VENUES, TICKETS, COACH_TODAY } from './data';

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
