import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Input from './Input.svelte';

/* The settings password dialog needs a masked field, so Input grew an optional
 * `type` prop. Svelte forbids a dynamic `type` attribute alongside bind:value,
 * so it is applied via a use: action — these tests pin the resulting DOM type. */
describe('Input type prop', () => {
	it('defaults to a text input', () => {
		const { container } = render(Input, { label: '帳號' });
		expect(container.querySelector('input')?.type).toBe('text');
	});

	it('renders a masked password input when type="password"', () => {
		const { container } = render(Input, { label: '密碼', type: 'password' });
		expect(container.querySelector('input')?.type).toBe('password');
	});
});
