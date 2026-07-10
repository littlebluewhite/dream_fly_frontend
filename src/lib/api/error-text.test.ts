import { describe, it, expect } from 'vitest';
import { apiErrorMessage, apiErrorText } from './error-text';
import { ApiError } from './client';

describe('error-text', () => {
  describe('apiErrorMessage', () => {
    it('transparently passes ApiError.message', () => {
      const error = new ApiError(500, '內部伺服器錯誤');
      expect(apiErrorMessage(error)).toBe('內部伺服器錯誤');
    });

    it('returns fallback for TypeError', () => {
      expect(apiErrorMessage(new TypeError('network timeout'))).toBe('連線發生問題，請稍後再試。');
    });

    it('returns fallback for string', () => {
      expect(apiErrorMessage('some error')).toBe('連線發生問題，請稍後再試。');
    });

    it('returns fallback for null', () => {
      expect(apiErrorMessage(null)).toBe('連線發生問題，請稍後再試。');
    });

    it('returns fallback for undefined', () => {
      expect(apiErrorMessage(undefined)).toBe('連線發生問題，請稍後再試。');
    });

    it('passes through empty ApiError.message', () => {
      const error = new ApiError(400, '');
      expect(apiErrorMessage(error)).toBe('');
    });

    it('uses exact fallback text with full-width punctuation', () => {
      expect(apiErrorMessage(new Error('some error'))).toBe('連線發生問題，請稍後再試。');
    });
  });

  describe('apiErrorText', () => {
    it('returns text from byStatus table when status matches', () => {
      const error = new ApiError(409, 'backend message');
      const byStatus = { 409: '重複' };
      expect(apiErrorText(error, byStatus)).toBe('重複');
    });

    it('does not transparently pass e.message when status not in table', () => {
      const error = new ApiError(500, 'internal server error');
      const byStatus = { 409: '重複' };
      expect(apiErrorText(error, byStatus)).not.toBe('internal server error');
      expect(apiErrorText(error, byStatus)).toBe('連線發生問題，請稍後再試。');
    });

    it('returns fallback for non-ApiError', () => {
      expect(apiErrorText(new TypeError('network timeout'), { 409: '重複' })).toBe(
        '連線發生問題，請稍後再試。'
      );
    });

    it('returns fallback for empty table', () => {
      const error = new ApiError(409, 'backend message');
      expect(apiErrorText(error, {})).toBe('連線發生問題，請稍後再試。');
    });

    it('matches on multiple status codes in table', () => {
      const error422 = new ApiError(422, 'validation error');
      const error403 = new ApiError(403, 'forbidden');
      const byStatus = {
        409: '重複',
        422: '驗證失敗',
        403: '無權限'
      };
      expect(apiErrorText(error422, byStatus)).toBe('驗證失敗');
      expect(apiErrorText(error403, byStatus)).toBe('無權限');
    });

    it('ignores false-y string values in table lookup', () => {
      const error = new ApiError(409, 'backend message');
      const byStatus = { 409: '' };
      expect(apiErrorText(error, byStatus)).toBe('連線發生問題，請稍後再試。');
    });

    it('uses exact fallback text with full-width punctuation', () => {
      const error = new ApiError(500, 'server error');
      expect(apiErrorText(error, { 409: '重複' })).toBe('連線發生問題，請稍後再試。');
    });

    it('ignores ApiError.message when hitting table', () => {
      const error = new ApiError(409, 'this message should be ignored');
      const byStatus = { 409: '重複' };
      expect(apiErrorText(error, byStatus)).toBe('重複');
      expect(apiErrorText(error, byStatus)).not.toBe('this message should be ignored');
    });

    it('handles null/undefined in byStatus gracefully', () => {
      const error = new ApiError(409, 'backend message');
      expect(apiErrorText(error, { 409: null as any })).toBe('連線發生問題，請稍後再試。');
      expect(apiErrorText(error, { 409: undefined as any })).toBe('連線發生問題，請稍後再試。');
    });
  });
});
