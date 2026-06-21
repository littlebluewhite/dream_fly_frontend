/* src/lib/domain/shared.ts — 共用常數與工具函式 */

export const CAMPUSES = ['美村本館', '文心分館', '北屯分館'];
export const ENROLL_SOURCES = ['官網預約表單', 'Facebook 廣告', '親友轉介', 'Google 搜尋', '社區體驗活動', 'LINE 官方帳號'];

/** 會員分級：≥350 金卡、≥250 銀卡、≥150 銅卡、其餘一般。回傳 [名稱, 色碼]。 */
export function tierOf(pts: number): [string, string] {
	return pts >= 350
		? ['金卡會員', '#F59E0B']
		: pts >= 250
			? ['銀卡會員', '#94A3B8']
			: pts >= 150
				? ['銅卡會員', '#B45309']
				: ['一般會員', '#64748B'];
}
