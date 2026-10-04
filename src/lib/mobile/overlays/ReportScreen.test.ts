import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ReportScreen from './ReportScreen.svelte';
import { api } from '$lib/api/client';
import { fakeRouter } from '$lib/testing/fake-router';
import { memberReport, reportCard, certificate } from '$lib/testing/wire-fixtures';

/* Task 19 — ReportScreen 改真後端(復用桌面 getReports()，Task 13 seam)，取代
 * mock REPORTS/CERTS 常數與「評等字母/技巧熟練度/學習表現雷達圖」等後端沒有的
 * 欄位。改為列表呈現每一筆成績單(同桌面 /member/reports 頁)。Task 7(架構深化
 * R15·F-4)：mobile/api.ts 原本的純轉手 getReports() 已退役，本畫面直取桌面
 * seam，mock 目標同步改到擁有者模組。 */
vi.mock('$lib/api/client', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/api/client')>();
	return { ...actual, api: vi.fn() };
});

// W4c：只假造 HTTP(api())，真 getReports + mapper 跑起來；畫面文字斷言不變。
const REPORT_CARDS = [
	reportCard({ id: 'r1', course_name: '競技啦啦隊 進階班', term_label: '2026 春季', comment: '進步很多', rating: 4, created_by_name: '林雅婷', created_at: '2026-06-01T00:00:00Z' }),
	reportCard({ id: 'r2', course_name: '兒童翻滾 技巧班', term_label: '2026 春季', comment: null, rating: null, created_by_name: '陳冠宇', created_at: '2026-05-01T00:00:00Z' })
];
const CERTIFICATES = [
	certificate({ id: 'c1', title: '結業證書', level: '結業', course_name: '競技啦啦隊 進階班', issued_on: '2025-12-20', note: null, created_at: '2025-12-20T00:00:00Z' })
];

const route = (over: Record<string, unknown> = {}) =>
	vi.mocked(api).mockImplementation(
		fakeRouter(over, {
			'GET /report-cards/me': REPORT_CARDS,
			'GET /certificates/me': CERTIFICATES,
			'GET /reports/me': memberReport({ attended_total: 20, attendance_rate: 90, points_balance: 500, active_enrolments: 2, upcoming_sessions_7d: 1 })
		})
	);

beforeEach(() => {
	vi.mocked(api).mockReset();
	route();
});

describe('ReportScreen — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記', () => {
		vi.mocked(api).mockImplementation(() => new Promise(() => {}));
		const { container } = render(ReportScreen, { props: { onBack: () => {} } });
		expect(container.querySelector('[data-testid="report-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		route({ 'GET /report-cards/me': new Error('boom') });
		render(ReportScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('載入失敗')).toBeInTheDocument();
	});

	it('async 載入後以列表呈現每一筆成績單(有評分顯示星星、無評分顯示「尚未評分」)', async () => {
		render(ReportScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('競技啦啦隊 進階班')).toBeInTheDocument();
		expect(screen.getByText('進步很多')).toBeInTheDocument();
		expect(screen.getByText('教練尚未留下評語。')).toBeInTheDocument(); // r2 的 comment:null 誠實回退文字
		expect(screen.getByText('尚未評分')).toBeInTheDocument(); // r2 的 rating:null
	});

	it('沒有評等字母/技巧熟練度百分比/學習表現雷達圖 — 這些欄位後端沒有，不再假裝顯示', async () => {
		render(ReportScreen, { props: { onBack: () => {} } });
		await screen.findByText('競技啦啦隊 進階班');
		expect(screen.queryByText('學習表現')).toBeNull();
		expect(screen.queryByText('本季綜合評等')).toBeNull();
	});

	it('切到證書 tab 顯示真實證書資料', async () => {
		render(ReportScreen, { props: { onBack: () => {} } });
		await screen.findByText('競技啦啦隊 進階班');

		await fireEvent.click(screen.getByText('證書 / 獎狀'));

		expect(await screen.findByText('結業證書')).toBeInTheDocument();
		expect(screen.getByText('核發日 2025-12-20', { exact: false })).toBeInTheDocument();
	});

	it('沒有成績單時顯示誠實空狀態', async () => {
		route({ 'GET /report-cards/me': [] });
		render(ReportScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('教練完成本期評量後，成績單會顯示在這裡。')).toBeInTheDocument();
	});
});
