import { describe, it, expect } from 'vitest';
import { getMore } from './api';
import { PROFILES, COACHES, VENUES, TICKETS } from './data';

describe('getMore', () => {
	it('resolves profiles + coaches + venues + tickets verbatim from data.ts', async () => {
		const d = await getMore();
		expect(d).toEqual({ profiles: PROFILES, coaches: COACHES, venues: VENUES, tickets: TICKETS });
	});
});
