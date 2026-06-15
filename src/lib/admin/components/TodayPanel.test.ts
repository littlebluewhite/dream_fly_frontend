import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TodayPanel from './TodayPanel.svelte';
import { TODAY } from '$lib/admin/data';

/* 今日課表 panel (admin.jsx TodayPanel). Renders every TODAY row — time, name,
 * coach·room·count meta — and a status Badge carrying the row's own tone+label. */
describe('TodayPanel', () => {
	it('renders every today-class name', () => {
		const { container } = render(TodayPanel);
		for (const t of TODAY) {
			expect(container.textContent).toContain(t.name);
		}
	});

	it('renders every status label', () => {
		const { container } = render(TodayPanel);
		for (const t of TODAY) {
			expect(container.textContent).toContain(t.label);
		}
	});

	it('renders the time and coach/room/count meta for each row', () => {
		const { container } = render(TodayPanel);
		for (const t of TODAY) {
			expect(container.textContent).toContain(t.time);
			expect(container.textContent).toContain(t.coach);
			expect(container.textContent).toContain(t.room);
			expect(container.textContent).toContain(String(t.count));
		}
	});

	it('renders the panel header 今日課表 with an overridable sub', () => {
		const { container } = render(TodayPanel, { sub: '全館 5 堂課' });
		expect(container.textContent).toContain('今日課表');
		expect(container.textContent).toContain('全館 5 堂課');
	});
});
