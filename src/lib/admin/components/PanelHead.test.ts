import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PanelHead from './PanelHead.svelte';

/* Panel header from shell.jsx PanelHead: title + optional sub + optional trailing
 * `right` node (icon or button). The React `right` node maps to a named slot `right`. */
describe('PanelHead', () => {
	it('renders the title and subtitle', () => {
		const { container } = render(PanelHead, { title: '學員名單', sub: '248 位在學學員' });
		expect(container.textContent).toContain('學員名單');
		expect(container.textContent).toContain('248 位在學學員');
	});

	it('renders the title alone when no subtitle is supplied', () => {
		const { container } = render(PanelHead, { title: '最新動態' });
		expect(container.textContent).toContain('最新動態');
	});

	it('renders the heading as an h3', () => {
		const { container } = render(PanelHead, { title: '今日課表' });
		expect(container.querySelector('h3')?.textContent).toContain('今日課表');
	});
});
