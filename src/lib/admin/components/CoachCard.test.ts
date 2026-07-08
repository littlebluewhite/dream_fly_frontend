import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import CoachCard from './CoachCard.svelte';
import { COACHES, type Coach } from '$lib/admin/data';

/* CoachCard — the coach card from admin.jsx CoachesView. Renders name + title +
 * 專長 tags + a 公開顯示 status indicator (Task F5：取代原本的年資/學員/班級/獲獎
 * 統計格與線上/忙碌/離線狀態點，兩者皆無後端來源；isActive 是唯一有真實後端
 * 來源的狀態欄位，見 CoachCard.svelte 註解)。The pencil IconButton fires
 * onEdit(coach)。 */
const active: Coach = COACHES.find((c) => c.isActive)!; // 林雅婷
const inactive: Coach = COACHES.find((c) => !c.isActive)!; // 王思齊

describe('CoachCard', () => {
	it('renders the coach name, title and 專長 tags', () => {
		const { getByText } = render(CoachCard, { coach: active });
		expect(getByText(active.name)).toBeInTheDocument();
		expect(getByText(active.title)).toBeInTheDocument();
		for (const t of active.tags) {
			expect(getByText(t)).toBeInTheDocument();
		}
	});

	it('shows 公開顯示中 for an active (isActive:true) coach', () => {
		const { getByText } = render(CoachCard, { coach: active });
		expect(getByText('公開顯示中')).toBeInTheDocument();
	});

	it('shows 未公開顯示 for an inactive (isActive:false) coach', () => {
		const { getByText } = render(CoachCard, { coach: inactive });
		expect(getByText('未公開顯示')).toBeInTheDocument();
	});

	it('no longer renders the removed 年資/學員/班級/獲獎 stat grid (Task F5 欄位收斂)', () => {
		const { container } = render(CoachCard, { coach: active });
		const txt = container.textContent ?? '';
		for (const removed of ['年資', '學員', '班級', '獲獎']) {
			expect(txt).not.toContain(removed);
		}
	});

	it('fires onEdit(coach) when the edit pencil is clicked', async () => {
		const onEdit = vi.fn();
		const { getByLabelText } = render(CoachCard, { coach: active, onEdit });
		await fireEvent.click(getByLabelText('編輯教練'));
		expect(onEdit).toHaveBeenCalledTimes(1);
		expect(onEdit.mock.calls[0][0]).toEqual(active);
	});
});
