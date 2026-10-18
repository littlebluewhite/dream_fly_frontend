/* Dream Fly — 本人帳號資料 module。
 *
 * 任何已登入者(會員、教練或其他 staff)自己的帳號資料——姓名、電話、生日、email(只讀)、加入年月與
 * 上次登入時間——連同通知偏好的唯一住處:GET/PATCH /users/me 的讀寫、欄位映射、表單規則、寫入序列化
 * 都在這裡。桌面 member(帳戶頁 / ProfileEditDialog)、mobile(SettingsScreen / EditProfileSheet /
 * 帳戶頁 hero / TrialScreen)與教練端(coach/api 的教練閘門與 saveSettings)都 import
 * 同一顆單例,所以同一位登入者在任何一端改名,各端讀到的都是新名字。教練檔案(GET /coaches)是另一份
 * 資料,不屬於本人帳號資料——教練閘門只另快取它。
 *
 * 結構保證:
 *  - createSessionGate:每個 identity 水合一次,換帳號 / 登出即重置(prefs 與 profile
 *    不跨登入殘留)。併發的 hydrateSelfAccount() 共用同一支在飛 GET(閘門的 hydrate 合併)。
 *  - 所有 PATCH 走閘門的寫入鏈 gate.queueWrite:寫前水合、換帳號作廢、失敗復原都在閘門裡,
 *    這裡只交 optimistic/send/commit/onFailure;send 回 null 表示沒有要送的(全部欄位未改動)。
 *  - 後端對 preferences 是整包覆寫,送出時 = 後端原始物件 + 本地 4 鍵,前端不認識的
 *    鍵也保得住。
 *  - PATCH/GET 成功都經 authStore.syncUser 同步名字(identity 不變,不觸發任何 gate)。
 *
 * 誠實界線:後端沒有會員編號、家長聯絡人、頭像顏色——這些輸入一律拿掉(ADR-0023 D2)。 */
import { writable, derived, get, type Readable } from 'svelte/store';
import { api } from '$lib/api/client';
import { initialOf, isoDateTime } from '$lib/api/wire';
import { createSessionGate } from '$lib/session-gate';
import { resultOf } from '$lib/hydration-gate';
import { authStore, type ApiUser } from '$lib/stores/authStore';
import type { JsonValue, UserResponse } from '$lib/api/generated';

/** GET/PATCH /users/me 的回應(UserResponse)中本模組讀的欄位:authStore 的 ApiUser
 *  再加上會員資料欄位。preferences 是後端的通用 JSON bag(未設定為 null,後端不驗形狀)。 */
type ApiMe = ApiUser &
	Pick<UserResponse, 'email' | 'phone' | 'last_login' | 'preferences' | 'birth_date'>;

/** preferences 只認 JSON 物件;其他形狀(後端不驗)視同未設定。 */
function prefsObject(raw: ApiMe['preferences']): { [key: string]: JsonValue } | null {
	return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
}

export interface Prefs {
	classReminder: boolean;
	coachMsg: boolean;
	promo: boolean;
	dark: boolean;
}

export interface SelfAccount {
	/** users.id(教練端用它對 GET /coaches 的 user_id)。 */
	id: string;
	name: string;
	initial: string;
	email: string;
	/** 未設定為 ''。 */
	phone: string;
	/** YYYY-MM-DD(<input type="date"> 的 value 格式);未設定為 ''。 */
	birth: string;
	/** 加入年月 YYYY/MM。 */
	since: string;
	/** 上次登入 YYYY-MM-DD HH:MM;未知為 ''。 */
	lastLogin: string;
}

/** 只放「想改的」欄位;與目前值相同的欄位會被略過,全部相同就不發請求。 */
export interface SelfAccountEdit {
	name?: string;
	phone?: string;
	/** '' = 清空(送 null)。 */
	birth?: string;
	prefs?: Partial<Prefs>;
}

export type PrefSetOutcome = { kind: 'saved' } | { kind: 'resynced' } | { kind: 'rolledBack' };
/** saved 的 account 是這次存的本人帳號資料(見 saveSelfAccount),不一定是 $selfAccount 的現值。 */
export type SelfAccountSaveOutcome = { kind: 'saved'; account: SelfAccount } | { kind: 'failed'; error: unknown };

