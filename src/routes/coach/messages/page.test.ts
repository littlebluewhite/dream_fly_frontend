import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MessagesPage from './+page.svelte';
import { MSG_DIRECTORY } from '$lib/coach/data';
import { search } from '$lib/coach/stores';

/* 訊息中心 — 撰寫 (compose). 撰寫 opens a Dialog listing MSG_DIRECTORY; picking a
 * recipient + confirming prepends a new conversation, selects it, and resets the
 * tab + search so the freshly-created thread isn't filtered away. */
const REC = MSG_DIRECTORY[0]; // 張媽媽

describe('/coach/messages (+page) — compose', () => {
	beforeEach(() => search.set(''));

	it('撰寫 opens a dialog listing the recipient directory', async () => {
		const { getByLabelText, getByText } = render(MessagesPage);
		await fireEvent.click(getByLabelText('撰寫'));
		// directory recipients appear in the dialog.
		for (const r of MSG_DIRECTORY) expect(getByText(r.name)).toBeInTheDocument();
	});

	it('selecting a recipient + confirming adds the conversation and selects it', async () => {
		const { getByLabelText, getByText, getAllByText } = render(MessagesPage);
		await fireEvent.click(getByLabelText('撰寫'));
		// pick the recipient in the dialog.
		await fireEvent.click(getByText(REC.name));
		// confirm (建立對話 primary).
		await fireEvent.click(getByText('建立對話'));
		// the new conversation now appears in the left list AND as the active thread
		// header → its name renders at least twice.
		expect(getAllByText(REC.name).length).toBeGreaterThanOrEqual(2);
	});

	it('stays visible even when a stale search term would have filtered it out', async () => {
		// a search term matching none of the directory names.
		search.set('zzzz-no-match');
		const { getByLabelText, getByText, getAllByText } = render(MessagesPage);
		await fireEvent.click(getByLabelText('撰寫'));
		await fireEvent.click(getByText(REC.name));
		await fireEvent.click(getByText('建立對話'));
		// compose cleared the search → the new convo is not filtered away.
		expect(getAllByText(REC.name).length).toBeGreaterThanOrEqual(1);
		// the "沒有符合的對話" empty state must NOT be shown.
		expect(() => getByText('沒有符合的對話')).toThrow();
	});
});
