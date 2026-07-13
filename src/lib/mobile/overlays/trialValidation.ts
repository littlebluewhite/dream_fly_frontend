/* Pure per-step validation for the 預約免費試上 flow (TrialScreen).
 * Extracted from trial.jsx (29) so the step-gating logic is unit-testable.
 * `stepValid(n, state)` returns whether step n's "下一步 / 送出" should enable.
 * Mock-only, no backend. */

import type { TrialInquiryInput } from '$lib/mobile/api';

export interface TrialState {
  cat: string;
  age: string;
  day: string;
  slot: string;
  parent: string;
  phone: string;
  student: string;
}

/** Taiwan mobile format accepted by the prototype: 09xx, optional - or space
 *  before each of the two trailing 3-digit groups (e.g. 0912-345-678 / 0912345678). */
export const TW_PHONE = /^09\d{2}[-\s]?\d{3}[-\s]?\d{3}$/;

/** Per-step gate. Steps: 0 課程+年齡, 1 日期+時段, 2 聯絡資料. Step 3 (完成) has no gate. */
export function stepValid(step: number, s: TrialState): boolean {
  if (step === 0) return Boolean(s.cat && s.age);
  if (step === 1) return Boolean(s.day && s.slot);
  if (step === 2) return Boolean(s.parent.trim() && TW_PHONE.test(s.phone.trim()) && s.student.trim());
  return true;
}

/** Minimal day-option shape needed below — TrialScreen's TRIAL_DAYS entries
 *  (which carry extra fields) are structurally compatible, no cast needed. */
export interface TrialDayOption {
  d: string;
  full: string;
}

/** Minimal slot-option shape needed below — TrialScreen's TRIAL_SLOTS entries
 *  are structurally compatible, no cast needed. */
export interface TrialSlotOption {
  id: string;
  time: string;
}

/** Assembles the 8-field submitTrialInquiry body (moved verbatim from TrialScreen
 *  submit()). A day/slot lookup hit sends the display string (`full` / `time`); a
 *  miss falls back to the raw selected value — the original `??` sentinel behaviour,
 *  kept as-is. `note` passes through unchanged (an empty string stays ''). */
export function buildTrialInquiry(
  s: TrialState,
  note: string,
  lookup: { days: readonly TrialDayOption[]; slots: readonly TrialSlotOption[] }
): TrialInquiryInput {
  const chosenDay = lookup.days.find((d) => d.d === s.day);
  const chosenSlot = lookup.slots.find((sl) => sl.id === s.slot);
  return {
    category: s.cat,
    studentAge: s.age,
    preferredDay: chosenDay?.full ?? s.day,
    preferredSlot: chosenSlot?.time ?? s.slot,
    parentName: s.parent,
    parentPhone: s.phone,
    studentName: s.student,
    note
  };
}
