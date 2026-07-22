import { describe, it, expect, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { createSettingsForm, maxClassSizeToLabel, labelToMaxClassSize } from './settings-form';
import type { SettingsData, SettingsWriteBody } from './api';

/* settings-form.ts — admin 系統設定草稿表單機的單元測試（卡 C2）。只測 machine
 * 機制（applyData 攤平／save 的三組 key 組裝含 label↔數值換算／saving 守衛／
 * 失敗不清 draft），deps 全注入 mock、無渲染；兩畫面端的 403 文案映射
 * （settingsErrorMessage/SETTINGS_ERROR_TEXT）+ 成功 toast + gate.silentRefresh()
 * 佈線仍由各自的 render 套件把關（+page.svelte / AdminSettingsScreen.svelte 的
 * page.test.ts），兩層各測各的：這裡只斷言 failed outcome 攜帶「原始拋出物」。
 *
 * P2 回歸修復（codex 全輪審查）：saved outcome 攜帶 release()，saving 鎖延伸至
 * 呼叫端的 post-save 同步完成為止（見 settings-form.ts 模組頂部附註）；下方
 * 「saving 守衛」與「鎖延伸至 post-save 同步」兩個 describe 區塊涵蓋這個修法的
 * 可證偽回歸測試。 */

const FIXTURE: SettingsData = {
	studioProfile: {
		name: '測試體操館',
		phone: '04-9999-8888',
		address: '測試市測試路 1 號',
		defaultRatio: '1:4',
		maxClassSize: 8
	},
	notificationFlags: { email: false, sms: true, lowAtt: false, autoWait: false },
	security: { twoFA: false }
};

const INITIAL_DRAFT = {
	name: '',
	phone: '',
	address: '',
	defaultRatio: '1:6',
	maxClassSizeLabel: '12 人',
	email: true,
	sms: false,
	lowAtt: true,
	autoWait: true,
	twoFA: true
};

/** 手動控制 resolve/reject 時序的 promise，用於驗 in-flight 期間的守衛語意。 */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

function makeDeps() {
	return { putSettings: vi.fn<(body: SettingsWriteBody) => Promise<SettingsData>>() };
}

let deps: ReturnType<typeof makeDeps>;
let form: ReturnType<typeof createSettingsForm>;

beforeEach(() => {
	deps = makeDeps();
	form = createSettingsForm(deps);
});

describe('maxClassSizeToLabel / labelToMaxClassSize — 數字 ↔ 標籤換算', () => {
	it('數字 → 標籤', () => {
		expect(maxClassSizeToLabel(8)).toBe('8 人');
		expect(maxClassSizeToLabel(12)).toBe('12 人');
	});

	it('標籤 → 數字；不可解析時回退預設 12', () => {
		expect(labelToMaxClassSize('8 人')).toBe(8);
		expect(labelToMaxClassSize('10 人')).toBe(10);
		expect(labelToMaxClassSize('不明字串')).toBe(12);
	});
});

describe('createSettingsForm — 建構與 applyData 攤平', () => {
	it('建構零副作用：draft 為固定初始值、saving 為 false，不觸發 deps', () => {
		expect(get(form.draft)).toEqual(INITIAL_DRAFT);
		expect(get(form.saving)).toBe(false);
		expect(deps.putSettings).not.toHaveBeenCalled();
	});

	it('applyData 將 SettingsData 攤平寫回 draft（含 maxClassSize → 標籤換算）', () => {
		form.applyData(FIXTURE);
		expect(get(form.draft)).toEqual({
			name: '測試體操館',
			phone: '04-9999-8888',
			address: '測試市測試路 1 號',
			defaultRatio: '1:4',
			maxClassSizeLabel: '8 人',
			email: false,
			sms: true,
			lowAtt: false,
			autoWait: false,
			twoFA: false
		});
	});
});

describe('createSettingsForm — save() 守衛與 outcome', () => {
	it('全量送出三組 key（含編輯後欄位與 label→數值換算）', async () => {
		form.applyData(FIXTURE);
		form.draft.update((d) => ({ ...d, name: '改名體操館', maxClassSizeLabel: '10 人' }));
		deps.putSettings.mockResolvedValue(FIXTURE);

		const outcome = await form.save();
		expect(outcome).toEqual({ kind: 'saved', release: expect.any(Function) });
		expect(deps.putSettings).toHaveBeenCalledWith({
			studio_profile: {
				name: '改名體操館',
				phone: FIXTURE.studioProfile.phone,
				address: FIXTURE.studioProfile.address,
				default_ratio: FIXTURE.studioProfile.defaultRatio,
				max_class_size: 10
			},
			notification_flags: FIXTURE.notificationFlags,
			security: FIXTURE.security
		});
	});

	it('saving 守衛：in-flight 期間再呼叫 save() 回 alreadySaving，deps 只被呼叫一次；PUT resolve 後鎖仍持有，release() 後才復位', async () => {
		const d = deferred<SettingsData>();
		deps.putSettings.mockReturnValue(d.promise);

		const first = form.save(); // 起飛，saving 同步翻 true（不等 resolve）
		expect(get(form.saving)).toBe(true);
		expect(await form.save()).toEqual({ kind: 'alreadySaving' }); // 第二發被 in-flight 守衛擋下
		expect(deps.putSettings).toHaveBeenCalledTimes(1);

		d.resolve(FIXTURE);
		const outcome = await first;
		expect(outcome).toEqual({ kind: 'saved', release: expect.any(Function) });
		expect(get(form.saving)).toBe(true); // PUT 已成功，但鎖延伸至呼叫端的 post-save 同步完成為止（P2 回歸修復）
		if (outcome.kind === 'saved') outcome.release();
		expect(get(form.saving)).toBe(false); // release() 呼叫後才復位
	});

	it('鎖延伸至 post-save 同步（P2 回歸修復）：PUT 成功後、release() 呼叫前，saving 仍為 true 且第二次 save() 不發第二個 PUT', async () => {
		deps.putSettings.mockResolvedValue(FIXTURE);

		const outcome = await form.save();
		expect(outcome.kind).toBe('saved');
		expect(get(form.saving)).toBe(true); // 鎖延伸涵蓋呼叫端尚未完成的 post-save 同步（如 gate.silentRefresh()）

		expect(await form.save()).toEqual({ kind: 'alreadySaving' }); // 第二次呼叫被擋，不發第二個 PUT
		expect(deps.putSettings).toHaveBeenCalledTimes(1); // 仍只有第一次的那一發

		if (outcome.kind === 'saved') outcome.release(); // 呼叫端完成 post-save 同步後親自釋放
		expect(get(form.saving)).toBe(false);
	});

	it('release() 未被呼叫時鎖持續持有（顯式契約，非自動遺忘）：接連多次 save() 皆回 alreadySaving', async () => {
		deps.putSettings.mockResolvedValue(FIXTURE);
		const outcome = await form.save();
		expect(outcome.kind).toBe('saved');

		expect(await form.save()).toEqual({ kind: 'alreadySaving' });
		expect(await form.save()).toEqual({ kind: 'alreadySaving' });
		expect(deps.putSettings).toHaveBeenCalledTimes(1);
		expect(get(form.saving)).toBe(true);
	});

	it('失敗不清 draft：deps reject → {kind:failed,error} 攜帶原始拋出物，draft 維持編輯值、saving 復位', async () => {
		form.applyData(FIXTURE);
		form.draft.update((d) => ({ ...d, name: '編輯中的名稱' }));
		const draftBeforeSave = get(form.draft);
		const err = new Error('沒有權限執行此操作。');
		deps.putSettings.mockRejectedValue(err);

		const outcome = await form.save();
		expect(outcome.kind).toBe('failed');
		if (outcome.kind === 'failed') expect(outcome.error).toBe(err); // 原始拋出物，非包裝/翻譯
		expect(get(form.draft)).toEqual(draftBeforeSave); // 失敗不清空/重置 draft
		expect(get(form.saving)).toBe(false);
	});
});
