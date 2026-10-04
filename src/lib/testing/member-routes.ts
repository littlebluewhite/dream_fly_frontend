/* Dream Fly — 桌面 member 頁共用 wire fixture。
 *
 * 照 admin-routes.ts 的寫法：routes/member/* 頁面測試 mock $lib/api/client 的 api()，
 * 以 fakeRouter(overrides, MEMBER_ROUTES) 讓 $lib/member/api 的真 getter 走真實 mapper。
 * 各測試只覆寫自己關心的路徑；fixture 一律由 wire-fixtures builders 組出。 */
import { memberReport, myEnrolment, pointsMe } from './wire-fixtures';

export const MEMBER_ROUTES: Record<string, unknown> = {
	'GET /enrolments/me': [myEnrolment()],
	'GET /reports/me': memberReport(),
	'GET /report-cards/me': [],
	'GET /certificates/me': [],
	'GET /schedule/me': [],
	'GET /rewards': { rewards: [] },
	'GET /points/me': pointsMe(),
	'GET /courses?per_page=100': { courses: [], total: 0, page: 1, per_page: 100 },
	'GET /coaches': []
};
