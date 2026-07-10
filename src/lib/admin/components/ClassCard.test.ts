import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ClassCard from './ClassCard.svelte';
import type { ClassRow } from '$lib/admin/data';
import { fmtNT } from '$lib/admin/format';

/* ClassCard — one班級 card (admin.jsx ClassCard): level + status badges, name,
 * coach/time/room rows, an 報名人數 fill bar and the formatted季費. We assert the
 * key text renders and that opening fires the onOpen callback.
 *
 * Task 1(C2 死種子退役):admin/data.ts 的 CLASSES(值)已退役——改為檔內 inline
 * ClassRow fixture(沿用真實種子 k1 的欄位值)。 */
const k: ClassRow = { id: 'k1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', coach: '林雅婷', room: 'A 訓練館', day: '週二 / 週四', time: '19:00–20:30', enrolled: 11, cap: 12, age: '10–16 歲', price: 4800, status: '招生中', wait: 0, term: '2026 春季', sessions: 16, startDate: '2026/03/01', checkinRate: 86, makeup: 0, durationMinutes: 90 }; // 競技啦啦隊 進階班 · 進階 · 招生中

describe('ClassCard', () => {
	it('renders the class name', () => {
		const { getByText } = render(ClassCard, { k });
		expect(getByText(k.name)).toBeInTheDocument();
	});

	it('renders the level and status badge labels', () => {
		const { getByText } = render(ClassCard, { k });
		expect(getByText(k.level)).toBeInTheDocument();
		expect(getByText(k.status)).toBeInTheDocument();
	});

	it('renders the price via fmtNT', () => {
		const { container } = render(ClassCard, { k });
		expect(container.textContent).toContain(fmtNT(k.price));
	});

	it('shows the enrolled / cap count', () => {
		const { container } = render(ClassCard, { k });
		expect(container.textContent).toContain(`${k.enrolled} / ${k.cap}`);
	});

	it('fires onOpen when the card body is clicked', async () => {
		const onOpen = vi.fn();
		const { getByText } = render(ClassCard, { k, onOpen });
		await fireEvent.click(getByText(k.name));
		expect(onOpen).toHaveBeenCalledTimes(1);
	});

	it('fires onEdit from the 編輯 button', async () => {
		const onEdit = vi.fn();
		const { getByText } = render(ClassCard, { k, onEdit });
		await fireEvent.click(getByText('編輯'));
		expect(onEdit).toHaveBeenCalledTimes(1);
	});
});
