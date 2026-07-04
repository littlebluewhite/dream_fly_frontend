import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { render, fireEvent } from '@testing-library/svelte';
import MemberFilterPanel from './MemberFilterPanel.svelte';
import { memberFilter, MEMBER_FILTER_DEFAULT } from '$lib/admin/stores';

/* MemberFilterPanel — the 進階篩選 collapsible Card on 學員管理. Task 5: retyped to
 * the real GET /users shape (MemberAccount) — 課程/繳費狀態/出席率區間 were removed
 * (P2, issue #8: no backend data source for course/pay/attendance on a plain user
 * account). Only 最低點數 remains (MemberAccount.points is real); 套用 commits it to
 * the memberFilter store, 重設 clears both the local field and the store. */
describe('MemberFilterPanel', () => {
	beforeEach(() => memberFilter.set({ ...MEMBER_FILTER_DEFAULT }));

	it('renders the 最低點數 field + 套用/重設 actions when open', () => {
		const { getByText, getByLabelText } = render(MemberFilterPanel, { open: true });
		expect(getByLabelText('最低點數')).toBeInTheDocument();
		expect(getByText('套用')).toBeInTheDocument();
		expect(getByText('重設')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(MemberFilterPanel, { open: false });
		expect(queryByText('套用')).toBeNull();
	});

	/* P2 (issue #8): 課程/繳費狀態/出席率區間 no longer exist — GET /users has no
	 * course/pay/attendance data. 狀態篩選改由 MembersTable 的全部/啟用中/已停用分頁籤負責。 */
	it('does not render the removed 報名課程/繳費狀態/出席率區間 fields', () => {
		const { queryByText, queryByLabelText } = render(MemberFilterPanel, { open: true });
		expect(queryByText('報名課程')).toBeNull();
		expect(queryByText('繳費狀態')).toBeNull();
		expect(queryByText('出席率區間')).toBeNull();
		expect(queryByLabelText('最低出席率')).toBeNull();
		expect(queryByLabelText('最高出席率')).toBeNull();
	});

	it('hydrates its field from the persisted store so an active filter stays visible', () => {
		memberFilter.set({ pointsMin: 500 });
		const { getByLabelText } = render(MemberFilterPanel, { open: true });
		expect((getByLabelText('最低點數') as HTMLInputElement).value).toBe('500');
	});

	it('套用 commits the 最低點數 to the memberFilter store', async () => {
		const { getByLabelText, getByText } = render(MemberFilterPanel, { open: true });
		await fireEvent.input(getByLabelText('最低點數'), { target: { value: '200' } });
		await fireEvent.click(getByText('套用'));
		expect(get(memberFilter).pointsMin).toBe(200);
	});

	it('重設 restores the store to the pass-through default', async () => {
		memberFilter.set({ pointsMin: 300 });
		const { getByText, getByLabelText } = render(MemberFilterPanel, { open: true });
		await fireEvent.click(getByText('重設'));
		expect(get(memberFilter).pointsMin).toBeUndefined();
		expect((getByLabelText('最低點數') as HTMLInputElement).value).toBe('');
	});

	it('leaves the store at pass-through when 套用 is clicked with no edits', async () => {
		const { getByText } = render(MemberFilterPanel, { open: true });
		await fireEvent.click(getByText('套用'));
		expect(get(memberFilter).pointsMin).toBeUndefined();
	});
});
