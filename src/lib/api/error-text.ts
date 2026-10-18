/* Dream Fly — API 錯誤 → 畫面文案的接線單源（ADR 0011）：透傳式 apiErrorMessage、查表式 apiErrorText，
 * 呼叫端先判型再用其一，不手刻 `instanceof ApiError` 分支。各實體的動作錯誤文案表（狀態碼 → 文案）留在呼叫端、
 * 交給 apiErrorText，不收進本檔；coach 頁的載入錯誤（gate onError）文案另有單源 coach/load-error-copy（ADR 0014 §3 劃界）。 */
import { ApiError } from './client';

/** 透傳式：ApiError 一律透傳 message（含空字串——現況普查 10/10 皆無 truthy 檢查，見 ADR 0011），否則連線 fallback。 */
export function apiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return '連線發生問題，請稍後再試。';
}

/** 查表式：ApiError 且狀態碼有指定文案才給，否則連線 fallback(不透傳後端原文)。 */
export function apiErrorText(e: unknown, byStatus: Record<number, string>): string {
  if (e instanceof ApiError) {
    const text = byStatus[e.status];
    if (text) return text;
  }
  return '連線發生問題，請稍後再試。';
}
