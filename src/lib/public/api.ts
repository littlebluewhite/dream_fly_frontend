/* Dream Fly — public/marketing surface API 接縫（首次接上真實後端；其餘 surface 見
 * docs/architecture.md 的 mock API 接縫）。這裡只放「後端原始 wire 形狀」(Api*) 與
 * 呼叫 Task 11 client 的 fetch 函式；cents/enum/id 轉換到既有前端形狀
 * (CatalogCourse/Coach/Ticket) 一律在 adapters.ts 做，呼叫端不自行轉換。
 *
 * 全部為公開端點（integration-contract.md §3.3–§3.6、§3.16–§3.17）—— 一律
 * `auth: false`：訪客瀏覽這些頁面不該夾帶 Bearer，也不該在 token 過期時觸發
 * 不必要的 401→refresh 流程（這些端點本來就不需要登入）。 */

import { api } from '$lib/api/client';
import type { ApiPage } from '$lib/api/wire';

/* ---- Courses（GET /courses — 分頁，一次拉 per_page 上限 100 後前端篩選） ---- */

export interface ApiCourse {
	id: string;
	name: string;
	slug: string;
	level: string;
	description: string | null;
	duration_minutes: number;
	price_cents: number;
	max_students: number;
	min_age: number | null;
	max_age: number | null;
	features: string[];
	is_active: boolean;
	coach_id: string | null;
	category: string | null;
	schedule_text: string | null;
	is_highlighted: boolean;
	created_at: string;
	updated_at: string;
	enrolled_count: number;
	waitlist_count: number;
}

type CourseListResponse = ApiPage<'courses', ApiCourse>;

export const listCourses = (): Promise<ApiCourse[]> =>
	api<CourseListResponse>('/courses?per_page=100', { auth: false }).then((r) => r.courses);

/* ---- Coaches（GET /coaches — 純陣列，不分頁） ---- */

export interface ApiCoach {
	id: string;
	user_id: string;
	name: string;
	title: string;
	bio: string | null;
	experience: string | null;
	specialties: string[];
	certifications: string[];
	is_active: boolean;
	display_order: number;
	slug: string | null;
	photo_url: string | null;
	created_at: string;
}

export const listCoaches = (): Promise<ApiCoach[]> => api<ApiCoach[]>('/coaches', { auth: false });

/* ---- Venues（GET /venues — 純陣列，不分頁；形狀本身無 cents/enum，adapters.ts 不需要轉換函式） ---- */

export interface ApiVenue {
	id: string;
	category_id: string | null;
	name: string;
	slug: string;
	description: string | null;
	features: string[];
	image_url: string | null;
	is_active: boolean;
	created_at: string;
}

export const listVenues = (): Promise<ApiVenue[]> => api<ApiVenue[]>('/venues', { auth: false });

/* ---- Schedule（GET /schedule?year=&month= — 純陣列，每日一筆） ---- */

export interface ApiTimeSlot {
	id: string;
	date: string;
	start_time: string;
	end_time: string;
	venue_id: string | null;
	course_id: string | null;
	capacity: number;
	booked: number;
	status: 'available' | 'limited' | 'full' | 'closed';
}

export interface ApiDaySchedule {
	date: string;
	slots: ApiTimeSlot[];
}

export const getSchedule = (year: number, month: number): Promise<ApiDaySchedule[]> =>
	api<ApiDaySchedule[]>(`/schedule?year=${year}&month=${month}`, { auth: false });

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

export interface ApiInquiry {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	subject: string;
	message: string;
	status: string;
	assigned_to: string | null;
	created_at: string;
	updated_at: string;
}

export const sendContactInquiry = (payload: ContactPayload): Promise<ApiInquiry> =>
	api<ApiInquiry>('/contact', {
		method: 'POST',
		body: JSON.stringify(payload),
		auth: false
	});

/* ---- Posts（GET /posts — 分頁，只回 published；notificationsStore 過濾 announcement） ---- */

export interface ApiPost {
	id: string;
	author_id: string;
	title: string;
	slug: string;
	excerpt: string | null;
	category: string;
	status: string;
	cover_image: string | null;
	published_at: string | null;
	created_at: string;
}

type PostListResponse = ApiPage<'posts', ApiPost>;

export const listPosts = (): Promise<ApiPost[]> =>
	api<PostListResponse>('/posts?per_page=100', { auth: false }).then((r) => r.posts);

/* ---- Products（GET /products — 分頁，一次拉 per_page 上限 100；tickets 頁用來源） ---- */

export interface ApiProduct {
	id: string;
	name: string;
	slug: string;
	product_type: string;
	description: string | null;
	price_cents: number;
	original_price_cents: number | null;
	features: string[];
	is_highlighted: boolean;
	badge: string | null;
	stock: number | null;
	quota: number | null;
	sold: number;
	valid_days: number | null;
	session_count: number | null;
	is_active: boolean;
	created_at: string;
	updated_at: string;
}

type ProductListResponse = ApiPage<'products', ApiProduct>;

export const listProducts = (): Promise<ApiProduct[]> =>
	api<ProductListResponse>('/products?per_page=100', { auth: false }).then((r) => r.products);
