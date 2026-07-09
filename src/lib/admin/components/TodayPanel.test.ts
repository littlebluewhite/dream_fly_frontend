import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TodayPanel from './TodayPanel.svelte';
import type { TodayClass } from '$lib/admin/data';

/* 今日課表 panel (admin.jsx TodayPanel). Task F11: data is injected via the
 * `sessions` prop (real GET /sessions/today mapping, admin/api.ts getTodaySessions())
 * instead of the retired admin/data.ts TODAY mock — renders every row's time, name,
 * coach·room·count meta, and a status Badge carrying the row's own tone+label. */
const SESSIONS: TodayClass[] = [
	{ time: '09:00', name: '兒童體操 初階班', coach: '黃詩涵', room: 'C 軟墊區', count: 6, state: 'done', tone: 'neutral', label: '已結束' },
	{ time: '17:30', name: '兒童基礎 B 班', coach: '陳冠宇', room: 'B 教室', count: 8, state: 'live', tone: 'success', label: '進行中' },
	{ time: '20:00', name: '成人體操 基礎班', coach: '王思齊', room: 'A 訓練館', count: 9, state: 'wait', tone: 'neutral', label: '尚未開始' }
];

describe('TodayPanel', () => {
	it('renders every session name', () => {
		const { container } = render(TodayPanel, { sessions: SESSIONS });
		for (const t of SESSIONS) {
			expect(container.textContent).toContain(t.name);
		}
	});

	it('renders every status label', () => {
		const { container } = render(TodayPanel, { sessions: SESSIONS });
		for (const t of SESSIONS) {
			expect(container.textContent).toContain(t.label);
		}
	});

	it('renders the time and coach/room/count meta for each row', () => {
		const { container } = render(TodayPanel, { sessions: SESSIONS });
		for (const t of SESSIONS) {
			expect(container.textContent).toContain(t.time);
			expect(container.textContent).toContain(t.coach);
			expect(container.textContent).toContain(t.room);
			expect(container.textContent).toContain(String(t.count));
		}
	});

	it('renders «—» for a session with a null-mapped coach/venue (Task F11 null handling)', () => {
		const withDash: TodayClass = { time: '11:00', name: '跑酷體驗班', coach: '—', room: '—', count: 3, state: 'wait', tone: 'neutral', label: '尚未開始' };
		const { container } = render(TodayPanel, { sessions: [withDash] });
		expect(container.textContent).toContain('— 教練 · — · 3 人');
	});

	it('renders the panel header 今日課表 with an overridable sub', () => {
		const { container } = render(TodayPanel, { sub: '全館 3 堂課', sessions: SESSIONS });
		expect(container.textContent).toContain('今日課表');
		expect(container.textContent).toContain('全館 3 堂課');
	});

	it('renders no rows when sessions is empty (e.g. 空庫或今日無場次)', () => {
		const { container } = render(TodayPanel, { sessions: [] });
		expect(container.querySelectorAll('.row').length).toBe(0);
	});
});
