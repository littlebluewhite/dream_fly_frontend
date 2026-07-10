/* Dream Fly — report-math.ts 純函式單測(Round 4 P4-F1)。全函式邊界覆蓋：
 * null/0/空陣列/除以零。 */
import { describe, it, expect } from 'vitest';
import {
	deltaPct,
	pctShares,
	normalizeBars,
	topCoursesFrom,
	groupIncomeSources,
	revenueTrendVM,
	breakdownTotalCents,
	incomeSourcesVM,
	coachPerfVM,
	venueUsageVM,
	attDistVM,
	tierVM,
	weekdayVM,
	retentionVM,
	funnelVM,
	paymentVM,
	fmtHours,
	TIER_LABEL,
	REVENUE_SOURCE_LABEL,
	revenueSourceLabel,
	PAYMENT_METHOD_LABEL,
	paymentMethodLabel,
	WEEKDAY_LABEL,
	AGE_BUCKET_LABEL,
	ATTENDANCE_BUCKET_LABEL
} from './report-math';

describe('deltaPct — 環比 %', () => {
	it('計算正成長', () => {
		expect(deltaPct(150, 100)).toBe(50);
	});

	it('計算負成長(衰退)', () => {
		expect(deltaPct(50, 100)).toBe(-50);
	});

	it('current 為 0 時仍可計算(全額衰退)', () => {
		expect(deltaPct(0, 100)).toBe(-100);
	});

	it('last 為 0 → null(分母不成立，不除以 0)', () => {
		expect(deltaPct(100, 0)).toBeNull();
	});

	it('last 為負值 → null(防禦性，理論上不會發生但不產生誤導性數字)', () => {
		expect(deltaPct(100, -10)).toBeNull();
	});

	it('last 為 null → null', () => {
		expect(deltaPct(100, null)).toBeNull();
	});

	it('current 為 null → null(如 attendance_rate 該月無出勤資料)', () => {
		expect(deltaPct(null, 100)).toBeNull();
	});

	it('兩者皆 null → null', () => {
		expect(deltaPct(null, null)).toBeNull();
	});
});

describe('pctShares — 占比陣列', () => {
	it('依合計計算 0–1 占比', () => {
		expect(pctShares([25, 75])).toEqual([0.25, 0.75]);
	});

	it('單一元素占比恆為 1', () => {
		expect(pctShares([5])).toEqual([1]);
	});

	it('合計為 0 時全部回 0，不除以 0', () => {
		expect(pctShares([0, 0, 0])).toEqual([0, 0, 0]);
	});

	it('空陣列回空陣列', () => {
		expect(pctShares([])).toEqual([]);
	});
});

describe('normalizeBars — 長條圖正規化', () => {
	it('依陣列最大值正規化，預設 maxScale=100', () => {
		expect(normalizeBars([1, 2, 4])).toEqual([25, 50, 100]);
	});

	it('可指定 maxScale(如 0–1 比例值域)', () => {
		expect(normalizeBars([1, 2, 4], 1)).toEqual([0.25, 0.5, 1]);
	});

	it('全 0 時全部回 0，不除以 0', () => {
		expect(normalizeBars([0, 0, 0])).toEqual([0, 0, 0]);
	});

	it('空陣列回空陣列', () => {
		expect(normalizeBars([])).toEqual([]);
	});
});

describe('topCoursesFrom — 熱門課程 Top 5', () => {
	it('依 enrolled 降冪排序並標上 rank(陣列位置，非資料欄位)', () => {
		const courses = [
			{ name: 'A', enrolled: 10 },
			{ name: 'B', enrolled: 30 },
			{ name: 'C', enrolled: 20 }
		];
		expect(topCoursesFrom(courses)).toEqual([
			{ rank: 1, name: 'B', count: 30 },
			{ rank: 2, name: 'C', count: 20 },
			{ rank: 3, name: 'A', count: 10 }
		]);
	});

	it('超過 5 筆只取前 5', () => {
		const courses = Array.from({ length: 8 }, (_, i) => ({ name: `課程${i}`, enrolled: i }));
		const top = topCoursesFrom(courses);
		expect(top).toHaveLength(5);
		expect(top[0]).toEqual({ rank: 1, name: '課程7', count: 7 });
	});

	it('不足 5 筆回傳全部', () => {
		const courses = [{ name: 'A', enrolled: 3 }];
		expect(topCoursesFrom(courses)).toEqual([{ rank: 1, name: 'A', count: 3 }]);
	});

	it('空陣列回空陣列', () => {
		expect(topCoursesFrom([])).toEqual([]);
	});

	it('不修改輸入陣列(純函式)', () => {
		const courses = [
			{ name: 'A', enrolled: 1 },
			{ name: 'B', enrolled: 2 }
		];
		const copy = [...courses];
		topCoursesFrom(courses);
		expect(courses).toEqual(copy);
	});
});

