import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';

const goto = vi.hoisted(() => vi.fn());
vi.mock('$app/navigation', () => ({ goto }));

import RoleSheet from './RoleSheet.svelte';

beforeEach(() => goto.mockReset());

describe('RoleSheet', () => {
	it('選另一個身分 → goto 該身分首頁並關閉', async () => {
		const onClose = vi.fn();
		render(RoleSheet, { props: { role: 'admin', onClose } });
		await fireEvent.click(screen.getByText('教練工作台'));
		expect(goto).toHaveBeenCalledWith('/mobile-admin/coach');
		expect(onClose).toHaveBeenCalled();
	});

	it('選目前身分 → 不導覽,只關閉', async () => {
		const onClose = vi.fn();
		render(RoleSheet, { props: { role: 'coach', onClose } });
		await fireEvent.click(screen.getByText('教練工作台'));
		expect(goto).not.toHaveBeenCalled();
		expect(onClose).toHaveBeenCalled();
	});
});
