import { describe, it, expect } from 'vitest';
import { weekdayOf, formatSessionLabel, formatSessionDateTime, sessionOptions } from './session-format';

describe('weekdayOf', () => {
  it('resolves the Chinese weekday for a naive "YYYY-MM-DD" date', () => {
    // 2026-07-10 is a Friday.
    expect(weekdayOf('2026-07-10')).toBe('五');
    // 2026-07-12 is a Sunday.
    expect(weekdayOf('2026-07-12')).toBe('日');
  });
});

describe('formatSessionLabel', () => {
  it('formats date + weekday + start–end time, trimming seconds', () => {
    expect(formatSessionLabel({ session_date: '2026-07-10', start_time: '19:00:00', end_time: '20:30:00' })).toBe(
      '2026-07-10 (五) 19:00–20:30'
    );
  });
});

describe('formatSessionDateTime', () => {
  it('formats date + weekday + start time only (LeaveRequestResponse has no end_time)', () => {
    expect(formatSessionDateTime('2026-07-10', '19:00:00')).toBe('2026-07-10 (五) 19:00');
  });
});

describe('sessionOptions', () => {
  it('maps a session list to {value,label} Select options, id → value', () => {
    const sessions = [
      { id: 's1', session_date: '2026-07-10', start_time: '19:00:00', end_time: '20:30:00' },
      { id: 's2', session_date: '2026-07-12', start_time: '10:00:00', end_time: '11:00:00' }
    ];
    expect(sessionOptions(sessions)).toEqual([
      { value: 's1', label: '2026-07-10 (五) 19:00–20:30' },
      { value: 's2', label: '2026-07-12 (日) 10:00–11:00' }
    ]);
  });

  it('returns an empty array for an empty session list', () => {
    expect(sessionOptions([])).toEqual([]);
  });
});
