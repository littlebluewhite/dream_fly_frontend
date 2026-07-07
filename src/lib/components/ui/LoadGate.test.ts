import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/svelte';
import { writable } from 'svelte/store';
import { tick } from 'svelte';
import type { LoadGate, LoadPhase, PagedGateState, PagedLoadGate } from '$lib/load-gate';
import LoadGateFixture from './LoadGate.fixture.svelte';

afterEach(() => {
	cleanup();
});

/* fake flat 閘門:writable 直控 phase + load/refresh spy——比真 factory 更能
 * 直接切 phase,且可斷言 retry 走 refresh 而非 load(ADR 0008 知識收斂點)。 */
function makeFlatGate(initial: LoadPhase) {
	const store = writable<LoadPhase>(initial);
	const load = vi.fn(() => Promise.resolve());
	const refresh = vi.fn(() => Promise.resolve());
	const gate: LoadGate = { subscribe: store.subscribe, load, refresh, destroy: vi.fn() };
	return { gate, set: store.set, load, refresh };
}

/* fake paged 閘門:訂閱值是 { phase, page, total, perPage } 物件,驗證
 * LoadGate 對 union 另一分支($gate.phase 路徑)的解讀。 */
function makePagedGate(initial: Partial<PagedGateState> = {}) {
	const store = writable<PagedGateState>({
		phase: 'loading',
		page: 1,
		total: 0,
		perPage: 10,
		...initial
	});
	const load = vi.fn(() => Promise.resolve());
	const refresh = vi.fn();
	const gate: PagedLoadGate = {
		subscribe: store.subscribe,
		load,
		changePage: vi.fn(),
		refresh,
		silentRefresh: vi.fn(() => Promise.resolve()),
		destroy: vi.fn()
	};
	return { gate, set: store.set, load, refresh };
}

describe('LoadGate — 三態呈現契約', () => {
	it('loading 態:渲染 loading slot,不渲染 default slot 與錯誤畫面', () => {
		const { gate } = makeFlatGate('loading');
		const { getByText, queryByText } = render(LoadGateFixture, { gate });
		expect(getByText('LOADING_SLOT_CONTENT')).toBeTruthy();
		expect(queryByText('READY_SLOT_CONTENT')).toBeNull();
		expect(queryByText('載入失敗')).toBeNull();
	});

	it('error 態(flat)無覆寫 slot:fallback Card+ErrorState;retry 走 refresh 而非 load', async () => {
		const { gate, load, refresh } = makeFlatGate('error');
		const { getByText, getByRole, container } = render(LoadGateFixture, { gate });
		// ErrorState 預設 title(LoadGate 未傳 errorTitle → 沿用 ErrorState 預設)
		expect(getByText('載入失敗')).toBeTruthy();
		expect(container.querySelector('.card')).toBeTruthy();
		await fireEvent.click(getByRole('button', { name: /重新載入/ }));
		expect(refresh).toHaveBeenCalledOnce();
		expect(load).not.toHaveBeenCalled();
	});

	it('error 態(paged)覆寫 slot + let:retry:覆寫內容渲染、預設 ErrorState 不出現、retry 觸發 refresh', async () => {
		const { gate, load, refresh } = makePagedGate({ phase: 'error' });
		const { getByText, queryByText, getByRole } = render(LoadGateFixture, {
			gate,
			withErrorSlot: true
		});
		expect(getByText('ERROR_OVERRIDE_CONTENT')).toBeTruthy();
		expect(queryByText('載入失敗')).toBeNull();
		await fireEvent.click(getByRole('button', { name: 'OVERRIDE_RETRY' }));
		expect(refresh).toHaveBeenCalledOnce();
		expect(load).not.toHaveBeenCalled();
	});

	it('errorTitle/errorBody 轉發;phase error → ready 反應式切到 default slot', async () => {
		const { gate, set } = makeFlatGate('error');
		const { getByText, queryByText } = render(LoadGateFixture, {
			gate,
			errorTitle: '客製標題',
			errorBody: '客製說明文字'
		});
		expect(getByText('客製標題')).toBeTruthy();
		expect(getByText('客製說明文字')).toBeTruthy();
		expect(queryByText('載入失敗')).toBeNull();
		set('ready');
		await tick();
		expect(getByText('READY_SLOT_CONTENT')).toBeTruthy();
		expect(queryByText('客製標題')).toBeNull();
	});
});
