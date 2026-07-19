import { describe, it, expect, vi } from 'vitest';

/* Task 20：mobile-admin/api.ts 從整包 reply() mock 改為 desktop admin/coach seams
 * 的薄層——這裡驗證每支函式「有呼叫到正確的桌面 seam、且回傳值有正確映射／原樣
 * 穿透」，而不是舊版驗證「回傳值等於 data.ts 的靜態 mock」（真資料不再是靜態常數）。
 * mock 兩個桌面 seam 模組，各函式各自驗證委派關係，同 mobile/api.test.ts(Task 19)
 * 的驗證風格。 */

vi.mock('$lib/admin/api', () => ({
	getVenues: vi.fn(),
	getTickets: vi.fn(),
	getCoaches: vi.fn(),
	getClasses: vi.fn(),
	createCourse: vi.fn(),
	updateCourse: vi.fn(),
	mapCourse: vi.fn(),
	getMembers: vi.fn(),
	createMember: vi.fn(),
	updateMember: vi.fn(),
	getOrders: vi.fn(),
	updateOrderStatus: vi.fn(),
	getReports: vi.fn(),
	getTodaySessions: vi.fn(),
	getRecentActivity: vi.fn(),
	getSettings: vi.fn(),
	putSettings: vi.fn()
}));
vi.mock('$lib/coach/api', () => ({
	getDashboard: vi.fn(),
	getAttendance: vi.fn(),
	saveAttendance: vi.fn(),
	getStudents: vi.fn(),
	getSettings: vi.fn(),
	saveSettings: vi.fn(),
	getConversations: vi.fn(),
	getThread: vi.fn(),
	sendMessage: vi.fn(),
	markRead: vi.fn(),
	createCertificate: vi.fn(),
	createReportCard: vi.fn(),
	CoachNotFoundError: class CoachNotFoundError extends Error {}
}));

import * as adminApi from '$lib/admin/api';
import * as coachApi from '$lib/coach/api';
import {
	getMore,
	getCoachHome,
	getAttendance,
	saveAttendance,
	getStudents,
	getCsettings,
	getAdminHome,
	getOpsCollections,
	getMessages,
	getSettings,
	putSettings,
	getVenues,
	getTickets
} from './api';
import { PROFILES } from './data';

describe('getMore', () => {
	it('resolves coaches/venues/tickets from the real admin seam (parallel), profiles stays mock', async () => {
		vi.mocked(adminApi.getCoaches).mockResolvedValue({ coaches: [{ id: 'c1' }] } as never);
		vi.mocked(adminApi.getVenues).mockResolvedValue({ venues: [{ id: 'v1' }] } as never);
		vi.mocked(adminApi.getTickets).mockResolvedValue({ tickets: [{ id: 't1' }], total: 1, page: 1, perPage: 20 } as never);

		const d = await getMore();

		expect(d).toEqual({
			profiles: PROFILES,
			coaches: [{ id: 'c1' }],
			venues: [{ id: 'v1' }],
			tickets: [{ id: 't1' }]
		});
	});
});

describe('getCoachHome', () => {
	it('resolves the real coach identity + today schedule + KPI counts from getDashboard()', async () => {
		vi.mocked(coachApi.getDashboard).mockResolvedValue({
			coach: { name: '林雅婷', display: '林教練' },
			todayLabel: '今天',
			todayClasses: [
				{ id: 't1', start: '09:00', end: '10:00', name: '測試班', room: 'A', count: 5, level: '基礎', cat: '體操', status: 'live' }
			],
			conversations: [],
			pendingClasses: '2 班',
			attendanceRate: '90%',
			pendingReplies: '3 則'
		} as never);

		const d = await getCoachHome();

		expect(d).toEqual({
			coach: { name: '林雅婷', display: '林教練' },
			coachToday: [{ time: '09:00', name: '測試班', room: 'A', count: 5, tone: 'success', label: '上課中' }],
			pendingClasses: '2 班',
			pendingReplies: '3 則'
		});
	});

	it('propagates CoachNotFoundError so the page can show 此帳號未綁定教練檔案', async () => {
		vi.mocked(coachApi.getDashboard).mockRejectedValue(new coachApi.CoachNotFoundError());
		await expect(getCoachHome()).rejects.toThrow();
	});
});

