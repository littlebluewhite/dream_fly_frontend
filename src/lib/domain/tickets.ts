/* Dream Fly — 票券 seed (single source of truth)
 * Data copied verbatim from src/lib/admin/data.ts. */

export interface Ticket {
	id: string;
	name: string;
	type: 'pass' | 'trial' | 'event';
	price: number;
	sold: number;
	quota: number;
	color: string;
	icon: string;
	desc: string;
}

export const TICKETS: Ticket[] = [
	{ id: 'T-MONTH', name: '月票 · 自由練習', type: 'pass', price: 2800, sold: 128, quota: 200, color: 'var(--df-primary)', icon: 'calendar-days', desc: '當月不限堂數自由練習' },
	{ id: 'T-TRIAL', name: '體驗券 · 單堂', type: 'trial', price: 600, sold: 86, quota: 120, color: '#10B981', icon: 'sparkles', desc: '首次報名單堂體驗' },
	{ id: 'T-COMP', name: '比賽觀賽票', type: 'event', price: 350, sold: 234, quota: 400, color: '#8B5CF6', icon: 'trophy', desc: '年度成果發表與賽事入場' },
	{ id: 'T-CLASS10', name: '10 堂回數票', type: 'pass', price: 5400, sold: 64, quota: 100, color: 'var(--df-warning)', icon: 'tickets', desc: '彈性使用 · 半年內有效' },
	{ id: 'T-SEASON', name: '季票 · 暢遊', type: 'pass', price: 7200, sold: 52, quota: 120, color: '#0EA5E9', icon: 'calendar-range', desc: '單季不限堂數自由練習' },
	{ id: 'T-FAMILY', name: '親子體驗組', type: 'trial', price: 1000, sold: 73, quota: 150, color: '#EC4899', icon: 'users', desc: '親子雙人單堂體驗' }
];
