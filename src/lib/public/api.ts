/* Dream Fly — public/marketing surface API 接縫（首次接上真實後端；其餘 surface 見
 * docs/architecture.md 的 mock API 接縫）。這裡只放呼叫 Task 11 client 的 fetch 函式；
 * 後端 wire 形狀一律是產生型別（$lib/api/generated，W-7）；cents/enum/id 轉換到既有前端形狀
 * (CatalogCourse/Coach/Ticket) 一律在 adapters.ts 做，呼叫端不自行轉換。
 *
 * 全部為公開端點（integration-contract.md §3.3–§3.6、§3.16–§3.17）—— 一律
 * `auth: false`：訪客瀏覽這些頁面不該夾帶 Bearer，也不該在 token 過期時觸發
 * 不必要的 401→refresh 流程（這些端點本來就不需要登入）。 */

import { api } from '$lib/api/client';
import type {
	CoachResponse,
	CourseListResponse,
	CourseResponse,
	DaySchedule,
	InquiryResponse,
	PostListResponse,
	PostResponse,
	ProductListResponse,
	ProductResponse,
	VenueResponse
} from '$lib/api/generated';

/* ---- Courses（GET /courses — 分頁，一次拉 per_page 上限 100 後前端篩選） ---- */

export const listCourses = (): Promise<CourseResponse[]> =>
	api<CourseListResponse>('/courses?per_page=100', { auth: false }).then((r) => r.courses);

/* ---- Coaches（GET /coaches — 純陣列，不分頁） ---- */

export const listCoaches = (): Promise<CoachResponse[]> => api<CoachResponse[]>('/coaches', { auth: false });

/* ---- Venues（GET /venues — 純陣列，不分頁；形狀本身無 cents/enum，adapters.ts 不需要轉換函式） ---- */

export const listVenues = (): Promise<VenueResponse[]> => api<VenueResponse[]>('/venues', { auth: false });

/* ---- Schedule（GET /schedule?year=&month= — 純陣列，每日一筆） ---- */

export const getSchedule = (year: number, month: number): Promise<DaySchedule[]> =>
	api<DaySchedule[]>(`/schedule?year=${year}&month=${month}`, { auth: false });

/* ---- Contact（POST /contact） ---- */

export interface ContactPayload {
	name: string;
	email: string;
	phone?: string;
	subject: string;
	message: string;
	// Round 4 Task B5/F8：試上預約(mobile TrialScreen)借用本端點,'trial' + 自由
	// metadata JSONB(後端原樣存取,不逐欄驗證)。既有呼叫端(桌面 ContactForm)不帶
	// 這兩欄時行為不變——契約 §3.17。
	inquiry_type?: 'general' | 'trial';
	metadata?: Record<string, unknown>;
}

export const sendContactInquiry = (payload: ContactPayload): Promise<InquiryResponse> =>
	api<InquiryResponse>('/contact', {
		method: 'POST',
		body: JSON.stringify(payload),
		auth: false
	});

/* ---- Posts（GET /posts — 分頁，只回 published；notificationsStore 過濾 announcement） ---- */

export const listPosts = (): Promise<PostResponse[]> =>
	api<PostListResponse>('/posts?per_page=100', { auth: false }).then((r) => r.posts);

/* ---- Products（GET /products — 分頁，一次拉 per_page 上限 100；tickets 頁用來源） ---- */

export const listProducts = (): Promise<ProductResponse[]> =>
	api<ProductListResponse>('/products?per_page=100', { auth: false }).then((r) => r.products);