describe('getAttendance', () => {
	it('maps today’s classes + rosters from the real coach seam, supporting multiple classes', async () => {
		vi.mocked(coachApi.getAttendance).mockResolvedValue({
			classes: [
				{
					id: 's1',
					name: '競技啦啦隊 進階班',
					time: '今日 19:00–20:30',
					room: '',
					coach: '林雅婷',
					roster: [{ n: '01', name: '王小明', initial: '王', color: '#000', mid: 'en-1', def: 'present' }]
				}
			],
			failedClasses: []
		} as never);

		const d = await getAttendance();

		expect(d).toEqual({
			classes: [
				{
					id: 's1',
					label: '19:00 競技啦啦隊 進階班',
					roster: [{ id: 'en-1', name: '王小明', initial: '王', color: '#000', mid: 'en-1', default: 'present' }]
				}
			],
			failedClasses: []
		});
	});
});

describe('saveAttendance', () => {
	it('delegates to the real PUT /sessions/{id}/attendance and maps the response back to RosterEntry[]', async () => {
		vi.mocked(coachApi.saveAttendance).mockResolvedValue([
			{ n: '01', name: '王小明', initial: '王', color: '#000', mid: 'en-1', def: 'absent' }
		] as never);

		const rows = await saveAttendance('s1', { 'en-1': 'absent' });

		expect(coachApi.saveAttendance).toHaveBeenCalledWith('s1', { 'en-1': 'absent' });
		expect(rows).toEqual([{ id: 'en-1', name: '王小明', initial: '王', color: '#000', mid: 'en-1', default: 'absent' }]);
	});
});

describe('getStudents', () => {
	it('delegates to the real coach roster seam (GET /coaches/me/students) verbatim', async () => {
		const payload = { students: [{ user_id: 'u1', name: '王小明' }] };
		vi.mocked(coachApi.getStudents).mockResolvedValue(payload as never);
		expect(await getStudents()).toBe(payload);
	});
});

describe('getCsettings', () => {
	it('delegates to the real coach settings seam (GET /users/me + /coaches) verbatim', async () => {
		const payload = { coach: { name: '林雅婷' } };
		vi.mocked(coachApi.getSettings).mockResolvedValue(payload as never);
		expect(await getCsettings()).toBe(payload);
	});
});

describe('getAdminHome', () => {
	it('resolves the two real KPIs from getReports(), and real today/activity from getTodaySessions()/getRecentActivity() (Task F11), drops the removed KPIs', async () => {
		vi.mocked(adminApi.getReports).mockResolvedValue({
			revenue: { thisMonth: 182000, lastMonth: 0, trend: [] },
			members: { total: 300, newThisMonth: 5, active: 248 },
			courses: [],
			coaches: []
		} as never);
		vi.mocked(adminApi.getTodaySessions).mockResolvedValue({
			sessions: [
				{ time: '17:30', name: '兒童基礎 B 班', coach: '陳冠宇', room: 'B 教室', count: 8, state: 'live', tone: 'success', label: '進行中' },
				{ time: '20:00', name: '成人體操 基礎班', coach: '—', room: '—', count: 9, state: 'wait', tone: 'neutral', label: '尚未開始' }
			]
		} as never);
		vi.mocked(adminApi.getRecentActivity).mockResolvedValue({
			activity: [{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '新會員註冊:謝佩珊', time: '2026-07-10 09:12' }]
		} as never);

		const d = await getAdminHome();

		expect(d).toEqual({
			profiles: PROFILES,
			today: [
				{ time: '17:30', name: '兒童基礎 B 班', coach: '陳冠宇', room: 'B 教室', count: 8, tone: 'success', label: '進行中' },
				{ time: '20:00', name: '成人體操 基礎班', coach: '—', room: '—', count: 9, tone: 'neutral', label: '尚未開始' }
			],
			activity: [{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '新會員註冊:謝佩珊', time: '2026-07-10 09:12' }],
			enrolledValue: '248',
			revenueMonthValue: 'NT$182,000'
		});
	});

	it('propagates a null-mapped(「—」) coach/venue straight through from getTodaySessions() (already substituted upstream)', async () => {
		vi.mocked(adminApi.getReports).mockResolvedValue({
			revenue: { thisMonth: 0, lastMonth: 0, trend: [] },
			members: { total: 0, newThisMonth: 0, active: 0 },
			courses: [],
			coaches: []
		} as never);
		vi.mocked(adminApi.getTodaySessions).mockResolvedValue({
			sessions: [{ time: '08:00', name: '跑酷體驗班', coach: '—', room: '—', count: 3, state: 'wait', tone: 'neutral', label: '尚未開始' }]
		} as never);
		vi.mocked(adminApi.getRecentActivity).mockResolvedValue({ activity: [] } as never);

		const d = await getAdminHome();

		expect(d.today).toEqual([{ time: '08:00', name: '跑酷體驗班', coach: '—', room: '—', count: 3, tone: 'neutral', label: '尚未開始' }]);
	});
});

