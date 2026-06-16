import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import MessagesPage from './+page.svelte';
import { messages, coachMsgUnread } from '$lib/mobile-admin/stores';

describe('coach messages — opening a thread marks it read (codex P2 regression)', () => {
	it('lowers the coach unread badge when an unread thread row is tapped (was frozen on the static seed)', async () => {
		const firstUnread = get(messages).find((m) => m.unread);
		expect(firstUnread, 'seed should have an unread thread to open').toBeTruthy();
		const before = get(coachMsgUnread);

		const { getByText } = render(MessagesPage);
		await fireEvent.click(getByText(firstUnread!.from));

		expect(get(coachMsgUnread)).toBe(before - 1);
	});
});
