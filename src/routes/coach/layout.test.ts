import { describe, vi, beforeEach, afterEach } from 'vitest';
import { readable } from 'svelte/store';

/* coach +layout 的頁面壽命:slot 以 {#key $lastSessionKey} 包住,換人即以新身分重掛載重抓。
 * 教練 layout 的 guard 讀 $authStore.roles,所以登入的身分帶 coach 角色。 */
vi.mock('$app/navigation', () => ({ goto: vi.fn(), afterNavigate: vi.fn() }));
vi.mock('$app/stores', () => ({
	page: readable({ url: new URL('http://localhost/coach') })
}));
vi.mock('$app/environment', () => ({ browser: true }));

vi.mock('$lib/stores/authStore', async () => {
	const { makeAuthMockA, FIXTURE_MEMBER } = await import('$lib/testing/auth-mock');
	return makeAuthMockA({
		roleFor: () => ['coach'],
		memberFor: (email) => ({ ...FIXTURE_MEMBER, id: email })
	});
});

vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

import { describePageLifetime } from '$lib/testing/page-lifetime';
import Layout from './+layout.svelte';

afterEach(() => vi.clearAllMocks());

describePageLifetime('coach +layout', Layout);
