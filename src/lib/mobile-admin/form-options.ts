/* Dream Fly — 行動版後台 · 表單選項常數。forms.jsx 頂部常數 (5-10)。
 * MemberForm / ClassForm / CoachForm 共用。 */
export const F_LEVELS = ['啟蒙', '入門', '基礎', '進階', '選手'];
export const F_CATS = ['幼兒體操', '兒童基礎', '競技啦啦隊', '競技體操', '成人體操', '跑酷'];
export const F_CLASS_STATUS = ['招生中', '候補', '額滿'];
export const F_MEMBER_STATUS: [string, string][] = [
	['active', '在學中'],
	['warning', '出席偏低'],
	['paused', '暫停中']
];
export const F_COACH_STATUS: [string, string][] = [
	['online', '線上'],
	['busy', '忙碌'],
	['offline', '離線']
];
export const F_COLORS = ['#0066CC', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];
