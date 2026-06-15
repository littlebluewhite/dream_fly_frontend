/* Dream Fly — 管理後台 · 教練狀態 → [標籤, 色碼] 純對應。
 *
 * Ported from docs/design/admin/admin.jsx: the edit form's COACH_STATUS_OPTS
 * supplies the labels (線上 / 忙碌 / 離線) and the coach card's <Avatar status>
 * supplies the dot colour, which the Avatar primitive maps online→--df-success,
 * busy→--df-warning, offline→--df-text-muted. This helper folds both into one
 * lookup so the card can render a matching label + dot without re-deriving it. */

import type { CoachStatus } from '$lib/admin/data';

/** [label, cssColor] for a coach status. Colours are CSS custom-property refs
 *  so the dot matches the Avatar status dot exactly. */
export const COACH_STATUS: Record<CoachStatus, [string, string]> = {
	online: ['線上', 'var(--df-success)'],
	busy: ['忙碌', 'var(--df-warning)'],
	offline: ['離線', 'var(--df-text-muted)']
};

/** Resolve a coach status to its [label, cssColor] tuple. */
export function coachStatus(status: CoachStatus): [string, string] {
	return COACH_STATUS[status];
}