const PREFS_DEFAULT: Prefs = { classReminder: true, coachMsg: true, promo: false, dark: false };
const PREF_WIRE: Record<keyof Prefs, string> = {
	classReminder: 'class_reminder',
	coachMsg: 'coach_msg',
	promo: 'promo',
	dark: 'dark'
};
const PREF_KEYS = Object.keys(PREF_WIRE) as (keyof Prefs)[];

function prefsFromWire(raw: ApiMe['preferences']): Prefs {
	const out = { ...PREFS_DEFAULT };
	const obj = prefsObject(raw);
	for (const k of PREF_KEYS) {
		const v = obj?.[PREF_WIRE[k]];
		if (typeof v === 'boolean') out[k] = v;
	}
	return out;
}

/** 後端原始物件 + 本地 4 鍵(整包覆寫下保住前端不認識的鍵)。 */
function prefsToWire(raw: ApiMe['preferences'], p: Prefs): Record<string, unknown> {
	const out: Record<string, unknown> = { ...(prefsObject(raw) ?? {}) };
	for (const k of PREF_KEYS) out[PREF_WIRE[k]] = p[k];
	return out;
}

function toSelfAccount(u: ApiMe): SelfAccount {
	return {
		id: u.id,
		name: u.name,
		initial: initialOf(u.name),
		email: u.email,
		phone: u.phone ?? '',
		birth: u.birth_date ?? '',
		since: u.created_at.slice(0, 7).replace('-', '/'),
		lastLogin: u.last_login ? isoDateTime(u.last_login) : ''
	};
}

/** 表單規則照後端 UpdateProfileRequest:姓名 2–100、電話 8–20(皆以 trim 後計);後端
 *  沒有清空電話的路徑,所以原本有電話的人不能留白。只在值真的改變時才驗證——兩個編輯
 *  dialog 的 Draft 一律帶入目前值(即使使用者沒有動那個欄位),未改動的欄位不該擋住其他
 *  欄位的存檔(F3:Google 註冊建立的姓名可能落在 2–100 之外,見 backend auth/service.rs,
 *  這類使用者原本連生日/偏好都存不了)。回傳繁中錯誤文案,合法回 null。兩個編輯 dialog
 *  與教練端兩個設定頁(ProfileTab / mobile-admin csettings,current 傳 Coach 的 name/phone)
 *  用它即時提示,saveSelfAccount 也再擋一次。 */
export function selfAccountEditError(
	edit: Pick<SelfAccountEdit, 'name' | 'phone'>,
	current: Pick<SelfAccount, 'name' | 'phone'> | null
): string | null {
	if (edit.name !== undefined) {
		const name = edit.name.trim();
		if (name !== current?.name) {
			if (name.length < 2 || name.length > 100) return '姓名需為 2–100 個字';
		}
	}
	if (edit.phone !== undefined) {
		const phone = edit.phone.trim();
		if (phone !== (current?.phone ?? '')) {
			if (phone.length === 0) return current?.phone ? '聯絡電話無法清空' : null;
			if (phone.length < 8 || phone.length > 20) return '聯絡電話需為 8–20 碼';
		}
	}
	return null;
}

/* ---- 狀態 ---- */
const me = writable<ApiMe | null>(null);
const prefsStore = writable<Prefs>({ ...PREFS_DEFAULT });

export const selfAccount: Readable<SelfAccount | null> = derived(me, ($me) => ($me ? toSelfAccount($me) : null));
export const prefs: Readable<Prefs> = { subscribe: prefsStore.subscribe };

function applyMe(u: ApiMe): void {
	me.set(u);
	authStore.syncUser(u);
}

const gate = createSessionGate<ApiMe>({
	fetch: () => api<UserResponse>('/users/me'),
	apply: (u) => {
		applyMe(u);
		prefsStore.set(prefsFromWire(u.preferences));
	},
	reset: () => {
		me.set(null);
		prefsStore.set({ ...PREFS_DEFAULT });
	}
});

/** 觸發水合(每個 identity 只 GET 一次;併發呼叫共用同一支在飛 GET)。失敗原樣拋出,
 *  下次呼叫會重試——要 fail-hard 的呼叫端(帳戶頁 getAccount)直接 await,背景水合的
 *  呼叫端自行 catch。 */
export const hydrateSelfAccount = gate.hydrate;

