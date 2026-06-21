import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { readable, writable } from 'svelte/store';
import AdminTabBar from './TabBar.svelte';

vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/mobile-admin/admin') })
}));

afterEach(() => {
	vi.restoreAllMocks();
});

describe('m-admin TabBar adapter — smoke tests', () => {
	it('role=admin renders admin tab set (5 tabs: 總覽/學員/課程/訂單/更多)', () => {
		render(AdminTabBar, { role: 'admin' });

		expect(screen.getByText('總覽')).toBeInTheDocument();
		expect(screen.getByText('學員')).toBeInTheDocument();
		expect(screen.getByText('課程')).toBeInTheDocument();
		expect(screen.getByText('訂單')).toBeInTheDocument();
		expect(screen.getByText('更多')).toBeInTheDocument();

		expect(screen.getAllByRole('link')).toHaveLength(5);
	});

	it('role=coach renders coach tab set (5 tabs: 工作台/點名/學員/訊息/設定)', () => {
		render(AdminTabBar, { role: 'coach' });

		expect(screen.getByText('工作台')).toBeInTheDocument();
		expect(screen.getByText('點名')).toBeInTheDocument();
		expect(screen.getByText('學員')).toBeInTheDocument();
		expect(screen.getByText('訊息')).toBeInTheDocument();
		expect(screen.getByText('設定')).toBeInTheDocument();

		expect(screen.getAllByRole('link')).toHaveLength(5);
	});

	it('admin and coach tab sets are different (不同 role → 不同 tabs)', () => {
		const { unmount } = render(AdminTabBar, { role: 'admin' });
		const adminLabels = screen.getAllByRole('link').map((l) => l.textContent?.trim());
		unmount();

		render(AdminTabBar, { role: 'coach' });
		const coachLabels = screen.getAllByRole('link').map((l) => l.textContent?.trim());

		expect(adminLabels).not.toEqual(coachLabels);
	});
});
