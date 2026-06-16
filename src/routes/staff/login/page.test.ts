import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/svelte';
import StaffLogin from './+page@.svelte';
import { COACH } from '$lib/coach/data';

// `enter()` calls goto() on a role card click; the portal render itself does not.
// Mock it so the module resolves and a stray click can never blow up the test.
vi.mock('$app/navigation', () => ({ goto: vi.fn() }));

describe('staff login — unified coach persona (guards the 陳教練 → 李教練 drift bug)', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.useRealTimers();
	});

	it('staff login portal shows the unified 李教練 persona, not 陳教練', async () => {
		const { container } = render(StaffLogin);

		// Step 1 → drive the credentials form so the flow advances to the RolePortal.
		await fireEvent.input(screen.getByPlaceholderText('請輸入員工帳號'), {
			target: { value: 'coach01' }
		});
		await fireEvent.input(screen.getByPlaceholderText('請輸入密碼'), {
			target: { value: 'pw' }
		});
		await fireEvent.click(screen.getByText('登入'));

		// submit() flips `authed` after a 600ms setTimeout.
		await vi.advanceTimersByTimeAsync(600);

		// Step 2: the RolePortal must show COACH.display and never the old 陳教練.
		expect(screen.getByText(`${COACH.display}，歡迎回來 👋`)).toBeInTheDocument();
		expect(screen.getByText(COACH.display)).toBeInTheDocument(); // welcome name line
		expect(container.textContent).not.toContain('陳教練');
		expect(screen.queryByText(/陳教練/)).toBeNull();
	});
});
