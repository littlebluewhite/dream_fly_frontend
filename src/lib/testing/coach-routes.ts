/* Dream Fly — 桌面 coach 頁共用 wire fixture(R16 Task 8·候選 10)。
 *
 * 教練身分閘門(coach/api.ts requireCoach)背後打的兩個端點 GET /users/me(本人帳號
 * 資料)+ GET /coaches(find user_id === 本人 id)的最小可用 wire fixture，照
 * ops-routes.ts 的寫法：供 routes/coach/* 頁面測試當 fakeRouter 的 defaults，各測試
 * 只覆寫自己關心的路徑(例如 'GET /coaches': [] 觸發真 CoachNotFoundError)。
 * COACH_USER 同時是 loginAs() 的登入身分(id 與 COACH_FIXTURE.user_id 對上)。值刻意與
 * coach/data.ts 的 seed COACH(李志偉)全數相異，頁面測試才能證明讀的是 wire 資料。 */
import type { CoachResponse } from '$lib/api/generated';

export const COACH_USER = {
	id: 'u-coach', email: 'lin@dreamfly.com.tw', name: '林雅婷', phone: '0912-000-111',
	birth_date: '1990-05-01', last_login: '2026-07-04T09:17:00Z', created_at: '2019-08-15T00:00:00Z'
};

export const COACH_FIXTURE: CoachResponse = {
	id: 'co1', user_id: COACH_USER.id, name: COACH_USER.name, title: '體操主任教練', bio: '測試用個人簡介文字。',
	experience: '6 年', specialties: ['體操'], certifications: ['測試標籤一', '測試標籤二'], is_active: true,
	display_order: 1, slug: null, photo_url: null, created_at: '2019-08-15T00:00:00Z'
};

/** fakeRouter 的 defaults 表——教練身分解析的兩個端點都有交代；頁面自己的資料端點
 *  (GET /sessions/today、/coaches/co1/schedule…)由各測試的 overrides 提供。 */
export const COACH_ROUTES: Record<string, unknown> = {
	'GET /users/me': COACH_USER,
	'GET /coaches': [COACH_FIXTURE]
};
