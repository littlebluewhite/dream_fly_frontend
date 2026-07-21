/* 預約免費試上(TrialScreen)動態產生日期選項的純邏輯——從 TrialScreen.svelte 抽出
 * (2026-07-22 架構深化 R7)，讓 Vitest 可以直接測試不必渲染元件(同 trialValidation.ts
 * 抽 pure logic 的既有慣例)。零 svelte 依賴。
 *
 * 政策：TRIAL_DAYS 一律動態產生、自今日起嚴格未來——以嚴格晚於今日的下一個週六為
 * 基準(今日恰為週六時不算「未來」，落回下週六)，依「六/日/三」節奏取 offset
 * [0,1,4,7,8] 天(當週六、隔天週日、+3 天週三、再 +3 天週六、隔天週日)；每個日期
 * 格式化為既有 `YYYY/MM/DD (週)` 字串(月/日皆補零至 2 位)。TRIAL_SLOTS 時段無對應
 * 後端端點，仍硬編在 TrialScreen.svelte(見 ADR 0006)。 */

export interface TrialDay {
  d: string;
  w: string;
  full: string;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

/** 六/日/三節奏 offset(天，相對下一個週六)：當週六、隔天週日、+3 天週三、再 +3
 *  天週六、隔天週日。 */
const TRIAL_DAY_OFFSETS = [0, 1, 4, 7, 8];

/** 補零至 2 位(月/日顯示用)。 */
export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** base 起算 +days 天的新 Date(不修改 base)。 */
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Date → TrialDay 顯示物件：d=「MM/DD」、w=中文星期單字、full=「YYYY/MM/DD (週)」。 */
export function toTrialDay(date: Date): TrialDay {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  const w = WEEKDAY_LABELS[date.getDay()];
  return { d: `${m}/${dd}`, w, full: `${y}/${m}/${dd} (${w})` };
}

/** 依「今日」(new Date())產生 5 個試上日期選項——嚴格晚於今日的下一個週六起算，
 *  六/日/三節奏(見檔頭政策)。 */
export function buildTrialDays(): TrialDay[] {
  const today = new Date();
  const nextSat = addDays(today, ((6 - today.getDay() + 7) % 7) || 7);
  return TRIAL_DAY_OFFSETS.map((n) => toTrialDay(addDays(nextSat, n)));
}
