import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import MobileTabBar from './TabBar.svelte';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/mobile') })
}));

afterEach(() => {
	vi.restoreAllMocks();
});

describe('mobile TabBar adapter — smoke tests', () => {
	it('renders all 5 TABS with correct labels', () => {
		render(MobileTabBar);

		expect(screen.getByText('首頁')).toBeInTheDocument();
		expect(screen.getByText('課程')).toBeInTheDocument();
		expect(screen.getByText('我的課程')).toBeInTheDocument();
		expect(screen.getByText('通知')).toBeInTheDocument();
		expect(screen.getByText('帳戶')).toBeInTheDocument();

		expect(screen.getAllByRole('link')).toHaveLength(5);
	});

	it('hrefs are driven by mobilePath (home → /mobile, others → /mobile/<id>)', () => {
		render(MobileTabBar);

		const links = screen.getAllByRole('link');
		// home tab → /mobile (surface root)
		expect(links.find((l) => l.textContent?.includes('首頁'))?.getAttribute('href')).toBe('/mobile');
		// courses tab → /mobile/courses
		expect(links.find((l) => l.textContent?.includes('課程'))?.getAttribute('href')).toBe(
			'/mobile/courses'
		);
	});
});
