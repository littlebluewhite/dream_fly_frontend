/* src/lib/domain/orders.ts — 訂單 seed data (base only; Order derivation stays in admin) */

import type { OrderStatus } from '$lib/api/wire';

export interface OrderBase {
	id: string;
	member: string;
	initial: string;
	color: string;
	item: string;
	amount: number;
	status: OrderStatus;
	method: string;
	date: string;
	invoice: string;
	discount: string;
	handler: string;
	reason?: string;
}

export const ORDERS_BASE: OrderBase[] = [
	{ id: 'DF-24061', member: '王承恩', initial: '王', color: '#0066CC', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: '信用卡', date: '06/08 14:22', invoice: 'QX-48120391', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24060', member: '陳思妤', initial: '陳', color: '#EC4899', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: 'LINE Pay', date: '06/08 11:03', invoice: 'QX-48120385', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24059', member: '李宥蓁', initial: '李', color: '#0EA5E9', item: '兒童基礎 B 班 · 春季', amount: 3200, status: 'pending', method: 'ATM 轉帳', date: '06/07 19:45', invoice: 'QX-48120377', discount: '—', handler: '系統自動' },
	{ id: 'DF-24058', member: '吳冠霖', initial: '吳', color: '#0066CC', item: '競技體操 選手班 · 春季', amount: 6200, status: 'paid', method: '信用卡', date: '06/07 16:30', invoice: 'QX-48120362', discount: '續報 -300', handler: '林雅婷' },
	{ id: 'DF-24057', member: '周哲瑋', initial: '周', color: '#10B981', item: '跑酷入門班 · 體驗', amount: 600, status: 'refunded', method: '信用卡', date: '06/06 10:12', invoice: 'QX-48120344', discount: '體驗折抵', handler: '王思齊', reason: '家長申請改期，全額退款' },
	{ id: 'DF-24056', member: '蔡昀軒', initial: '蔡', color: '#F59E0B', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: 'LINE Pay', date: '06/05 20:08', invoice: 'QX-48120331', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24055', member: '鄭宇翔', initial: '鄭', color: '#8B5CF6', item: '成人體操 基礎班 · 春季', amount: 3600, status: 'pending', method: 'ATM 轉帳', date: '06/05 09:55', invoice: 'QX-48120318', discount: '—', handler: '系統自動' },
	{ id: 'DF-24054', member: '劉芷晴', initial: '劉', color: '#0EA5E9', item: '幼兒體操 啟蒙班 · 春季', amount: 2800, status: 'paid', method: '信用卡', date: '06/04 13:40', invoice: 'QX-48120307', discount: '手足 -200', handler: '陳怡君' },
	{ id: 'DF-24053', member: '楊承翰', initial: '楊', color: '#14B8A6', item: '競技體操 選手班 · 春季', amount: 6200, status: 'paid', method: '街口支付', date: '06/04 10:18', invoice: 'QX-48120291', discount: '—', handler: '林雅婷' },
	{ id: 'DF-24052', member: '何宜蓁', initial: '何', color: '#0EA5E9', item: '兒童基礎 A 班 · 春季', amount: 3200, status: 'paid', method: '信用卡', date: '06/03 18:50', invoice: 'QX-48120284', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24051', member: '蘇柏丞', initial: '蘇', color: '#F59E0B', item: '跑酷入門班 · 春季', amount: 3400, status: 'pending', method: 'ATM 轉帳', date: '06/03 14:05', invoice: 'QX-48120270', discount: '—', handler: '系統自動' },
	{ id: 'DF-24050', member: '江品妍', initial: '江', color: '#8B5CF6', item: '幼兒體操 律動班 · 春季', amount: 2800, status: 'paid', method: 'LINE Pay', date: '06/02 11:22', invoice: 'QX-48120263', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24049', member: '高梓睿', initial: '高', color: '#0066CC', item: '競技啦啦隊 基礎班 · 春季', amount: 4200, status: 'paid', method: '信用卡', date: '06/02 09:40', invoice: 'QX-48120251', discount: '手足 -200', handler: '陳怡君' },
	{ id: 'DF-24048', member: '范詠晴', initial: '范', color: '#EC4899', item: '成人體操 進階班 · 春季', amount: 3900, status: 'pending', method: '現金', date: '06/01 19:30', invoice: 'QX-48120240', discount: '—', handler: '王思齊' },
	{ id: 'DF-24047', member: '董昊天', initial: '董', color: '#10B981', item: '競技體操 預備班 · 春季', amount: 5200, status: 'paid', method: '信用卡', date: '06/01 15:12', invoice: 'QX-48120233', discount: '續報 -300', handler: '林雅婷' },
	{ id: 'DF-24046', member: '鄧子萱', initial: '鄧', color: '#0EA5E9', item: '兒童基礎 假日班 · 春季', amount: 3200, status: 'paid', method: 'LINE Pay', date: '05/31 16:48', invoice: 'QX-48120221', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24045', member: '石宥廷', initial: '石', color: '#F59E0B', item: '跑酷 進階班 · 春季', amount: 3800, status: 'refunded', method: '信用卡', date: '05/31 10:05', invoice: 'QX-48120214', discount: '—', handler: '王思齊', reason: '重複報名，退一筆' },
	{ id: 'DF-24044', member: '韓欣怡', initial: '韓', color: '#8B5CF6', item: '幼兒體操 親子探索 · 體驗', amount: 600, status: 'paid', method: '現金', date: '05/30 11:30', invoice: 'QX-48120208', discount: '體驗折抵', handler: '黃詩涵' },
	{ id: 'DF-24043', member: '龔睿哲', initial: '龔', color: '#0066CC', item: '競技啦啦隊 兒童班 · 春季', amount: 3800, status: 'paid', method: '信用卡', date: '05/30 09:18', invoice: 'QX-48120197', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24042', member: '簡若彤', initial: '簡', color: '#EC4899', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: 'LINE Pay', date: '05/29 20:40', invoice: 'QX-48120185', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24041', member: '王承恩', initial: '王', color: '#0066CC', item: '月票 · 自由練習', amount: 2800, status: 'paid', method: '信用卡', date: '05/29 13:02', invoice: 'QX-48120172', discount: '—', handler: '系統自動' },
	{ id: 'DF-24040', member: '陳思妤', initial: '陳', color: '#EC4899', item: '10 堂回數票', amount: 5400, status: 'paid', method: 'LINE Pay', date: '05/28 18:25', invoice: 'QX-48120166', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24039', member: '周哲瑋', initial: '周', color: '#10B981', item: '比賽觀賽票 × 2', amount: 700, status: 'pending', method: 'ATM 轉帳', date: '05/28 10:50', invoice: 'QX-48120154', discount: '—', handler: '系統自動' },
	{ id: 'DF-24038', member: '蔡昀軒', initial: '蔡', color: '#F59E0B', item: '體驗券 · 單堂', amount: 600, status: 'paid', method: '街口支付', date: '05/27 17:15', invoice: 'QX-48120147', discount: '體驗折抵', handler: '陳怡君' },
	{ id: 'DF-24037', member: '葛欣妍', initial: '葛', color: '#14B8A6', item: '兒童基礎 B 班 · 春季', amount: 3200, status: 'paid', method: '信用卡', date: '05/27 11:08', invoice: 'QX-48120138', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24036', member: '侯昊瑋', initial: '侯', color: '#0EA5E9', item: '競技體操 選手班 · 春季', amount: 6200, status: 'paid', method: 'LINE Pay', date: '05/26 19:52', invoice: 'QX-48120125', discount: '續報 -300', handler: '林雅婷' },
	{ id: 'DF-24035', member: '孫詠晴', initial: '孫', color: '#F59E0B', item: '成人體操 基礎班 · 春季', amount: 3600, status: 'pending', method: 'ATM 轉帳', date: '05/26 10:30', invoice: 'QX-48120119', discount: '—', handler: '系統自動' },
	{ id: 'DF-24034', member: '白宜蓁', initial: '白', color: '#EC4899', item: '競技體操 預備班 · 春季', amount: 5200, status: 'paid', method: '信用卡', date: '05/25 16:14', invoice: 'QX-48120104', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24033', member: '方梓晴', initial: '方', color: '#F59E0B', item: '競技啦啦隊 基礎班 · 春季', amount: 4200, status: 'paid', method: '街口支付', date: '05/25 09:48', invoice: 'QX-48120097', discount: '手足 -200', handler: '陳怡君' },
	{ id: 'DF-24032', member: '卓宥希', initial: '卓', color: '#10B981', item: '幼兒體操 啟蒙班 · 體驗', amount: 600, status: 'paid', method: '現金', date: '05/24 11:20', invoice: 'QX-48120085', discount: '體驗折抵', handler: '黃詩涵' },
	{ id: 'DF-24031', member: '孔柏睿', initial: '孔', color: '#8B5CF6', item: '跑酷 進階班 · 春季', amount: 3800, status: 'pending', method: 'ATM 轉帳', date: '05/24 09:05', invoice: 'QX-48120078', discount: '—', handler: '系統自動' },
	{ id: 'DF-24030', member: '宋品睿', initial: '宋', color: '#0EA5E9', item: '兒童基礎 A 班 · 春季', amount: 3200, status: 'paid', method: '信用卡', date: '05/23 18:36', invoice: 'QX-48120066', discount: '—', handler: '陳怡君' },
	{ id: 'DF-24029', member: '秦語彤', initial: '秦', color: '#EC4899', item: '競技啦啦隊 進階班 · 春季', amount: 4800, status: 'paid', method: 'LINE Pay', date: '05/23 14:02', invoice: 'QX-48120051', discount: '早鳥 9 折', handler: '陳怡君' },
	{ id: 'DF-24028', member: '歐宇翔', initial: '歐', color: '#0EA5E9', item: '競技體操 預備班 · 春季', amount: 5200, status: 'paid', method: '信用卡', date: '05/22 10:44', invoice: 'QX-48120043', discount: '續報 -300', handler: '林雅婷' },
	{ id: 'DF-24027', member: '賀梓睿', initial: '賀', color: '#10B981', item: '跑酷入門班 · 春季', amount: 3400, status: 'refunded', method: '信用卡', date: '05/21 15:25', invoice: 'QX-48120034', discount: '—', handler: '王思齊', reason: '改報週四班，原班退款' },
	{ id: 'DF-24026', member: '武品妍', initial: '武', color: '#10B981', item: '親子體驗組', amount: 1000, status: 'paid', method: 'LINE Pay', date: '05/20 11:10', invoice: 'QX-48120021', discount: '—', handler: '黃詩涵' }
];
