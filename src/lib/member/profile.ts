/* Dream Fly — 會員資料 module(R13 Task 3·候選 C1)。
 *
 * 會員本人的「個人資料 + 通知偏好」唯一住處:GET/PATCH /users/me 的讀寫、欄位映射、
 * 表單規則、寫入序列化都在這裡。桌面 member(帳戶頁 / ProfileEditDialog)與 mobile
 * (SettingsScreen / EditProfileSheet / 首頁·帳戶 hero / TrialScreen / CartSheet)經
 * $lib/member/stores → $lib/mobile/stores 取同一顆單例。取代了三份各自為政的來源:
 * member/api.ts 的 mapProfile/saveBirthDate、mobile/stores.ts 的本地 profile/prefs
 * store,以及 mobile/pref-sync.ts 的偏好同步機(其 outcome 與序列鏈語意原樣移入)。
 *
 * 結構保證:
 *  - createSessionGate:每個 identity 水合一次,換帳號 / 登出即重置(修掉 prefs 與
 *    profile 跨登入殘留)。併發的 hydrateProfile() 共用同一支在飛 GET。
 *  - 所有 PATCH 走同一條寫入鏈 writeChain;每一筆輪到時:session 變了就跳過 →
 *    await 水合(「寫前先水合」不再是呼叫端的義務)→ gate.mutate(PATCH, ...)。
 *  - 後端對 preferences 是整包覆寫,送出時 = 後端原始物件 + 本地 4 鍵,前端不認識的
 *    鍵也保得住。
 *  - PATCH/GET 成功都經 authStore.syncUser 同步名字(identity 不變,不觸發任何 gate)。
 *
 * 誠實界線:後端沒有會員編號、家長聯絡人、頭像顏色——這些輸入一律拿掉(D2)。 */
import { writable, derived, get, type Readable } from 'svelte/store';
import { api } from '$lib/api/client';
import { initialOf } from '$lib/api/wire';
import { createSessionGate } from '$lib/session-gate';
import { authStore, type ApiUser } from '$lib/stores/authStore';

/** GET/PATCH /users/me 的回應:authStore 的 ApiUser 再加上兩個會員資料欄位。
 *  preferences 是後端的通用 JSON bag(未設定為 null)。 */
type ApiMe = ApiUser & {
	preferences: Record<string, unknown> | null;
	birth_date: string | null;
};

export interface Prefs {
	classReminder: boolean;
	coachMsg: boolean;
	promo: boolean;
	dark: boolean;
}

export interface MemberProfile {
	name: string;
	initial: string;
	email: string;
	/** 未設定為 ''。 */
	phone: string;
	/** YYYY-MM-DD(<input type="date"> 的 value 格式);未設定為 ''。 */
	birth: string;
	/** 加入年月 YYYY/MM。 */
	since: string;
}

/** 只放「想改的」欄位;與目前值相同的欄位會被略過,全部相同就不發請求。 */
export interface ProfileEdit {
	name?: string;
	phone?: string;
	/** '' = 清空(送 null)。 */
	birth?: string;
	prefs?: Partial<Prefs>;
}

export type PrefSetOutcome = { kind: 'saved' } | { kind: 'resynced' } | { kind: 'rolledBack' };
export type ProfileSaveOutcome = { kind: 'saved' } | { kind: 'failed'; error: unknown };

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
	for (const k of PREF_KEYS) {
		const v = raw?.[PREF_WIRE[k]];
		if (typeof v === 'boolean') out[k] = v;
	}
	return out;
}

/** 後端原始物件 + 本地 4 鍵(整包覆寫下保住前端不認識的鍵)。 */
function prefsToWire(raw: ApiMe['preferences'], p: Prefs): Record<string, unknown> {
	const out: Record<string, unknown> = { ...(raw ?? {}) };
	for (const k of PREF_KEYS) out[PREF_WIRE[k]] = p[k];
	return out;
}

function toProfile(u: ApiMe): MemberProfile {
	return {
		name: u.name,
		initial: initialOf(u.name),
		email: u.email,
		phone: u.phone ?? '',
		birth: u.birth_date ?? '',
		since: u.created_at.slice(0, 7).replace('-', '/')
	};
}

/** 表單規則照後端 UpdateProfileRequest:姓名 2–100、電話 8–20(皆以 trim 後計);後端
 *  沒有清空電話的路徑,所以原本有電話的人不能留白。回傳繁中錯誤文案,合法回 null。
 *  兩個編輯 dialog 用它即時提示,saveProfile 也再擋一次。 */
export function profileEditError(edit: ProfileEdit, current: MemberProfile | null): string | null {
	if (edit.name !== undefined) {
		const n = edit.name.trim().length;
		if (n < 2 || n > 100) return '姓名需為 2–100 個字';
	}
	if (edit.phone !== undefined) {
		const n = edit.phone.trim().length;
		if (n === 0) return current?.phone ? '聯絡電話無法清空' : null;
		if (n < 8 || n > 20) return '聯絡電話需為 8–20 碼';
	}
	return null;
}

/* ---- 狀態 ---- */
// 以下三個 let 必須宣告在 createSessionGate 之前:restored session 開機時 gate 建構當下
// 就會呼叫 reset(見 session-gate 的建構順序契約)。
let session = 0; // 本模組的 identity 世代:reset 一次 +1,寫入鏈用它判斷「排隊時的人還在不在」
let writeChain: Promise<void> = Promise.resolve();
let inflight: Promise<void> | null = null;

const me = writable<ApiMe | null>(null);
const prefsStore = writable<Prefs>({ ...PREFS_DEFAULT });

