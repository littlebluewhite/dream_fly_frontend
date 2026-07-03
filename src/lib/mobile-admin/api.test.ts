import { describe, it, expect } from 'vitest';
import { getMore, getCoachHome, getRoster, getStudents, getCsettings, getAdminHome, getOpsCollections, getMessages } from './api';
import { PROFILES, COACHES, VENUES, TICKETS, COACH_TODAY, ROSTER, MEMBERS, SKILLS, TODAY, ACTIVITY, CLASSES, ORDERS, MESSAGES } from './data';

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

describe('getStudents', () => {
	it('resolves members + skill assessments verbatim from data.ts', async () => {
		const d = await getStudents();
		expect(d).toEqual({ members: MEMBERS, skills: SKILLS });
	});
});

describe('getCsettings', () => {
	it('resolves profiles + coaches verbatim from data.ts', async () => {
		const d = await getCsettings();
		expect(d).toEqual({ profiles: PROFILES, coaches: COACHES });
	});
});

describe('getAdminHome', () => {
	it('resolves profiles + members + today + activity verbatim from data.ts', async () => {
		const d = await getAdminHome();
		expect(d).toEqual({ profiles: PROFILES, members: MEMBERS, today: TODAY, activity: ACTIVITY });
	});
});

describe('getOpsCollections', () => {
	it('resolves members/classes/coaches/orders equal in content to data.ts', async () => {
		const d = await getOpsCollections();
		expect(d).toEqual({ members: MEMBERS, classes: CLASSES, coaches: COACHES, orders: ORDERS });
	});

	it('clones every record so mutating the resolved value cannot leak back into data.ts (防共享參照)', async () => {
		const d = await getOpsCollections();
		d.members[0].name = '被污染';
		d.classes[0].name = '被污染';
		d.coaches[0].name = '被污染';
		d.orders[0].member = '被污染';
		expect(MEMBERS[0].name).not.toBe('被污染');
		expect(CLASSES[0].name).not.toBe('被污染');
		expect(COACHES[0].name).not.toBe('被污染');
		expect(ORDERS[0].member).not.toBe('被污染');
	});
});

describe('getMessages', () => {
	it('resolves the coach message threads equal in content to data.ts', async () => {
		const d = await getMessages();
		expect(d).toEqual(MESSAGES);
	});

	it('clones every record so mutating the resolved value cannot leak back into data.ts (防共享參照)', async () => {
		const d = await getMessages();
		d[0].from = '被污染';
		expect(MESSAGES[0].from).not.toBe('被污染');
	});
});
