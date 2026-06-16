import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import Radio from './Radio.svelte';
import RadioFixture from './Radio.fixture.svelte';

describe('Radio', () => {
	it('renders a native radio input', () => {
		const { container } = render(Radio);
		expect(container.querySelector('input')?.type).toBe('radio');
	});

	it('renders the label text when label prop is given', () => {
		const { getByText } = render(Radio, { label: '月繳' });
		expect(getByText('月繳')).toBeTruthy();
	});

	it('shows the inner dot when group === value', () => {
		const { container } = render(Radio, { value: 'monthly', group: 'monthly', name: 'plan' });
		expect(container.querySelector('.inner')).toBeTruthy();
	});

	it('hides the inner dot when group !== value', () => {
		const { container } = render(Radio, { value: 'monthly', group: 'annual', name: 'plan' });
		expect(container.querySelector('.inner')).toBeNull();
	});

	it('disables the input and marks the label when disabled', () => {
		const { container } = render(Radio, { label: '月繳', disabled: true });
		expect(container.querySelector('input')?.disabled).toBe(true);
		expect(container.querySelector('label')?.classList.contains('disabled')).toBe(true);
	});

	it('moves selection to the clicked radio (mutual exclusion)', async () => {
		const { getByLabelText, getByTestId, container } = render(RadioFixture);
		expect(getByTestId('plan').textContent).toBe('monthly');

		await fireEvent.click(getByLabelText('年繳'));

		expect(getByTestId('plan').textContent).toBe('annual');
		expect(container.querySelectorAll('.inner')).toHaveLength(1);
	});

	it('forwards passthrough attributes to the native input', () => {
		const { container } = render(Radio, { 'aria-label': '方案' });
		expect(container.querySelector('input')?.getAttribute('aria-label')).toBe('方案');
	});

	it('warns when a grouped radio (group set) has no name', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		render(Radio, { value: 'monthly', group: 'monthly' });
		expect(warn).toHaveBeenCalled();
		warn.mockRestore();
	});

	it('does not warn when a grouped radio has a name', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		render(Radio, { value: 'monthly', group: 'monthly', name: 'plan' });
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
