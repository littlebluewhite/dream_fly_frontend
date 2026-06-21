/* Dream Fly — 活動動態 seed (single source of truth)
 * Data copied verbatim from src/lib/admin/data.ts. */

export interface Activity {
	icon: string;
	tone: string;
	bg: string;
	text: string;
	time: string;
}

export const ACTIVITY: Activity[] = [
	{ icon: 'user-plus', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '新學員 謝佩珊 完成報名兒童基礎 B 班', time: '12 分鐘前' },
	{ icon: 'credit-card', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', text: '訂單 DF-24061 已付款 NT$4,800', time: '38 分鐘前' },
	{ icon: 'calendar-off', tone: 'var(--df-warning)', bg: 'var(--df-warning-bg)', text: '許恩綺 為今日 19:00 課堂請假', time: '1 小時前' },
	{ icon: 'award', tone: 'var(--df-accent-dark)', bg: '#FFF8DB', text: '林雅婷 教練更新競技體操選手班技能評量', time: '2 小時前' },
	{ icon: 'refresh-cw', tone: 'var(--df-text-light)', bg: 'var(--df-bg-light)', text: '訂單 DF-24057 已退款 NT$600', time: '3 小時前' },
	{ icon: 'user-check', tone: 'var(--df-primary)', bg: 'var(--df-primary-bg)', text: '李孟潔 教練 完成幼兒體操探索班建檔', time: '20 分鐘前' },
	{ icon: 'ticket', tone: '#8B5CF6', bg: '#F3EEFE', text: '季票 · 暢遊 售出 2 張，金額 NT$14,400', time: '1 小時前' },
	{ icon: 'user-plus', tone: 'var(--df-success)', bg: 'var(--df-success-bg)', text: '新學員 秦語彤 完成報名競技啦啦隊 進階班', time: '4 小時前' }
];