describe('groupIncomeSources — 收入來源時間序列重塑', () => {
	it('依 source 分組、月序由舊到新排列', () => {
		const rows = [
			{ month: '2025-02', source: 'course', grossCents: 200 },
			{ month: '2025-01', source: 'course', grossCents: 100 },
			{ month: '2025-01', source: 'ticket', grossCents: 50 },
			{ month: '2025-02', source: 'ticket', grossCents: 60 }
		];
		expect(groupIncomeSources(rows)).toEqual([
			{
				source: 'course',
				points: [
					{ month: '2025-01', grossCents: 100 },
					{ month: '2025-02', grossCents: 200 }
				]
			},
			{
				source: 'ticket',
				points: [
					{ month: '2025-01', grossCents: 50 },
					{ month: '2025-02', grossCents: 60 }
				]
			}
		]);
	});

	it('缺的 (source, month) 組合零填，不缺點', () => {
		const rows = [
			{ month: '2025-01', source: 'course', grossCents: 100 },
			{ month: '2025-02', source: 'course', grossCents: 200 },
			{ month: '2025-01', source: 'ticket', grossCents: 50 }
			// ticket 缺 2025-02
		];
		const grouped = groupIncomeSources(rows);
		const ticket = grouped.find((s) => s.source === 'ticket');
		expect(ticket?.points).toEqual([
			{ month: '2025-01', grossCents: 50 },
			{ month: '2025-02', grossCents: 0 }
		]);
	});

	it('空陣列回空陣列', () => {
		expect(groupIncomeSources([])).toEqual([]);
	});
});

/* ═════════════ 逐面板 view-model(Round 2 C3)——固定兩 surface 既有算式的行為 ═════════════ */

describe('revenueTrendVM — 月營收趨勢', () => {
	it('total 為 12 月加總、max 為最大月(ReportsScreen fixture 驗算:總計 1,078,200)', () => {
		const vm = revenueTrendVM([{ h: 300000 }, { h: 320000 }, { h: 458200 }]);
		expect(vm.total).toBe(1078200);
		expect(vm.max).toBe(458200);
	});

	it('空庫全 0:total 0、max 保底 1(桌面 (h/max)*160 高度為 0,不產生 NaN)', () => {
		const vm = revenueTrendVM([{ h: 0 }, { h: 0 }, { h: 0 }]);
		expect(vm.total).toBe(0);
		expect(vm.max).toBe(1);
	});

	it('空陣列:total 0、max 保底 1', () => {
		expect(revenueTrendVM([])).toEqual({ total: 0, max: 1 });
	});
});

describe('breakdownTotalCents — 本月營收來源拆解合計', () => {
	it('合計取列本身 grossCents 加總(ReportsScreen fixture 驗算:41,040,000 cents)', () => {
		expect(breakdownTotalCents([{ grossCents: 31200000 }, { grossCents: 9840000 }])).toBe(41040000);
	});

	it('空陣列合計 0', () => {
		expect(breakdownTotalCents([])).toBe(0);
	});
});

describe('incomeSourcesVM — 收入來源分析', () => {
	it('每 source 12 月加總 + 0–1 占比(charts fixture 驗算:course 75% / ticket 25%)', () => {
		const vm = incomeSourcesVM([
			{ month: '2025-09', source: 'course', grossCents: 100000 },
			{ month: '2025-10', source: 'course', grossCents: 200000 },
			{ month: '2025-09', source: 'ticket', grossCents: 100000 },
			{ month: '2025-10', source: 'ticket', grossCents: 0 }
		]);
		expect(vm.totals).toEqual([
			{ source: 'course', totalCents: 300000 },
			{ source: 'ticket', totalCents: 100000 }
		]);
		expect(vm.shares).toEqual([0.75, 0.25]);
	});

	it('全 0 毛額:占比全 0,不除以 0', () => {
		const vm = incomeSourcesVM([{ month: '2025-09', source: 'course', grossCents: 0 }]);
		expect(vm.shares).toEqual([0]);
	});

	it('空陣列:totals/shares 皆空', () => {
		expect(incomeSourcesVM([])).toEqual({ totals: [], shares: [] });
	});
});

