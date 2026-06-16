import { describe, it, expect } from 'vitest';
import { toneColor } from './tone';

describe('MiniBar toneColor — semantic tone mapping (codex P2 regression)', () => {
	it('maps tone="primary" to the --df-primary token (was passed through as invalid background:primary → transparent)', () => {
		expect(toneColor('primary')).toBe('var(--df-primary)');
	});

	it('maps the warning / success keywords to their tokens', () => {
		expect(toneColor('warning')).toBe('var(--df-warning)');
		expect(toneColor('success')).toBe('var(--df-success)');
	});

	it('passes raw colour values (hex / var) through unchanged', () => {
		expect(toneColor('#0066CC')).toBe('#0066CC');
		expect(toneColor('var(--df-accent)')).toBe('var(--df-accent)');
	});
});
