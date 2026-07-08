/* Dream Fly — 行動版後台 · 表單選項常數。forms.jsx 頂部常數 (5-10)。
 * MemberForm / ClassForm 共用。
 *
 * Task F5：F_COACH_STATUS/F_COLORS 已隨 CoachForm 欄位收斂移除——教練狀態(線上/
 * 忙碌/離線)與頭像代表色 swatch 選色器皆無後端來源，CoachForm 現改用 isActive
 * (coaches.is_active) 取代，同桌面 CoachEditDialog 的收斂理由。 */
export const F_LEVELS = ['啟蒙', '入門', '基礎', '進階', '選手'];
export const F_CATS = ['幼兒體操', '兒童基礎', '競技啦啦隊', '競技體操', '成人體操', '跑酷'];
export const F_CLASS_STATUS = ['招生中', '候補', '額滿'];
export const F_MEMBER_STATUS: [string, string][] = [
	['active', '在學中'],
	['warning', '出席偏低'],
	['paused', '暫停中']
];
