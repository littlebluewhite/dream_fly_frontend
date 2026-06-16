import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { render, fireEvent } from '@testing-library/svelte';
import MemberFilterPanel from './MemberFilterPanel.svelte';
import { memberFilter, MEMBER_FILTER_DEFAULT } from '$lib/admin/stores';

/* MemberFilterPanel — the 進階篩選 collapsible Card on 學員管理. Holds local field
 * state (課程 / 繳費 / 出席率 min-max); 套用 commits to the memberFilter store, 重設
 * clears both the local fields and the store. Defaults are pass-through so the
 * table is unchanged until 套用 narrows it. */
describe('MemberFilterPanel', () => {
	beforeEach(() => memberFilter.set({ ...MEMBER_FILTER_DEFAULT }));

	it('renders the field labels + 套用/重設 actions when open', () => {
		const { getByText } = render(MemberFilterPanel, { open: true });
		for (const lbl of ['報名課程', '繳費狀態', '出席率區間']) {
			expect(getByText(lbl)).toBeInTheDocument();
		}
		expect(getByText('套用')).toBeInTheDocument();
		expect(getByText('重設')).toBeInTheDocument();
	});

	it('renders nothing actionable when closed', () => {
		const { queryByText } = render(MemberFilterPanel, { open: false });
		expect(queryByText('套用')).toBeNull();
	});

	it('hydrates its fields from the persisted store so an active filter stays visible', () => {
		// codex round 2 P2: the store survives navigation, but the panel remounts —
		// it must reflect the active filter, not show blank/全部 while the table is narrowed.
		memberFilter.set({ course: '跑酷入門班', pay: 'due', attMin: 80, attMax: 95 });
		const { getByLabelText } = render(MemberFilterPanel, { open: true });
		expect((getByLabelText('報名課程') as HTMLSelectElement).value).toBe('跑酷入門班');
		expect((getByLabelText('繳費狀態') as HTMLSelectElement).value).toBe('due');
		expect((getByLabelText('最低出席率') as HTMLInputElement).value).toBe('80');
		expect((getByLabelText('最高出席率') as HTMLInputElement).value).toBe('95');
	});

	it('套用 commits the chosen 課程 + 繳費 to the memberFilter store', async () => {
		const { getByLabelText, getByText } = render(MemberFilterPanel, { open: true });
		await fireEvent.change(getByLabelText('報名課程'), { target: { value: '跑酷入門班' } });
		await fireEvent.change(getByLabelText('繳費狀態'), { target: { value: 'due' } });
		await fireEvent.click(getByText('套用'));
		const f = get(memberFilter);
		expect(f.course).toBe('跑酷入門班');
		expect(f.pay).toBe('due');
	});

	it('套用 commits the 出席率 min/max band to the store', async () => {
		const { getByLabelText, getByText } = render(MemberFilterPanel, { open: true });
		await fireEvent.input(getByLabelText('最低出席率'), { target: { value: '80' } });
		await fireEvent.input(getByLabelText('最高出席率'), { target: { value: '95' } });
		await fireEvent.click(getByText('套用'));
		const f = get(memberFilter);
		expect(f.attMin).toBe(80);
		expect(f.attMax).toBe(95);
	});

	it('重設 restores the store to the pass-through default', async () => {
		// seed a narrowed store first
		memberFilter.set({ course: '跑酷入門班', pay: 'due', attMin: 70, attMax: 80 });
		const { getByText } = render(MemberFilterPanel, { open: true });
		await fireEvent.click(getByText('重設'));
		const f = get(memberFilter);
		expect(f.course).toBe('');
		expect(f.pay).toBe('');
		expect(f.attMin).toBeUndefined();
		expect(f.attMax).toBeUndefined();
	});

	it('leaves the store at pass-through when 套用 is clicked with no edits', async () => {
		const { getByText } = render(MemberFilterPanel, { open: true });
		await fireEvent.click(getByText('套用'));
		const f = get(memberFilter);
		expect(f.course).toBe('');
		expect(f.pay).toBe('');
		expect(f.attMin).toBeUndefined();
		expect(f.attMax).toBeUndefined();
	});
});
