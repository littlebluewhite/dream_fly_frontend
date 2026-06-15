import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CoachCard from './CoachCard.svelte';
import { COACHES, type Coach } from '$lib/admin/data';

/* CoachCard — the coach card from admin.jsx CoachesView. Renders name + title +
 * 專長 tags + the 4-up stat grid (年資/學員/班級/獲獎) + a status indicator (dot +
 * label from coach-status). The pencil IconButton fires onEdit(coach). */
const online: Coach = COACHES.find((c) => c.status === 'online')!; // 林雅婷
const busy: Coach = COACHES.find((c) => c.status === 'busy')!; // 黃詩涵
const offline: Coach = COACHES.find((c) => c.status === 'offline')!; // 王思齊

describe('CoachCard', () => {
	it('renders the coach name, title and 專長 tags', () => {
		const { getByText } = render(CoachCard, { coach: online });
		expect(getByText(online.name)).toBeInTheDocument();
		expect(getByText(online.title)).toBeInTheDocument();
		for (const t of online.tags) {
			expect(getByText(t)).toBeInTheDocument();
		}
	});

	it('renders the four stat labels 年資/學員/班級/獲獎', () => {
		const { getByText } = render(CoachCard, { coach: online });
		expect(getByText('年資')).toBeInTheDocument();
		expect(getByText('學員')).toBeInTheDocument();
		expect(getByText('班級')).toBeInTheDocument();
		expect(getByText('獲獎')).toBeInTheDocument();
	});

	it('renders the four stat values (年資/學員/班級/獲獎)', () => {
		const { getAllByText } = render(CoachCard, { coach: online });
		// each numeric value appears at least once in the stat grid
		for (const v of [online.years, online.students, online.classes, online.awards]) {
			expect(getAllByText(String(v)).length).toBeGreaterThan(0);
		}
	});

	it('shows the online status label (線上)', () => {
		const { getByText } = render(CoachCard, { coach: online });
		expect(getByText('線上')).toBeInTheDocument();
	});

	it('shows the busy status label (忙碌)', () => {
		const { getByText } = render(CoachCard, { coach: busy });
		expect(getByText('忙碌')).toBeInTheDocument();
	});

	it('shows the offline status label (離線)', () => {
		const { getByText } = render(CoachCard, { coach: offline });
		expect(getByText('離線')).toBeInTheDocument();
	});

	it('fires onEdit(coach) when the edit pencil is clicked', async () => {
		const onEdit = vi.fn();
		const { getByLabelText } = render(CoachCard, { coach: online, onEdit });
		await fireEvent.click(getByLabelText('編輯教練'));
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEdit.mock.calls[0][0]).toEqual(online);
	});
});
