/* Dream Fly — store-warm.ts 單測(R14 候選 F3:member/api.ts 的 hydrateSessionStores 升格為
 * warmStores)。log 格式釘自 member/api.test.ts 的 getDashboard 雙端點失敗釘搬來——getDashboard
 * 已不再暖任何 store,格式改在 helper 本身釘住。 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { warmStores } from './store-warm';

afterEach(() => vi.restoreAllMocks());

describe('warmStores', () => {
	it('逐項平行執行;單項失敗 console.error 記錄「<caller>: <資源> hydrate 失敗」+ reason(逐字格式釘),不 throw', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const pointsError = new Error('points network down');
		const notifError = new Error('notifications network down');
		const ok = vi.fn(async () => {});

		await expect(
			warmStores('getDashboard', [
				['點數', () => Promise.reject(pointsError)],
				['訂閱', ok],
				['通知', () => Promise.reject(notifError)]
			])
		).resolves.toBeUndefined();

		expect(ok).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalledTimes(2);
		expect(errorSpy).toHaveBeenCalledWith('getDashboard: 點數 hydrate 失敗', pointsError);
		expect(errorSpy).toHaveBeenCalledWith('getDashboard: 通知 hydrate 失敗', notifError);
	});

	it('全部成功時不記錄任何錯誤', async () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await warmStores('x', [['通知', async () => {}]]);
		expect(errorSpy).not.toHaveBeenCalled();
	});
});
