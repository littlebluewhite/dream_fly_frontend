/* load-error-copy.ts — coach 載入錯誤文案單源的單元測試。5 case：真 CoachNotFoundError
 * 實例 / name-only 假物（頁面測試把 $lib/coach/api 換成假模組時錯誤的實際形狀）/
 * 泛用 Error / 非 Error 值 / GENERIC 字面（各頁初始值單源）。 */
import { describe, it, expect } from 'vitest';
import { coachLoadErrorCopy, GENERIC_LOAD_ERROR } from './load-error-copy';
import { CoachNotFoundError } from './api';

describe('coachLoadErrorCopy — name-based 判別', () => {
	it('真 CoachNotFoundError 實例 → 「未綁定教練檔案」文案', () => {
		expect(coachLoadErrorCopy(new CoachNotFoundError())).toEqual({
			errorTitle: '此帳號未綁定教練檔案',
			errorBody: '請聯繫系統管理員協助設定教練檔案。'
		});
	});

	it('name-only 假物（一般 Error 改 name）→ 同樣命中，不依賴 instanceof CoachNotFoundError', () => {
		const fake = new Error('此帳號未綁定教練檔案');
		fake.name = 'CoachNotFoundError';
		expect(coachLoadErrorCopy(fake)).toEqual({
			errorTitle: '此帳號未綁定教練檔案',
			errorBody: '請聯繫系統管理員協助設定教練檔案。'
		});
	});

	it('泛用 Error → GENERIC_LOAD_ERROR', () => {
		expect(coachLoadErrorCopy(new Error('network'))).toBe(GENERIC_LOAD_ERROR);
	});

	it('非 Error 值（字串 / 同名 plain object / undefined）→ GENERIC_LOAD_ERROR', () => {
		expect(coachLoadErrorCopy('boom')).toBe(GENERIC_LOAD_ERROR);
		expect(coachLoadErrorCopy({ name: 'CoachNotFoundError' })).toBe(GENERIC_LOAD_ERROR);
		expect(coachLoadErrorCopy(undefined)).toBe(GENERIC_LOAD_ERROR);
	});

	it('GENERIC_LOAD_ERROR 字面即六頁共用的泛用文案（也是各頁初始值單源）', () => {
		expect(GENERIC_LOAD_ERROR).toEqual({
			errorTitle: '載入失敗',
			errorBody: '連線發生問題，無法取得最新資料，請稍後再試。'
		});
	});
});