describe('coachPerfVM — 教練表現排行', () => {
	it('依 revenueCents12m 降冪排序並保留呼叫端欄位,寬度相對最大值(100/50)', () => {
		const rows = [
			{ id: 'co2', name: '陳大明', revenueCents12m: 42500000 },
			{ id: 'co1', name: '林雅婷', revenueCents12m: 85000000 }
		];
		const vm = coachPerfVM(rows);
		expect(vm.ranked.map((c) => c.name)).toEqual(['林雅婷', '陳大明']);
		expect(vm.widths).toEqual([100, 50]);
	});

	it('同額維持輸入序(sort 穩定性),且不變動輸入陣列', () => {
		const rows = [
			{ id: 'a', revenueCents12m: 100 },
			{ id: 'b', revenueCents12m: 100 }
		];
		const copy = [...rows];
		expect(coachPerfVM(rows).ranked.map((c) => c.id)).toEqual(['a', 'b']);
		expect(rows).toEqual(copy);
	});

	it('全零營收:零寬長條,不產生 NaN;空陣列回空', () => {
		expect(coachPerfVM([{ revenueCents12m: 0 }]).widths).toEqual([0]);
		expect(coachPerfVM([])).toEqual({ ranked: [], widths: [] });
	});
});

describe('venueUsageVM — 場館使用時數', () => {
	it('minutes 相對最忙場地 0–100(charts fixture 驗算:150/60 → 100%/40%)', () => {
		expect(venueUsageVM([{ minutes: 150 }, { minutes: 60 }])).toEqual([100, 40]);
	});

	it('空陣列回空陣列', () => {
		expect(venueUsageVM([])).toEqual([]);
	});
});

describe('attDistVM — 出席率分布', () => {
	it('count 柱高吃呼叫端 maxScale(桌面 110:最大桶滿高、其餘等比)', () => {
		const heights = attDistVM([{ count: 11 }, { count: 10 }, { count: 5 }, { count: 6 }], 110);
		expect(heights[0]).toBe(110);
		expect(heights[1]).toBeCloseTo(100, 10);
		expect(heights[2]).toBeCloseTo(50, 10);
		expect(heights[3]).toBeCloseTo(60, 10); // (6/11)*110,IEEE754 下為 59.999…
	});

	it('行動 84:最大桶滿高 84', () => {
		expect(attDistVM([{ count: 11 }, { count: 0 }], 84)).toEqual([84, 0]);
	});

	it('固定桶全零:全 0,不除以 0', () => {
		expect(attDistVM([{ count: 0 }, { count: 0 }], 110)).toEqual([0, 0]);
	});
});

describe('tierVM — 會員分級分布', () => {
	it('count 柱高吃呼叫端 maxScale(桌面 100:16 桶滿高)', () => {
		expect(tierVM([{ count: 10 }, { count: 16 }, { count: 13 }, { count: 9 }], 100)).toEqual([
			62.5, 100, 81.25, 56.25
		]);
	});

	it('行動 84:最大桶滿高 84、其餘等比', () => {
		expect(tierVM([{ count: 10 }, { count: 16 }], 84)).toEqual([52.5, 84]);
	});
});

describe('weekdayVM — 星期別出席負載', () => {
	it('presentCount 柱高(桌面 104)+ 最忙桶原始人次', () => {
		const rows = [9, 8, 11, 9, 12, 10, 14].map((presentCount) => ({ presentCount }));
		const vm = weekdayVM(rows, 104);
		expect(vm.max).toBe(14);
		expect(vm.heights[6]).toBe(104);
		expect(vm.heights[0]).toBeCloseTo((9 / 14) * 104, 10);
	});

	it('固定 7 桶全零:高度全 0、max 0(呼叫端不畫最忙強調)', () => {
		const vm = weekdayVM(Array.from({ length: 7 }, () => ({ presentCount: 0 })), 92);
		expect(vm.heights).toEqual([0, 0, 0, 0, 0, 0, 0]);
		expect(vm.max).toBe(0);
	});
});

