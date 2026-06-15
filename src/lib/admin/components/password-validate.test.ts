import { describe, it, expect } from 'vitest';
import { validatePassword } from './password-validate';

/* Pure rules behind the 變更密碼 dialog: the new password must be non-empty and
 * must equal the confirmation. Mock-only, so `current` is never gated. */
describe('validatePassword', () => {
	it('rejects when new and confirm differ', () => {
		const r = validatePassword({ current: 'old', next: 'abcd1234', confirm: 'abcd9999' });
		expect(r.ok).toBe(false);
		expect(r.error).toBeTruthy();
	});

	it('rejects an empty new password', () => {
		const r = validatePassword({ current: 'old', next: '', confirm: '' });
		expect(r.ok).toBe(false);
		expect(r.error).toBeTruthy();
	});

	it('rejects an empty new password even if confirm is also empty (no silent pass)', () => {
		const r = validatePassword({ current: '', next: '', confirm: '' });
		expect(r.ok).toBe(false);
	});

	it('accepts a non-empty new password that matches confirm', () => {
		const r = validatePassword({ current: 'old', next: 'abcd1234', confirm: 'abcd1234' });
		expect(r.ok).toBe(true);
		expect(r.error).toBeUndefined();
	});
});