describe('getOpsCollections', () => {
	it('resolves members/classes/coaches/orders from the real admin seams (page 1, parallel)', async () => {
		vi.mocked(adminApi.getMembers).mockResolvedValue({ members: [{ id: 'm1' }], total: 1, page: 1, perPage: 20 } as never);
		vi.mocked(adminApi.getClasses).mockResolvedValue({ classes: [{ id: 'k1' }], coaches: [], total: 1, page: 1, perPage: 20 } as never);
		vi.mocked(adminApi.getCoaches).mockResolvedValue({ coaches: [{ id: 'c1' }] } as never);
		vi.mocked(adminApi.getOrders).mockResolvedValue({ orders: [{ id: 'o1' }], total: 1, page: 1, perPage: 20 } as never);

		const d = await getOpsCollections();

		expect(d).toEqual({ members: [{ id: 'm1' }], classes: [{ id: 'k1' }], coaches: [{ id: 'c1' }], orders: [{ id: 'o1' }] });
		expect(adminApi.getMembers).toHaveBeenCalledWith(1);
		expect(adminApi.getClasses).toHaveBeenCalledWith(1);
		expect(adminApi.getOrders).toHaveBeenCalledWith(1);
	});
});

describe('getMessages', () => {
	it('maps real conversations (GET /conversations/me) to the mobile message-list shape', async () => {
		vi.mocked(coachApi.getConversations).mockResolvedValue({
			conversations: [
				{ id: 'c1', name: '王媽媽', initial: '王', color: '#000', kind: '會員', time: '09:10', badge: 2, preview: '哈囉', sla: '', slaTone: 'muted' },
				{ id: 'c2', name: '陳爸爸', initial: '陳', color: '#000', kind: '會員', time: '昨天', badge: 0, preview: '謝謝', sla: '', slaTone: 'muted' }
			]
		} as never);

		const rows = await getMessages();

		expect(rows).toEqual([
			{ id: 'c1', from: '王媽媽', initial: '王', color: '#000', preview: '哈囉', time: '09:10', unread: true },
			{ id: 'c2', from: '陳爸爸', initial: '陳', color: '#000', preview: '謝謝', time: '昨天', unread: false }
		]);
	});
});

describe('getSettings / putSettings — 零映射 re-export（Task F9：GET/PUT /settings，桌面/行動共用同一組欄位）', () => {
	it('getSettings 直接委派給桌面 admin/api.ts 的 getSettings verbatim', async () => {
		const payload = {
			studioProfile: { name: 'X', phone: '', address: '', defaultRatio: '1:6', maxClassSize: 12 },
			notificationFlags: { email: true, sms: false, lowAtt: true, autoWait: true },
			security: { twoFA: true }
		};
		vi.mocked(adminApi.getSettings).mockResolvedValue(payload as never);
		expect(await getSettings()).toBe(payload);
	});

	it('putSettings 直接委派給桌面 admin/api.ts 的 putSettings，body 原樣傳遞 verbatim', async () => {
		const payload = {
			studioProfile: { name: 'Y', phone: '', address: '', defaultRatio: '1:6', maxClassSize: 12 },
			notificationFlags: { email: false, sms: false, lowAtt: false, autoWait: false },
			security: { twoFA: false }
		};
		vi.mocked(adminApi.putSettings).mockResolvedValue(payload as never);
		const body = { security: { twoFA: false } };

		expect(await putSettings(body)).toBe(payload);
		expect(adminApi.putSettings).toHaveBeenCalledWith(body);
	});
});

describe('getVenues / getTickets — 薄委派 re-export（C4：GET /venues、GET /products，場館/票券 push screen 消費）', () => {
	it('getVenues 直接委派給桌面 admin/api.ts 的 getVenues verbatim', async () => {
		const payload = { venues: [{ id: 'v1', slug: 'v-1', name: '場地甲', type: '', equip: [], status: 'available' }] };
		vi.mocked(adminApi.getVenues).mockResolvedValue(payload as never);
		expect(await getVenues()).toBe(payload);
	});

	it('getTickets 直接委派給桌面 admin/api.ts 的 getTickets，分頁參數原樣傳遞 verbatim', async () => {
		const payload = { tickets: [{ id: 't1', name: '票券甲' }], total: 1, page: 2, perPage: 20 };
		vi.mocked(adminApi.getTickets).mockResolvedValue(payload as never);

		expect(await getTickets(2)).toBe(payload);
		expect(adminApi.getTickets).toHaveBeenCalledWith(2);
	});
});
