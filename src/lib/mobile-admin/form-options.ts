/* Dream Fly — 行動版後台 · 表單選項常數。forms.jsx 頂部常數 (5-10)。
 * F_LEVELS 現僅 ClassForm.svelte 消費（MemberForm 未用）；F_MEMBER_STATUS 為既有死碼
 * （無消費者，非本次變更範圍，不刪）。
 *
 * Task F5：F_COACH_STATUS/F_COLORS 已隨 CoachForm 欄位收斂移除——教練狀態(線上/
 * 忙碌/離線)與頭像代表色 swatch 選色器皆無後端來源，CoachForm 現改用 isActive
 * (coaches.is_active) 取代，同桌面 CoachEditDialog 的收斂理由。 */
export { LEVELS as F_LEVELS } from '$lib/domain/course-level';
// Task 2：F_CATS/F_CLASS_STATUS 退役——分類清單改以 admin/data.ts 的 CATS 為單一
// 來源（ClassForm.svelte 改直取），不再兩邊各刻一份會逐漸分歧的 literal（mobile-admin
// 分類順序原本跟桌面不同）。招生狀態 Select 已於 R13 Task 4 拿掉（改唯讀）。
export const F_MEMBER_STATUS: [string, string][] = [
	['active', '在學中'],
	['warning', '出席偏低'],
	['paused', '暫停中']
];