export const memberProfile: Readable<MemberProfile | null> = derived(me, ($me) => ($me ? toProfile($me) : null));
export const prefs: Readable<Prefs> = { subscribe: prefsStore.subscribe };

function applyMe(u: ApiMe): void {
	me.set(u);
	authStore.syncUser(u);
}

const gate = createSessionGate<ApiMe>({
	fetch: () => api<ApiMe>('/users/me'),
	apply: (u) => {
		applyMe(u);
		prefsStore.set(prefsFromWire(u.preferences));
	},
	reset: () => {
		me.set(null);
		prefsStore.set({ ...PREFS_DEFAULT });
		session += 1;
		writeChain = Promise.resolve(); // 舊身分卡住的寫入不得堵住新身分的鏈
		inflight = null;
	}
});

/** 觸發水合(每個 identity 只 GET 一次;併發呼叫共用同一支在飛 GET)。失敗原樣拋出,
 *  下次呼叫會重試——要 fail-hard 的呼叫端(帳戶頁 getAccount)直接 await,背景水合的
 *  呼叫端自行 catch。 */
export function hydrateProfile(): Promise<void> {
	if (!inflight) {
		const p: Promise<void> = gate.hydrate().finally(() => {
			if (inflight === p) inflight = null;
		});
		inflight = p;
	}
	return inflight;
}

/** 排進寫入鏈;輪到時 session 已換就回 skipped、不執行。task 拿到 stale() 供失敗處理
 *  判斷(換帳後不得回滾/重抓到新身分身上)。 */
function enqueue<R>(task: (stale: () => boolean) => Promise<R>, skipped: R): Promise<R> {
	const mine = session;
	const stale = () => mine !== session;
	const run = writeChain.then(() => (stale() ? skipped : task(stale)));
	writeChain = run.then(
		() => {},
		() => {}
	);
	return run;
}

function patchMe(body: Record<string, unknown>, writeBack: (u: ApiMe) => void): Promise<ApiMe> {
	return gate.mutate(() => api<ApiMe>('/users/me', { method: 'PATCH', body: JSON.stringify(body) }), writeBack);
}

/** 切換一個偏好:樂觀更新後排進寫入鏈。整包快照在「輪到時」才從 store 取(不是排隊時
 *  凍結),後一筆永遠疊在前一筆(含其 resync/回滾)之後的最新狀態上。失敗先整包 resync
 *  成伺服器真值(resynced),resync 也失敗才單鍵回滾(rolledBack)。toast 由呼叫端依
 *  outcome 決定。 */
export function setPref(k: keyof Prefs, v: boolean): Promise<PrefSetOutcome> {
	const before = get(prefsStore)[k];
	const wasHydrated = get(gate.hydrated);
	prefsStore.update((p) => ({ ...p, [k]: v }));
	return enqueue<PrefSetOutcome>(async (stale) => {
		try {
			await hydrateProfile();
			// 切換發生在水合落地之前:水合的 apply 已用後端值蓋掉這次樂觀切換,補回。
			if (!wasHydrated) prefsStore.update((p) => ({ ...p, [k]: v }));
			// 寫回只同步 me/名字、不動 prefsStore:本筆飛行期間使用者可能又切了別的鍵。
			await patchMe({ preferences: prefsToWire(get(me)?.preferences ?? null, get(prefsStore)) }, applyMe);
			return { kind: 'saved' };
		} catch (err) {
			console.error('profile: 偏好儲存失敗', err);
			if (stale()) return { kind: 'rolledBack' }; // 已換帳號:新身分的 store 不碰
			try {
				await gate.refresh();
				return { kind: 'resynced' };
			} catch (resyncErr) {
				console.error('profile: resync 失敗,退回單鍵回滾', resyncErr);
				if (!stale()) prefsStore.update((p) => ({ ...p, [k]: before }));
				return { kind: 'rolledBack' };
			}
		}
	}, { kind: 'rolledBack' });
}

/** 存個人資料(姓名/電話/生日/偏好)。不做樂觀更新;只送與目前值不同的欄位,全部相同
 *  就不發請求;birth 為 '' 送 null(後端 double-option:顯式清空)。偏好有改時送整包。 */
export function saveProfile(edit: ProfileEdit): Promise<ProfileSaveOutcome> {
	return enqueue<ProfileSaveOutcome>(async () => {
		try {
			await hydrateProfile();
			const cur = get(me)!; // 水合成功且同一 session(enqueue 已核對)→ 必有值
			const invalid = profileEditError(edit, toProfile(cur));
			if (invalid) return { kind: 'failed', error: new Error(invalid) };

			const body: Record<string, unknown> = {};
			const name = edit.name?.trim();
			if (name !== undefined && name !== cur.name) body.name = name;
			const phone = edit.phone?.trim();
			if (phone !== undefined && phone !== (cur.phone ?? '')) body.phone = phone;
			if (edit.birth !== undefined && edit.birth !== (cur.birth_date ?? '')) body.birth_date = edit.birth || null;
			const curPrefs = get(prefsStore);
			const nextPrefs = { ...curPrefs, ...edit.prefs };
			const prefsChanged = PREF_KEYS.some((k) => nextPrefs[k] !== curPrefs[k]);
			if (prefsChanged) body.preferences = prefsToWire(cur.preferences, nextPrefs);
			if (Object.keys(body).length === 0) return { kind: 'saved' };

			await patchMe(body, (u) => {
				applyMe(u);
				if (prefsChanged) prefsStore.update((p) => ({ ...p, ...edit.prefs }));
			});
			return { kind: 'saved' };
		} catch (error) {
			return { kind: 'failed', error };
		}
	}, { kind: 'failed', error: new Error('session 已變更,未送出') });
}
