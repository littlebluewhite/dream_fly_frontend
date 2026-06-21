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

	it('badge gate: badge appears on the correct tab link and is absent on all others', () => {
		// 'courses' (index 1) gets badge 3; 'home' has 0; 'mine' absent from badges.
		render(TabBar, {
			tabs: SAMPLE_TABS,
			hrefFor,
			isActive,
			badges: { courses: 3, home: 0 }
		});

		const links = screen.getAllByRole('link');
		const homeLink = links[0]; // href=/mobile
		const coursesLink = links[1]; // href=/mobile/courses
		const mineLink = links[2]; // href=/mobile/mine

		// The badge span (text "3") must be a descendant of the courses link.
		const badgeInCourses = coursesLink.querySelector('span');
		expect(badgeInCourses).not.toBeNull();
		expect(badgeInCourses?.textContent).toBe('3');

		// No badge span inside the home link (count=0 → gate is false).
		expect(homeLink.querySelector('span[style*="border-radius:999px"]')).toBeNull();

		// No badge span inside the mine link (absent from badges → undefined > 0 is false).
		expect(mineLink.querySelector('span[style*="border-radius:999px"]')).toBeNull();
	});

	it('active state: shell delegates to injected isActive, not hardcoded path logic', () => {
		// $page is mocked to /mobile/courses.
		// We inject an isActive that deliberately marks 'home' (/mobile) as active —
		// the OPPOSITE of what the mocked path would indicate if the shell used the path
		// directly. This proves the shell calls the injected function, not its own path logic.
		const invertedIsActive = (href: string) => href === '/mobile'; // only home is active

		render(TabBar, { tabs: SAMPLE_TABS, hrefFor, isActive: invertedIsActive });

		const links = screen.getAllByRole('link');
		// home link (/mobile) — injected fn says active → primary color
		expect(links[0].getAttribute('style')).toContain('var(--df-primary)');
		// courses link (/mobile/courses) — injected fn says NOT active (doesn't match /mobile)
		expect(links[1].getAttribute('style')).toContain('var(--df-text-muted)');
		// mine link (/mobile/mine) — NOT active
		expect(links[2].getAttribute('style')).toContain('var(--df-text-muted)');
	});

	it('active label gets font-weight:700; inactive gets 500', () => {
		// Use the same inverted isActive so this test is independent of mocked path
		const invertedIsActive = (href: string) => href === '/mobile'; // home is active
		render(TabBar, { tabs: SAMPLE_TABS, hrefFor, isActive: invertedIsActive });

		// home is active (injected fn)
		const homeLabel = screen.getByText('首頁');
		expect(homeLabel.getAttribute('style')).toContain('font-weight: 700');

		// courses is not active
		const coursesLabel = screen.getByText('課程');
		expect(coursesLabel.getAttribute('style')).toContain('font-weight: 500');
	});
});
