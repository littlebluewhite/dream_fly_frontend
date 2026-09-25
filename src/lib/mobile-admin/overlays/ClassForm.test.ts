import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ClassForm from './ClassForm.svelte';

describe('ClassForm — complete new record (codex P2 regression)', () => {
	// Task 2: the blank record now comes from blankClassRow() (course-request.ts,
	// shared with the desktop classes page) — startDate/checkinRate seed to
	// desktop's blank / 0 (not the old demo '2026/03/01' / 90), so this only
	// asserts the fields are DEFINED (no `undefined` in the detail sheet), not
	// truthy/positive.
	it('saves a full ClassRow (term/sessions/startDate/checkinRate seeded) so the detail sheet shows no undefined', async () => {
		const onSave = vi.fn();
		const { container, getByText } = render(ClassForm, { props: { onClose: () => {}, onSave } });
		const nameInput = container.querySelector('input') as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: '測試班' } });
		await fireEvent.click(getByText(/建立班級/).closest('button')!);

		expect(onSave).toHaveBeenCalledTimes(1);
		const rec = onSave.mock.calls[0][0];
		expect(rec.term).toBeTruthy();
		expect(rec.sessions).toBeGreaterThan(0);
		expect(rec.startDate).toBeDefined();
		expect(rec.checkinRate).toBeDefined();
		expect(typeof rec.wait === 'number' && typeof rec.makeup === 'number').toBe(true);
	});
});
