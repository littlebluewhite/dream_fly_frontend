import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import MessagesPage from './+page.svelte';
import { CONVERSATIONS, MSG_DIRECTORY, THREAD, SHARED_FILES } from '$lib/coach/data';
import { search } from '$lib/coach/stores';
import { getMessages } from '$lib/coach/api';

vi.mock('$lib/coach/api', () => ({ getMessages: vi.fn() }));

/* 訊息中心 — 撰寫 (compose). 撰寫 opens a Dialog listing MSG_DIRECTORY; picking a
 * recipient + confirming prepends a new conversation, selects it, and resets the
 * tab + search so the freshly-created thread isn't filtered away. Data now
 * arrives through the getMessages() seam (async), so every scenario first
 * awaits the ready phase (撰寫 button only renders once ready). */
const REC = MSG_DIRECTORY[0]; // 張媽媽

beforeEach(() => {
	search.set('');
	vi.mocked(getMessages).mockReset();
	vi.mocked(getMessages).mockResolvedValue({
		conversations: CONVERSATIONS,
		directory: MSG_DIRECTORY,
		thread: THREAD,
		sharedFiles: SHARED_FILES
	});
});

describe('/coach/messages (+page) — compose', () => {
	it('撰寫 opens a dialog listing the recipient directory', async () => {
		const { getByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		// directory recipients appear in the dialog.
		for (const r of MSG_DIRECTORY) expect(getByText(r.name)).toBeInTheDocument();
	});

	it('selecting a recipient + confirming adds the conversation and selects it', async () => {
		const { getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
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
		const { getByText, getAllByText, findByLabelText } = render(MessagesPage);
		await fireEvent.click(await findByLabelText('撰寫'));
		await fireEvent.click(getByText(REC.name));
		await fireEvent.click(getByText('建立對話'));
		// compose cleared the search → the new convo is not filtered away.
		expect(getAllByText(REC.name).length).toBeGreaterThanOrEqual(1);
		// the "沒有符合的對話" empty state must NOT be shown.
		expect(() => getByText('沒有符合的對話')).toThrow();
	});
});

describe('/coach/messages — 三態', () => {
	it('error:顯示「載入失敗」', async () => {
		vi.mocked(getMessages).mockReset();
		vi.mocked(getMessages).mockRejectedValue(new Error('network'));
		const { findByText } = render(MessagesPage);
		await findByText('載入失敗');
	});

	it('loading:顯示骨架', () => {
		vi.mocked(getMessages).mockReset();
		vi.mocked(getMessages).mockReturnValue(new Promise(() => {}));
		const { getByTestId } = render(MessagesPage);
		expect(getByTestId('messages-skeleton')).toBeTruthy();
	});
});
