/* Dream Fly — admin 系統設定草稿表單機（卡 C2，自桌面 admin/settings/+page.svelte 與
 * mobile-admin AdminSettingsScreen.svelte 兩份逐字重複的 10 個 let + onData 攤平段 +
 * save() 組裝抽出；0014 §2 雙生核可類：deps 相同、零行為旗標、逐字重複，三條件已核）。
 * 仿 member/leave-form.ts 的骨架：deps 注入（putSettings；getSettings 不進——資料由
 * 各頁 gate 的 onData 呼叫 applyData(d) 餵入）。
 *
 * 與 leave-form 的差異：leave-form 的 sessionId/reason 是各自獨立的 Writable，且
 * submit() 的守衛（未選場次｜in-flight）統一回傳 null；設定表單沒有「必填欄位未選」
 * 這種 valid 守衛（10 欄皆有預設值，恆為 valid），draft 因此是「單一物件」而非拆成
 * 10 個 Writable（markup 以 `bind:value={$draft.name}` 對物件欄位直接雙向綁定），
 * 唯一守衛（in-flight）也值得有自己的 outcome kind（'alreadySaving'）而非靜默回
 * null——三態 kind 讓呼叫端不必用 `if (!outcome) return` 猜測「回 null 代表什麼」。
 *
 * maxClassSizeToLabel/labelToMaxClassSize（Select 顯示字串 ↔ 後端數字換算）與
 * SettingsWriteBody 組裝（三組 key 皆選填、全送不追蹤 dirty，見 admin/api.ts
 * SettingsWriteBody 附註）收進本模組——是兩畫面除渲染外唯一的逐字重複。403 文案
 * 映射（桌面 settingsErrorMessage / 行動 SETTINGS_ERROR_TEXT 表）、成功 toast、
 * gate.silentRefresh() 呼叫時機不收進來，逐字留在各畫面（同 leave-form 錯誤透傳、
 * 不做翻譯的慣例：failed outcome 攜帶原始拋出物）。 */
import { get, writable, type Readable, type Writable } from 'svelte/store';
import type { SettingsData, SettingsWriteBody } from './api';

/** 兩畫面 10 個欄位的草稿快照，取代各自的 10 個獨立 let。maxClassSizeLabel 是
 *  Select 顯示字串（"12 人"），非後端的數字欄位——換算見 maxClassSizeToLabel/
 *  labelToMaxClassSize。 */
export interface SettingsDraft {
	name: string;
	phone: string;
	address: string;
	defaultRatio: string;
	maxClassSizeLabel: string;
	email: boolean;
	sms: boolean;
	lowAtt: boolean;
	autoWait: boolean;
	twoFA: boolean;
}

const DEFAULT_MAX_CLASS_SIZE = 12;
/** 後端數字 → Select 顯示字串（"12 人"）。 */
export const maxClassSizeToLabel = (n: number): string => `${n} 人`;
/** Select 顯示字串 → 後端數字；解析失敗（不在選項表內）回退預設 12。 */
export const labelToMaxClassSize = (label: string): number => parseInt(label, 10) || DEFAULT_MAX_CLASS_SIZE;

const INITIAL_DRAFT: SettingsDraft = {
	name: '',
	phone: '',
	address: '',
	defaultRatio: '1:6',
	maxClassSizeLabel: maxClassSizeToLabel(DEFAULT_MAX_CLASS_SIZE),
	email: true,
	sms: false,
	lowAtt: true,
	autoWait: true,
	twoFA: true
};

/** save() 的結果——領域 kind（非通用 ok/error，同 leave-form ADR 0012 判準③）；
 *  failed 攜帶原始拋出物，繁中文案由呼叫端各自映射（ADR 0011）；alreadySaving 是
 *  in-flight 守衛擋下時的明確 kind（非 leave-form 的靜默 null）。 */
export type SettingsFormOutcome = { kind: 'saved' } | { kind: 'failed'; error: unknown } | { kind: 'alreadySaving' };

export interface SettingsFormDeps {
	/** 簽名對齊 admin/api.ts 的 putSettings（PUT /settings，內部已 wrap
	 *  `{ settings: body }`，本模組只負責組裝 body 三組 key）。 */
	putSettings(body: SettingsWriteBody): Promise<SettingsData>;
}

export interface SettingsForm {
	draft: Writable<SettingsDraft>;
	saving: Readable<boolean>;
	/** 套用 GET /settings 回應，攤平 10 行寫回 draft（由呼叫端 gate 的 onData 餵入）。 */
	applyData(d: SettingsData): void;
	/** in-flight 中再呼叫 → { kind: 'alreadySaving' }；否則組裝 SettingsWriteBody
	 *  全量送出三組 key，deps 拋錯原樣捕捉為 { kind: 'failed', error }（失敗不清
	 *  draft，讓使用者已編輯的欄位留在畫面上重試）。 */
	save(): Promise<SettingsFormOutcome>;
}

export function createSettingsForm(deps: SettingsFormDeps): SettingsForm {
	const draft = writable<SettingsDraft>({ ...INITIAL_DRAFT });
	const savingStore = writable(false);
	const saving: Readable<boolean> = { subscribe: savingStore.subscribe };

	function applyData(d: SettingsData): void {
		draft.set({
			name: d.studioProfile.name,
			phone: d.studioProfile.phone,
			address: d.studioProfile.address,
			defaultRatio: d.studioProfile.defaultRatio,
			maxClassSizeLabel: maxClassSizeToLabel(d.studioProfile.maxClassSize),
			email: d.notificationFlags.email,
			sms: d.notificationFlags.sms,
			lowAtt: d.notificationFlags.lowAtt,
			autoWait: d.notificationFlags.autoWait,
			twoFA: d.security.twoFA
		});
	}

	async function save(): Promise<SettingsFormOutcome> {
		if (get(savingStore)) return { kind: 'alreadySaving' };
		savingStore.set(true);
		try {
			const d = get(draft);
			const body: SettingsWriteBody = {
				studio_profile: {
					name: d.name,
					phone: d.phone,
					address: d.address,
					default_ratio: d.defaultRatio,
					max_class_size: labelToMaxClassSize(d.maxClassSizeLabel)
				},
				notification_flags: { email: d.email, sms: d.sms, lowAtt: d.lowAtt, autoWait: d.autoWait },
				security: { twoFA: d.twoFA }
			};
			await deps.putSettings(body);
			return { kind: 'saved' };
		} catch (error) {
			return { kind: 'failed', error };
		} finally {
			savingStore.set(false);
		}
	}

	return { draft, saving, applyData, save };
}
