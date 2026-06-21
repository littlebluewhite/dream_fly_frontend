import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { search } from './stores';

describe('admin search store', () => {
	it('is a writable string store starting empty', () => {
		expect(get(search)).toBe('');
		search.set('王');
		expect(get(search)).toBe('王');
		search.set('');
	});
});
