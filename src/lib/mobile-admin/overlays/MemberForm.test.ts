import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MemberForm from './MemberForm.svelte';

describe('MemberForm — option sourcing (codex P2 regression)', () => {
	it('populates the 報名課程 + 授課教練 selects from the stores when opened with no option props', () => {
		// The host (overlay.sheet('memberForm',{m:null})) passes no coaches/classes,
		// so the form must fall back to the live stores or the create flow is unusable.
		const { container } = render(MemberForm, { props: { onClose: () => {} } });
		const courseSel = container.querySelector('[id="df-sel-報名課程"]');
		const coachSel = container.querySelector('[id="df-sel-授課教練"]');
		expect(courseSel?.querySelectorAll('option').length ?? 0).toBeGreaterThan(0);
		expect(coachSel?.querySelectorAll('option').length ?? 0).toBeGreaterThan(0);
	});
});

describe('MemberForm — complete new record (codex P2 regression)', () => {
	it('saves a full MemberRow (recent/pay/campus/emergency seeded) so the detail sheet never throws', async () => {
		const onSave = vi.fn();
		const { container, getByText } = render(MemberForm, { props: { onClose: () => {}, onSave } });
		const nameInput = container.querySelector('input') as HTMLInputElement;
		await fireEvent.input(nameInput, { target: { value: '測試生' } });
		await fireEvent.click(getByText(/建立學員/).closest('button')!);

		expect(onSave).toHaveBeenCalledTimes(1);
		const rec = onSave.mock.calls[0][0];
		// the fields MemberSheet renders must all be present (recent drives {#each})
		expect(Array.isArray(rec.recent)).toBe(true);
		expect(rec.pay).toBeTruthy();
		expect(rec.campus).toBeTruthy();
		expect(rec.tier).toBeTruthy();
		expect('emName' in rec && 'emPhone' in rec).toBe(true);
	});
});
