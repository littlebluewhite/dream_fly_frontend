import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ContactDialog from './ContactDialog.svelte';
import { CONTACT_THREAD } from '$lib/member/data';
import type { EnrolledCourse } from '$lib/member/data';

/* 聯絡教練 (Contact coach) — a local mock chat thread, reset each time the
 * dialog transitions to open (FE#19 scan target: found with the same
 * two-statement `wasOpen` bug as PasswordDialog). */

const COURSE: EnrolledCourse = {
	id: 'enrol-1',
	course_id: 'course-1',
	name: '競技啦啦隊 進階班',
	cat: '',
	level: '進階',
	coach: '林雅婷',
	icon: 'sparkles',
	color: '#0066CC',
	schedule: '',
	room: '',
	att: 0,
	attended: 0,
	total: 0,
	next: '',
	term: '',
	remain: 0
};

describe('ContactDialog', () => {
	it('renders nothing when closed', () => {
		const { queryByPlaceholderText } = render(ContactDialog, { open: false, course: COURSE });
		expect(queryByPlaceholderText('輸入訊息…')).toBeNull();
	});

	it('renders the composer and seeded thread when open', () => {
		const { getByPlaceholderText, getByText } = render(ContactDialog, { open: true, course: COURSE });
		expect(getByPlaceholderText('輸入訊息…')).toBeTruthy();
		expect(getByText(CONTACT_THREAD[0].text)).toBeTruthy();
	});

	// Regression (FE#19): the dialog is mounted once and toggles `open` on the
	// same instance. A two-stage `wasOpen` reactive pair (`$: if (open &&
	// !wasOpen) {…}` then a SEPARATE trailing `$: wasOpen = open;`) never
	// resets: Svelte topologically orders reactive statements by dependency, so
	// the `wasOpen` writer runs BEFORE the reader in the same flush, making
	// `!wasOpen` always false — a message typed-but-not-sent (or a sent message)
	// would survive close → reopen instead of the thread resetting.
	it('re-opening after close discards an unsent draft and any sent messages (not a fresh mount)', async () => {
		const { rerender, getByPlaceholderText, queryByText, getByText } = render(ContactDialog, {
			open: false,
			course: COURSE
		});

		await rerender({ open: true, course: COURSE });
		const input = getByPlaceholderText('輸入訊息…') as HTMLInputElement;
		await fireEvent.input(input, { target: { value: '髒草稿' } });
		await fireEvent.keyDown(input, { key: 'Enter' });
		expect(getByText('髒草稿')).toBeTruthy(); // sent into the thread

		await rerender({ open: false, course: COURSE }); // 關閉
		await rerender({ open: true, course: COURSE }); // 重新開啟同一個 instance

		expect(queryByText('髒草稿')).toBeNull();
		expect((getByPlaceholderText('輸入訊息…') as HTMLInputElement).value).toBe('');
	});
});
