import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PageHead from './PageHead.svelte';

/* Section header from shell.jsx PageHead: title + optional sub + optional trailing
 * actions. The React `actions` node maps to a named slot `actions`. */
describe('PageHead', () => {
	it('renders the title and subtitle', () => {
		const { container } = render(PageHead, { title: '營運總覽', sub: '全館即時概況' });
		expect(container.textContent).toContain('營運總覽');
		expect(container.textContent).toContain('全館即時概況');
	});

	it('renders the title alone when no subtitle is supplied', () => {
		const { container } = render(PageHead, { title: '系統設定' });
		expect(container.textContent).toContain('系統設定');
	});

	it('renders the heading as an h2', () => {
		const { container } = render(PageHead, { title: '學員管理' });
		expect(container.querySelector('h2')?.textContent).toContain('學員管理');
	});
});
