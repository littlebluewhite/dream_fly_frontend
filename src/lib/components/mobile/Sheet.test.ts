import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import Sheet from './Sheet.svelte';
import SheetFixture from './Sheet.fixture.svelte';
import SheetNoFooterFixture from './Sheet.nofooter.fixture.svelte';

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

	it('footer gate: footer=true with NO footer slot renders no footer chrome', () => {
		// This test fails if the shell uses `{#if footer}` ignoring `$$slots.footer`:
		// a missing slot still passes the `footer` prop check, so the chrome div
		// would render (empty). The correct gate is `footer && $$slots.footer`.
		const { container } = render(SheetNoFooterFixture, { open: true, onClose: () => {} });
		// The footer chrome has a specific border-top style — assert it is absent.
		const footerDivs = Array.from(container.querySelectorAll('div')).filter((el) =>
			el.getAttribute('style')?.includes('border-top:1px solid var(--df-border)')
		);
		expect(footerDivs).toHaveLength(0);
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