describe('retentionVM — 新生 vs 回訪', () => {
	it('月總數疊柱高(桌面 116,最大月滿高)+ 末桶留存率', () => {
		const vm = retentionVM(
			[
				{ newCount: 14, returningCount: 38, rate: null },
				{ newCount: 24, returningCount: 52, rate: 0.884 }
			],
			116
		);
		expect(vm.heights[1]).toBe(116); // 24+52=76 為最大月
		expect(vm.heights[0]).toBeCloseTo((52 / 76) * 116, 10);
		expect(vm.lastRate).toBe(0.884);
	});

	it('末桶 rate null → null;全零月份柱高 0', () => {
		const vm = retentionVM([{ newCount: 0, returningCount: 0, rate: null }], 104);
		expect(vm.lastRate).toBeNull();
		expect(vm.heights).toEqual([0]);
	});

	it('空陣列:lastRate null、heights 空', () => {
		expect(retentionVM([], 116)).toEqual({ heights: [], lastRate: null });
	});
});

describe('funnelVM — 試上洽詢 → 報名 轉換', () => {
	it('條寬相對較大段、轉化率=報名/洽詢(charts fixture 驗算:142/318)', () => {
		const vm = funnelVM({ trialInquiries: 318, newEnrolments: 142 });
		expect(vm.widths[0]).toBe(100);
		expect(vm.widths[1]).toBeCloseTo((142 / 318) * 100, 10);
		expect(vm.conversion).toBe(142 / 318);
	});

	it('洽詢 0 → 轉化 null、條寬全 0,不除以 0', () => {
		expect(funnelVM({ trialInquiries: 0, newEnrolments: 0 })).toEqual({
			widths: [0, 0],
			conversion: null
		});
	});

	it('報名可能非全來自試上:>1 如實回傳,不封頂', () => {
		expect(funnelVM({ trialInquiries: 10, newEnrolments: 12 }).conversion).toBe(1.2);
	});
});

describe('paymentVM — 付款方式占比', () => {
	it('count 占比 0–1 + hasData(charts fixture 驗算:46/24)', () => {
		const vm = paymentVM([{ count: 46 }, { count: 24 }]);
		expect(vm.shares[0]).toBeCloseTo(46 / 70, 10);
		expect(vm.shares[1]).toBeCloseTo(24 / 70, 10);
		expect(vm.hasData).toBe(true);
	});

	it('空陣列/全零筆數:hasData false(呼叫端畫中性圓環),占比不除以 0', () => {
		expect(paymentVM([])).toEqual({ shares: [], hasData: false });
		expect(paymentVM([{ count: 0 }])).toEqual({ shares: [0], hasData: false });
	});
});

describe('fmtHours — 分鐘轉小時顯示字串', () => {
	it('整小時不顯示小數', () => {
		expect(fmtHours(60)).toBe('1 小時');
		expect(fmtHours(120)).toBe('2 小時');
	});

	it('半小時顯示 .5', () => {
		expect(fmtHours(90)).toBe('1.5 小時');
	});

	it('四捨五入至最近半小時', () => {
		expect(fmtHours(100)).toBe('1.5 小時'); // 100min=1h40m，較接近 1.5h
		expect(fmtHours(70)).toBe('1 小時'); // 70min=1h10m，較接近 1h
	});

	it('0 分鐘回「0 小時」，不產生 NaN', () => {
		expect(fmtHours(0)).toBe('0 小時');
	});
});

