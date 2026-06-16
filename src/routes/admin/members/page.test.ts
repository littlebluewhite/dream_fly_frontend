import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MembersPage from './+page.svelte';

/* 學員管理 (admin.jsx MembersView): a PageHead (進階篩選 toggle) over the full
 * MembersTable. The 進階篩選 button toggles the MemberFilterPanel (previously it
 * fired a 開發中 toast). */
describe('學員管理 (+page)', () => {
	it('renders the PageHead title and the 進階篩選 toggle', () => {
		const { container } = render(MembersPage);
		const txt = container.textContent ?? '';
		expect(txt).toContain('學員管理');
		expect(txt).toContain('進階篩選');
	});

	it('toggles the MemberFilterPanel (套用/重設) when 進階篩選 is clicked', async () => {
		const { getByRole, getByText, queryByText } = render(MembersPage);
		// collapsed by default — the panel actions are not shown
		expect(queryByText('套用')).toBeNull();
		await fireEvent.click(getByRole('button', { name: /進階篩選/ }));
		expect(getByText('套用')).toBeInTheDocument();
		expect(getByText('重設')).toBeInTheDocument();
		// clicking again collapses it
		await fireEvent.click(getByRole('button', { name: /進階篩選/ }));
		expect(queryByText('套用')).toBeNull();
	});
});
