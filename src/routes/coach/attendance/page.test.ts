import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AttendancePage from './+page.svelte';
import { ATT_TODAY_CLASSES } from '$lib/coach/data';

/* 出勤記錄 — switch-class + undo.
 * Class/roster are stateful (curClassId); the 切換班級 CoachDropdown swaps the
 * roster and rebuilds marks. Each edit snapshots the WHOLE save-bar state so 復原
 * restores marks + dirtyCount + state. */
const C1 = ATT_TODAY_CLASSES[0]; // 兒童體操初階班 — has 王承恩
const C2 = ATT_TODAY_CLASSES[1]; // 青少年體操中級班 — has 周彥廷

describe('/coach/attendance (+page) — switch class', () => {
	it('opens on the first class roster (王承恩 visible)', () => {
		const { getByText } = render(AttendancePage);
		expect(getByText(C1.roster[0].name)).toBeInTheDocument(); // 王承恩
	});

	it('switching class swaps the roster and drops the old roster names', async () => {
		const { getByText, queryByText, getAllByText } = render(AttendancePage);
		// open the 切換班級 dropdown (CoachDropdown shows the current class name).
		const opener = getAllByText(C1.name).find((el) => el.closest('button'));
		await fireEvent.click(opener!);
		// pick the second class from the popover.
		const opt = getAllByText(C2.name).find((el) => el.closest('button'));
		await fireEvent.click(opt!);
		// new roster present, old roster gone.
		expect(getByText(C2.roster[0].name)).toBeInTheDocument(); // 周彥廷
		expect(queryByText(C1.roster[0].name)).toBeNull(); // 王承恩 gone
	});

	it('preserves a class draft when switching away and back', async () => {
		// codex round 2 P2: an unsaved edit must survive switching to another class
		// and back — switching must not silently reset the draft to defaults.
		const { getAllByText, container } = render(AttendancePage);
		// open the trigger (shows the current class `from`), then pick `to`.
		const switchTo = async (from: string, to: string) => {
			const opener = getAllByText(from).find((el) => el.closest('button'));
			await fireEvent.click(opener!);
			const opt = getAllByText(to).find((el) => el.closest('button'));
			await fireEvent.click(opt!);
		};
		// edit row 1 in C1 → 遲到, dirty climbs 3 → 4.
		const lateBtn = getAllByText('遲到').find((el) => el.tagName === 'BUTTON');
		await fireEvent.click(lateBtn!);
		expect(container.textContent).toContain('4 筆變更');
		// switch away to C2, then back to C1.
		await switchTo(C1.name, C2.name);
		await switchTo(C2.name, C1.name);
		// C1's draft is restored (still 4 筆變更, not reset to the default 3).
		expect(container.textContent).toContain('4 筆變更');
	});

	it('blocks switching class while a save is in flight (no stuck 儲存中 state)', async () => {
		// codex round 3 P1: a save started on A then a switch to B would stash A as
		// state:'saving'; the in-flight callback (keyed on the live state) never
		// completes A, leaving it stuck on 儲存中 forever. Block the switch instead.
		vi.useFakeTimers();
		try {
			const { getByText, getAllByText, queryByText, container } = render(AttendancePage);
			// start saving class C1 (bottom-bar 儲存點名 button) → state goes 'saving'.
			await fireEvent.click(getByText('儲存點名'));
			expect(container.textContent).toContain('儲存中');
			// attempt to switch to C2 while saving.
			const opener = getAllByText(C1.name).find((el) => el.closest('button'));
			await fireEvent.click(opener!);
			const opt = getAllByText(C2.name).find((el) => el.closest('button'));
			if (opt) await fireEvent.click(opt);
			// switch was blocked: still on C1 (王承恩 present, 周彥廷 absent).
			expect(getByText(C1.roster[0].name)).toBeInTheDocument();
			expect(queryByText(C2.roster[0].name)).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});
});

describe('/coach/attendance (+page) — undo', () => {
	it('an edit bumps the dirty count and reveals 復原; undo restores both', async () => {
		const { getByText, getAllByText, queryByText, container } = render(AttendancePage);
		// initial dirty count is 3 → bottom bar reads "3 筆變更".
		expect(container.textContent).toContain('3 筆變更');
		// no 復原 control before any unsaved edit.
		expect(queryByText('復原')).toBeNull();

		// edit row 1 (王承恩, default present) → click its 遲到 segment button.
		// "遲到" also appears as a stats-chip <span>; target the AttSegment <button>.
		const lateBtn = getAllByText('遲到').find((el) => el.tagName === 'BUTTON');
		await fireEvent.click(lateBtn!);

		// dirty count climbed to 4 and 復原 is now offered.
		expect(container.textContent).toContain('4 筆變更');
		expect(getByText('復原')).toBeInTheDocument();

		// undo → dirty count back to 3 and 復原 hidden again.
		await fireEvent.click(getByText('復原'));
		expect(container.textContent).toContain('3 筆變更');
		expect(queryByText('復原')).toBeNull();
	});
});
