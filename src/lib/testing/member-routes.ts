/* Dream Fly — 桌面 member 頁共用 wire fixture。
 *
 * 照 admin-routes.ts 的寫法：routes/member/* 頁面測試 mock $lib/api/client 的 api()，
 * 以 fakeRouter(overrides, MEMBER_ROUTES) 讓 $lib/member/api 的真 getter 走真實 mapper。
 * 各測試只覆寫自己關心的路徑；fixture 一律由 wire-fixtures builders 組出。
 * 只保留「有測試真的靠預設值」的路由（W4d 盤點：儀表板 getDashboard 的 enrolments/me 與
 * reports/me）；其餘端點由各測試自己交代，沒交代就讓 fakeRouter 丟錯。 */
import { memberReport, myEnrolment } from './wire-fixtures';

export const MEMBER_ROUTES: Record<string, unknown> = {
	'GET /enrolments/me': [myEnrolment()],
	'GET /reports/me': memberReport()
};
