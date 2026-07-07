import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PaginationBar from './PaginationBar.svelte';

/* 共用分頁列（Task 17）— 純受控元件：page/total/perPage 皆由呼叫端傳入，換頁一律
 * 經 onPageChange(page) 通知，元件本身不持有 page 狀態、不自行重抓資料。 */
describe('PaginationBar', () => {
	it('renders "第 x 頁，共 M 筆" from page/total', () => {
		const { getByText } = render(PaginationBar, { page: 2, total: 45, perPage: 20 });
		expect(getByText('第 2 頁，共 45 筆')).toBeTruthy();
	});

	it('disables 上一頁 but not 下一頁 on the first page', () => {
		const { getByText } = render(PaginationBar, { page: 1, total: 45, perPage: 20 });
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('disables 下一頁 but not 上一頁 on the last page', () => {
		// ceil(45/20) = 3 頁
		const { getByText } = render(PaginationBar, { page: 3, total: 45, perPage: 20 });
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});

	it('enables both buttons on a middle page', () => {
		const { getByText } = render(PaginationBar, { page: 2, total: 45, perPage: 20 });
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(false);
	});

	it('disables both buttons when there is nothing to page through (total = 0)', () => {
		const { getByText } = render(PaginationBar, { page: 1, total: 0, perPage: 20 });
		expect((getByText('上一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
		expect((getByText('下一頁').closest('button') as HTMLButtonElement).disabled).toBe(true);
	});

	it('calls onPageChange(page - 1) when 上一頁 is clicked', async () => {
		const onPageChange = vi.fn();
		const { getByText } = render(PaginationBar, { page: 2, total: 45, perPage: 20, onPageChange });
		await fireEvent.click(getByText('上一頁'));
		expect(onPageChange).toHaveBeenCalledWith(1);
	});

	it('calls onPageChange(page + 1) when 下一頁 is clicked', async () => {
		const onPageChange = vi.fn();
		const { getByText } = render(PaginationBar, { page: 2, total: 45, perPage: 20, onPageChange });
		await fireEvent.click(getByText('下一頁'));
		expect(onPageChange).toHaveBeenCalledWith(3);
	});

	it('does not throw when onPageChange is omitted (default no-op)', async () => {
		const { getByText } = render(PaginationBar, { page: 2, total: 45, perPage: 20 });
		await expect(fireEvent.click(getByText('下一頁'))).resolves.not.toThrow();
	});
});
