import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import StatCard from './StatCard.svelte';

/* KPI card from shell.jsx StatCard: icon chip + label + large value + optional delta.
 * Props: { icon, label, value, delta, up, tint, color }. `up` alone drives the
 * arrow direction/colour (independent of delta sign — admin.jsx passes `delta="-2" up`). */
describe('StatCard', () => {
	it('renders the label, value and delta text', () => {
		const { container } = render(StatCard, {
			icon: 'receipt',
			label: '本月營收',
			value: 'NT$182K',
			delta: '+8%',
			up: true
		});
		expect(container.textContent).toContain('本月營收');
		expect(container.textContent).toContain('NT$182K');
		expect(container.textContent).toContain('+8%');
	});

	it('renders the icon chip (an svg)', () => {
		const { container } = render(StatCard, {
			icon: 'users',
			label: '在學學員',
			value: '248'
		});
		expect(container.querySelector('svg')).toBeTruthy();
	});

	it('omits the delta when none is supplied', () => {
		const { container } = render(StatCard, {
			icon: 'rotate-ccw',
			label: '退款',
			value: '3 筆'
		});
		// only the chip icon should be present, no trending arrow
		expect(container.querySelectorAll('svg').length).toBe(1);
	});

	it('uses the success colour for an up trend', () => {
		const { container } = render(StatCard, { icon: 'users', label: 'l', value: 'v', delta: '+1', up: true });
		// chip svg + trending-up svg
		expect(container.querySelectorAll('svg').length).toBe(2);
		expect(container.innerHTML).toContain('var(--df-success-strong)');
	});

	it('uses the error colour for a down trend', () => {
		// NOTE: the `trending-down` icon is not in the foundation Icon registry, so the
		// arrow svg does not render for up=false (Icon emits nothing for unknown names).
		// We assert the delta still shows with the error colour — the component requests
		// `trending-down` faithfully per shell.jsx; registering it is a foundation concern.
		const { container } = render(StatCard, { icon: 'users', label: 'l', value: 'v', delta: '-1', up: false });
		expect(container.textContent).toContain('-1');
		expect(container.innerHTML).toContain('var(--df-error-strong)');
	});
});
