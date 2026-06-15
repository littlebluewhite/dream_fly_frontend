import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ActivityPanel from './ActivityPanel.svelte';
import { ACTIVITY } from '$lib/admin/data';

/* 最新動態 activity feed (admin.jsx ActivityPanel). Each item is an icon chip
 * (bg = item.bg, icon colour = item.tone) + text + time. */
describe('ActivityPanel', () => {
	it('renders every activity line and its timestamp', () => {
		const { container } = render(ActivityPanel);
		for (const a of ACTIVITY) {
			expect(container.textContent).toContain(a.text);
			expect(container.textContent).toContain(a.time);
		}
	});

	it('renders an icon svg for each activity item', () => {
		const { container } = render(ActivityPanel);
		// every item carries a (registered) icon chip; the chip svg renders.
		expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(ACTIVITY.length);
	});

	it('renders the panel header 最新動態', () => {
		const { container } = render(ActivityPanel);
		expect(container.textContent).toContain('最新動態');
	});
});
