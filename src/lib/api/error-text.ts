import { ApiError } from './client';

/** 透傳式：ApiError 帶後端訊息就給，否則連線 fallback。 */
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
