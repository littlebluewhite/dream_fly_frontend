import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Sheet from './Sheet.svelte';
import SheetFixture from './Sheet.fixture.svelte';

afterEach(() => {
	cleanup();
});

describe('Sheet — contract tests', () => {
	it('renders default slot content when open=true', () => {
		const { getByText } = render(SheetFixture, { open: true, onClose: () => {} });
		expect(getByText('DEFAULT_SLOT_CONTENT')).toBeTruthy();
	});

	it('footer gate: footer=true renders the footer slot content', () => {
		const { getByText } = render(SheetFixture, { open: true, onClose: () => {}, footer: true });
		expect(getByText('FOOTER_SLOT_CONTENT')).toBeTruthy();
	});

	it('footer gate: footer=false hides the footer slot content', () => {
		const { queryByText } = render(SheetFixture, {
			open: true,
			onClose: () => {},
			footer: false
		});
		expect(queryByText('FOOTER_SLOT_CONTENT')).toBeNull();
	});

	it('Escape keydown → onClose is called when open=true', async () => {
		const onClose = vi.fn();
		render(Sheet, { open: true, onClose });
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(onClose).toHaveBeenCalledOnce();
	});

	it('clicking the scrim → onClose is called', async () => {
		const onClose = vi.fn();
		const { container } = render(Sheet, { open: true, onClose });
		const scrim = container.querySelector('.df-scrim') as HTMLElement;
		await fireEvent.click(scrim);
		expect(onClose).toHaveBeenCalledOnce();
	});
});
