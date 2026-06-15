import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ClassCard from './ClassCard.svelte';
import { CLASSES } from '$lib/admin/data';
import { fmtNT } from '$lib/admin/format';

/* ClassCard — one班級 card (admin.jsx ClassCard): level + status badges, name,
 * coach/time/room rows, an 報名人數 fill bar and the formatted季費. We assert the
 * key text renders and that opening fires the onOpen callback. */
const k = CLASSES[0]; // 競技啦啦隊 進階班 · 進階 · 招生中

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
