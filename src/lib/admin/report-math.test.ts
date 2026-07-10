/* Dream Fly — report-math.ts 純函式單測(Round 4 P4-F1)。全函式邊界覆蓋：
 * null/0/空陣列/除以零。 */
import { describe, it, expect } from 'vitest';
import {
	deltaPct,
	pctShares,
	normalizeBars,
	topCoursesFrom,
	groupIncomeSources,
	fmtHours,
	TIER_LABEL,
	REVENUE_SOURCE_LABEL,
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