function sendPatch(body: Record<string, unknown>): Promise<ApiMe> {
	return api<UserResponse>('/users/me', { method: 'PATCH', body: JSON.stringify(body) });
}

/** 切換一個偏好:樂觀更新後排進寫入鏈。整包快照在「輪到時」才從 store 取(不是排隊時
 *  凍結),後一筆永遠疊在前一筆(含其 resync/回滾)之後的最新狀態上。寫前水合、換帳號作廢與
 *  失敗復原都是 gate.queueWrite 的事:PATCH 記成尾流(同拍的 refresh 族等它 settle,ADR-0021);
 *  失敗(含寫前水合失敗)先整包 resync 成伺服器真值(resynced),resync 也失敗才單鍵回滾(rolledBack)。
 *  toast 由呼叫端依 outcome 決定。 */
export async function setPref(k: keyof Prefs, v: boolean): Promise<PrefSetOutcome> {
	const before = get(prefsStore)[k];
	const o = await gate.queueWrite({
		// 冪等:入列時未水合的話,閘門在水合落地後再套一次。
		optimistic: () => {
			prefsStore.update((p) => ({ ...p, [k]: v }));
			return () => prefsStore.update((p) => ({ ...p, [k]: before }));
		},
		send: () => sendPatch({ preferences: prefsToWire(get(me)?.preferences ?? null, get(prefsStore)) }),
		// 寫回只同步 me/名字、不動 prefsStore:本筆飛行期間使用者可能又切了別的鍵。
		commit: applyMe,
		onFailure: 'resync'
	});
	if (o.kind === 'written') return { kind: 'saved' };
	if (o.kind === 'stale') return o.settled.status === 'fulfilled' ? { kind: 'saved' } : { kind: 'rolledBack' }; // 已換帳號:新身分的 store 不碰
	console.error('profile: 偏好儲存失敗', o.error);
	return { kind: o.recovery === 'resynced' ? 'resynced' : 'rolledBack' };
}

/** 存個人資料(姓名/電話/生日/偏好)。不做樂觀更新;只送與目前值不同的欄位,全部相同
 *  就不發請求;birth 為 '' 送 null(後端 double-option:顯式清空)。偏好有改時送整包。
 *
 *  saved 帶回這次存的是誰:PATCH 回應;沒有要送的就是送出那一拍的現值。PATCH 飛行中換帳號時
 *  伺服器已經接受,照樣回 saved、帶舊帳號的資料,共享 store 不碰。要用存檔結果的呼叫端讀
 *  outcome.account,不在 await 之後讀 $selfAccount(那時它可能已是新帳號的開機值 null)。 */
export async function saveSelfAccount(edit: SelfAccountEdit): Promise<SelfAccountSaveOutcome> {
	let prefsChanged = false;
	let sentFrom: ApiMe | null = null; // 送出那一拍的現值
	try {
		const saved = resultOf(
			await gate.queueWrite({
				send: () => {
					const cur = (sentFrom = get(me)!); // queueWrite 已水合且核對過身分 → 必有值
					const invalid = selfAccountEditError(edit, toSelfAccount(cur));
					if (invalid) return Promise.reject(new Error(invalid));

					const body: Record<string, unknown> = {};
					const name = edit.name?.trim();
					if (name !== undefined && name !== cur.name) body.name = name;
					const phone = edit.phone?.trim();
					if (phone !== undefined && phone !== (cur.phone ?? '')) body.phone = phone;
					if (edit.birth !== undefined && edit.birth !== (cur.birth_date ?? '')) body.birth_date = edit.birth || null;
					const curPrefs = get(prefsStore);
					const nextPrefs = { ...curPrefs, ...edit.prefs };
					prefsChanged = PREF_KEYS.some((k) => nextPrefs[k] !== curPrefs[k]);
					if (prefsChanged) body.preferences = prefsToWire(cur.preferences, nextPrefs);
					return Object.keys(body).length === 0 ? null : sendPatch(body);
				},
				commit: (u) => {
					applyMe(u);
					if (prefsChanged) prefsStore.update((p) => ({ ...p, ...edit.prefs }));
				}
			})
		);
		return { kind: 'saved', account: toSelfAccount(saved ?? sentFrom!) }; // null = 沒有要送的
	} catch (error) {
		return { kind: 'failed', error };
	}
}
