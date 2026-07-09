import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ActivityPanel from './ActivityPanel.svelte';
import type { Activity } from '$lib/admin/data';

/* 最新動態 activity feed (admin.jsx ActivityPanel). Task F11: data is injected via
 * the `activity` prop (real GET /reports/admin/activity mapping, admin/api.ts
 * getRecentActivity()) instead of the retired admin/data.ts ACTIVITY mock. Each item
 * is an icon chip (bg = item.bg, icon colour = item.tone) + text + time. */
const ACTIVITY: Activity[] = [
	{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '新會員註冊:謝佩珊', time: '2026-07-10 09:12' },
	{ icon: 'credit-card', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', text: '訂單 DF-24061 已付款:NT$4,800', time: '2026-07-10 08:40' }
];

describe('ActivityPanel', () => {
	it('renders every activity line and its timestamp', () => {
		const { container } = render(ActivityPanel, { activity: ACTIVITY });
		for (const a of ACTIVITY) {
			expect(container.textContent).toContain(a.text);
			expect(container.textContent).toContain(a.time);
		}
	});

	it('renders an icon svg for each activity item', () => {
		const { container } = render(ActivityPanel, { activity: ACTIVITY });
		// every item carries a (registered) icon chip; the chip svg renders.
		expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(ACTIVITY.length);
	});

	it('renders the panel header 最新動態', () => {
		const { container } = render(ActivityPanel, { activity: ACTIVITY });
		expect(container.textContent).toContain('最新動態');
	});

	it('renders no rows when activity is empty (e.g. 空庫)', () => {
		const { container } = render(ActivityPanel, { activity: [] });
		expect(container.querySelectorAll('.row').length).toBe(0);
	});
});
