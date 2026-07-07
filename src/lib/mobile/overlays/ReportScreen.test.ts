import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import ReportScreen from './ReportScreen.svelte';
import { getReports } from '$lib/mobile/api';

/* Task 19 — ReportScreen 改真後端(復用桌面 getReports()，Task 13 seam)，取代
 * mock REPORTS/CERTS 常數與「評等字母/技巧熟練度/學習表現雷達圖」等後端沒有的
 * 欄位。改為列表呈現每一筆成績單(同桌面 /member/reports 頁)。 */
vi.mock('$lib/mobile/api', () => ({ getReports: vi.fn() }));

const FIXTURE = {
	reportCards: [
		{ id: 'r1', courseName: '競技啦啦隊 進階班', termLabel: '2026 春季', comment: '進步很多', rating: 4, issuerName: '林雅婷', createdAt: '2026-06-01T00:00:00Z' },
		{ id: 'r2', courseName: '兒童翻滾 技巧班', termLabel: '2026 春季', comment: null, rating: null, issuerName: '陳冠宇', createdAt: '2026-05-01T00:00:00Z' }
	],
	certificates: [
		{ id: 'c1', title: '結業證書', level: '結業', courseName: '競技啦啦隊 進階班', issuedOn: '2025-12-20', note: null, createdAt: '2025-12-20T00:00:00Z' }
	],
	stats: { attendedTotal: 20, attendanceRate: 90, pointsBalance: 500, activeEnrolments: 2, upcomingSessions7d: 1 }
};

beforeEach(() => {
	vi.mocked(getReports).mockReset();
	vi.mocked(getReports).mockResolvedValue(FIXTURE);
});

describe('ReportScreen — 三態 + 接縫 wiring', () => {
	it('loading 分支有可辨識骨架標記', () => {
		vi.mocked(getReports).mockReturnValue(new Promise(() => {}));
		const { container } = render(ReportScreen, { props: { onBack: () => {} } });
		expect(container.querySelector('[data-testid="report-skeleton"]')).not.toBeNull();
	});

	it('載入失敗顯示 ErrorState', async () => {
		vi.mocked(getReports).mockRejectedValue(new Error('boom'));
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
		vi.mocked(getReports).mockResolvedValue({ ...FIXTURE, reportCards: [] });
		render(ReportScreen, { props: { onBack: () => {} } });
		expect(await screen.findByText('教練完成本期評量後，成績單會顯示在這裡。')).toBeInTheDocument();
	});
});
