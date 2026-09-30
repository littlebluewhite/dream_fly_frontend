/* Dream Fly — coach 載入錯誤文案單源。coach 桌面五頁（儀表板/今日課程/排課/點名/個人設定）
 * 與 mobile-admin coach 三頁（工作台/點名/個人設定）的 gate onError 文案逐字同文，收斂於此；
 * GENERIC_LOAD_ERROR 同時是各頁 errorTitle/errorBody 的初始值單源。動作錯誤的
 * per-entity 文案表依 ADR 0011 仍留各呼叫端，本模組只管「載入」這一種。
 *
 * 判別用 instanceof CoachNotFoundError。R16 Task 8 前曾改用 e.name 比對——當時桌面頁面
 * 測試把 $lib/coach/api 整支模組換成假模組，import 進來的 class 是 undefined；那批測試
 * 改走 HTTP seam(mock $lib/api/client)後 class 是真的，name 比對的理由消失。 */
import { CoachNotFoundError } from './api';

export interface LoadErrorCopy {
	errorTitle: string;
	errorBody: string;
}

/** 泛用載入錯誤文案 —— 也是各頁 errorTitle/errorBody 的初始值單源。 */
export const GENERIC_LOAD_ERROR: LoadErrorCopy = {
	errorTitle: '載入失敗',
	errorBody: '連線發生問題，無法取得最新資料，請稍後再試。'
};

const COACH_NOT_FOUND: LoadErrorCopy = {
	errorTitle: '此帳號未綁定教練檔案',
	errorBody: '請聯繫系統管理員協助設定教練檔案。'
};

/** gate onError 的錯誤 → 載入錯誤文案：CoachNotFoundError 給「未綁定教練檔案」文案，
 *  其餘一律泛用文案。 */
export function coachLoadErrorCopy(e: unknown): LoadErrorCopy {
	return e instanceof CoachNotFoundError ? COACH_NOT_FOUND : GENERIC_LOAD_ERROR;
}