describe('TIER_LABEL — points_balance 分級桶對照', () => {
	it('4 桶固定序 regular/bronze/silver/gold → 一般/銅/銀/金', () => {
		expect(TIER_LABEL.regular.label).toBe('一般');
		expect(TIER_LABEL.bronze.label).toBe('銅');
		expect(TIER_LABEL.silver.label).toBe('銀');
		expect(TIER_LABEL.gold.label).toBe('金');
	});

	it('每桶皆帶代表色', () => {
		expect(TIER_LABEL.regular.color).toMatch(/^#/);
		expect(TIER_LABEL.bronze.color).toMatch(/^#/);
		expect(TIER_LABEL.silver.color).toMatch(/^#/);
		expect(TIER_LABEL.gold.color).toMatch(/^#/);
	});
});

describe('REVENUE_SOURCE_LABEL — 收入來源桶對照(P4-F2)', () => {
	it('6 個 canonical source key 對照中文標籤(product_type 三值對齊既有票券文案)', () => {
		expect(REVENUE_SOURCE_LABEL.course.label).toBe('課程報名');
		expect(REVENUE_SOURCE_LABEL.ticket.label).toBe('單次票券');
		expect(REVENUE_SOURCE_LABEL.membership.label).toBe('月票方案');
		expect(REVENUE_SOURCE_LABEL.course_package.label).toBe('課程套裝');
		expect(REVENUE_SOURCE_LABEL.merchandise.label).toBe('裝備週邊');
		expect(REVENUE_SOURCE_LABEL.venue_rental.label).toBe('場地租借');
	});

	it('每桶皆帶代表色(hex 或 CSS 變數)', () => {
		for (const { color } of Object.values(REVENUE_SOURCE_LABEL)) {
			expect(color).toMatch(/^#|^var\(--df-/);
		}
	});
});

/* Important #2(c)(d)(終審)：IncomeSources.svelte/ReportsScreen.svelte 原本把
 * groupIncomeSources() 攤平出的純字串 source 直接 `as keyof typeof
 * REVENUE_SOURCE_LABEL` 窄化 cast，再直接索引查表——查無 key(契約若擴集)會炸頁。
 * revenueSourceLabel() 是容忍未知 key 的查表版本，同 paymentMethodLabel 慣例。 */
describe('revenueSourceLabel — 容忍未知 source 的查表', () => {
	it('已知 key 回傳對應的 REVENUE_SOURCE_LABEL 項目', () => {
		expect(revenueSourceLabel('course')).toEqual(REVENUE_SOURCE_LABEL.course);
	});

	it('查無對應 key 時原字串穿透＋中性灰，不丟例外', () => {
		expect(revenueSourceLabel('gift_card')).toEqual({ label: 'gift_card', color: 'var(--df-text-muted)' });
	});
});

describe('PAYMENT_METHOD_LABEL / paymentMethodLabel — 付款方式對照', () => {
	it('6 個已知 key 對照中文標籤', () => {
		expect(PAYMENT_METHOD_LABEL.credit_card).toBe('信用卡');
		expect(PAYMENT_METHOD_LABEL.line_pay).toBe('LINE Pay');
		expect(PAYMENT_METHOD_LABEL.atm).toBe('ATM 轉帳');
		expect(PAYMENT_METHOD_LABEL.jkopay).toBe('街口支付');
		expect(PAYMENT_METHOD_LABEL.cash).toBe('現場付款');
		expect(PAYMENT_METHOD_LABEL.unknown).toBe('其他');
	});

	it('paymentMethodLabel() 查無對應 key 時原字串穿透，不丟例外', () => {
		expect(paymentMethodLabel('bank_transfer')).toBe('bank_transfer');
	});

	it('paymentMethodLabel() 對已知 key 回傳中文標籤', () => {
		expect(paymentMethodLabel('credit_card')).toBe('信用卡');
	});
});

describe('WEEKDAY_LABEL — weekday index 對照(0=週日)', () => {
	it('索引 0 為週日、6 為週六', () => {
		expect(WEEKDAY_LABEL[0]).toBe('日');
		expect(WEEKDAY_LABEL[6]).toBe('六');
	});

	it('完整 7 桶日一二三四五六', () => {
		expect(WEEKDAY_LABEL).toEqual(['日', '一', '二', '三', '四', '五', '六']);
	});
});

describe('AGE_BUCKET_LABEL — 年齡分布桶對照', () => {
	it('6 桶皆有中文標籤', () => {
		expect(AGE_BUCKET_LABEL['0-6']).toBe('0–6 歲');
		expect(AGE_BUCKET_LABEL['7-12']).toBe('7–12 歲');
		expect(AGE_BUCKET_LABEL['13-17']).toBe('13–17 歲');
		expect(AGE_BUCKET_LABEL['18-25']).toBe('18–25 歲');
		expect(AGE_BUCKET_LABEL['26-40']).toBe('26–40 歲');
		expect(AGE_BUCKET_LABEL['41+']).toBe('41 歲以上');
	});
});

describe('ATTENDANCE_BUCKET_LABEL — 出席率分布桶對照', () => {
	it('4 桶皆有中文標籤', () => {
		expect(ATTENDANCE_BUCKET_LABEL.gte_95).toBe('95–100%');
		expect(ATTENDANCE_BUCKET_LABEL['85_94']).toBe('85–94%');
		expect(ATTENDANCE_BUCKET_LABEL['75_84']).toBe('75–84%');
		expect(ATTENDANCE_BUCKET_LABEL.lt_75).toBe('低於 75%');
	});
});
