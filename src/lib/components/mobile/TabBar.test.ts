import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import TabBar from './TabBar.svelte';

// Shell reads $page.url.pathname for active state. Stub to /mobile/courses.
vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/mobile/courses') })
}));

afterEach(() => {
	vi.restoreAllMocks();
});

const SAMPLE_TABS = [
	{ id: 'home', label: '首頁', icon: 'house' },
	{ id: 'courses', label: '課程', icon: 'graduation-cap' },
	{ id: 'mine', label: '我的課程', icon: 'calendar-check' }
];

const hrefFor = (id: string) => (id === 'home' ? '/mobile' : `/mobile/${id}`);
const isActive = (href: string, path: string) =>
	href === '/mobile' ? path === '/mobile' : path.startsWith(href);

describe('TabBar shell — contract tests', () => {
	it('renders one link per tab with correct href and label', () => {
		render(TabBar, { tabs: SAMPLE_TABS, hrefFor, isActive });

		const links = screen.getAllByRole('link');
		expect(links).toHaveLength(3);

		expect(links[0].getAttribute('href')).toBe('/mobile');
		expect(links[1].getAttribute('href')).toBe('/mobile/courses');
		expect(links[2].getAttribute('href')).toBe('/mobile/mine');

		expect(screen.getByText('首頁')).toBeInTheDocument();
		expect(screen.getByText('課程')).toBeInTheDocument();
		expect(screen.getByText('我的課程')).toBeInTheDocument();
	});

	it('badge gate: badges={{ x: 3 }} shows badge; badges={{ x: 0 }} or absent does not', () => {
		// 'courses' (index 1) gets badge 3; 'home' has 0; 'mine' absent from badges.
		render(TabBar, {
			tabs: SAMPLE_TABS,
			hrefFor,
			isActive,
			badges: { courses: 3, home: 0 }
		});

		// badge 3 is visible
		expect(screen.getByText('3')).toBeInTheDocument();

		// home badge = 0 → no badge span rendered for home (0 is falsy guard)
		// mine is absent from badges → no badge span
		// Only one badge span should exist (for courses)
		const badgeSpans = screen
			.queryAllByText(/^\d+$/)
			.filter((el) => el.tagName.toLowerCase() === 'span');
		expect(badgeSpans).toHaveLength(1);
		expect(badgeSpans[0].textContent).toBe('3');
	});

	it('active state: tab matching $page path gets primary color; others get muted', () => {
		// $page is mocked to /mobile/courses → 'courses' tab should be active
		render(TabBar, { tabs: SAMPLE_TABS, hrefFor, isActive });

		const links = screen.getAllByRole('link');
		// home link = /mobile — not active on /mobile/courses
		expect(links[0].getAttribute('style')).toContain('var(--df-text-muted)');
		// courses link = /mobile/courses — active (path.startsWith matches)
		expect(links[1].getAttribute('style')).toContain('var(--df-primary)');
		// mine link = /mobile/mine — not active
		expect(links[2].getAttribute('style')).toContain('var(--df-text-muted)');
	});

	it('active label gets font-weight:700; inactive gets 500', () => {
		render(TabBar, { tabs: SAMPLE_TABS, hrefFor, isActive });

		// courses is active (path=/mobile/courses)
		const coursesLabel = screen.getByText('課程');
		expect(coursesLabel.getAttribute('style')).toContain('font-weight: 700');

		// home is not active
		const homeLabel = screen.getByText('首頁');
		expect(homeLabel.getAttribute('style')).toContain('font-weight: 500');
	});
});
