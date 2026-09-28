/* 種子測試夾具（R14 候選 F3、R15 候選 F-3）— 誠實開機後退役的 store 種子，值逐字搬自原處：
 *   - NOTIFS_SEED     ← $lib/domain/member-app(經 member/data.ts facade 收窄為嚴格 Tone)
 *   - POINTS_LEDGER   ← $lib/domain/member-app
 *   - MESSAGES        ← $lib/mobile-admin/data
 *   - COACHES         ← $lib/domain/coaches(R15 候選 F-3：mobile-admin 的 coaches store
 *                       誠實開機為 `[]`，COACHES 不再有 production 讀者)
 * production 的 notifications / pointsLedger / messages / mobile-admin coaches 開機值與
 * reset 值都是 `[]`(ADR 0010 死種子退役慣例:沒有 production 讀者的值不留在 src/lib 本體)。
 * 這裡只供測試用 `store.set(fixture)` 灌一份「有未讀、有明細」的狀態，或供測試檔直接
 * 引用當固定 fixture。 */
import type { Notification } from '$lib/member/data';
import type { LedgerEntry } from '$lib/domain/member-app';
import type { MessageRow } from '$lib/mobile-admin/data';
import type { Coach } from '$lib/domain/coaches';

/* 通知:n1–n3 未讀、n4–n6 已讀。 */
export const NOTIFS_SEED: Notification[] = [
	{ id: 'n1', cat: 'class', icon: 'calendar-clock', tone: 'primary', title: '明日課程提醒', body: '競技啦啦隊 進階班 · 明日 19:00 · A 訓練館，記得提前 10 分鐘到館熱身。', time: '1 小時前', read: false },
	{ id: 'n2', cat: 'coach', icon: 'message-circle', tone: 'info', title: '林雅婷 教練回覆了你的訊息', body: '承恩這週的後手翻進步很多，下週我們來加上連續動作。', time: '3 小時前', read: false },
	{ id: 'n3', cat: 'order', icon: 'credit-card', tone: 'success', title: '報名付款成功', body: '訂單 DF-24061 · 競技啦啦隊 進階班 · 2026 春季 NT$4,800 已完成付款。', time: '昨天', read: false },
	{ id: 'n4', cat: 'class', icon: 'rotate-cw', tone: 'info', title: '補課時段已開放', body: '5/21 請假的「競技體操 選手班」可於 6/13 10:00 補課，請於我的課程預約。', time: '2 天前', read: true },
	{ id: 'n5', cat: 'system', icon: 'award', tone: 'accent', title: '獲得會員點數 +120', body: '完課獎勵點數已入帳，目前可用點數 1,250 點。', time: '3 天前', read: true },
	{ id: 'n6', cat: 'system', icon: 'calendar-off', tone: 'warning', title: '端午連假停課公告', body: '6/14–6/16 全館停課，相關課程將安排補課，請留意通知。', time: '5 天前', read: true }
];

/* 點數明細。 */
export const POINTS_LEDGER: LedgerEntry[] = [
	{ id: 'pl1', date: '2026/06/05', desc: '完課獎勵 · 競技啦啦隊 進階班', type: 'earn', delta: 120 },
	{ id: 'pl2', date: '2026/05/20', desc: '折抵報名費 · 競技體操 選手班', type: 'redeem', delta: -300 },
	{ id: 'pl3', date: '2026/05/01', desc: '生日禮金點數', type: 'earn', delta: 200 },
	{ id: 'pl4', date: '2026/04/12', desc: '推薦好友報名獎勵', type: 'earn', delta: 150 },
	{ id: 'pl5', date: '2026/03/01', desc: '完課獎勵 · 兒童翻滾 技巧班', type: 'earn', delta: 120 },
	{ id: 'pl6', date: '2026/02/15', desc: '未使用點數到期', type: 'expire', delta: -50 }
];

/* 教練訊息串列:m1/m2/m9 未讀。 */
export const MESSAGES: MessageRow[] = [
	{ id: 'm1', from: '王先生（承恩家長）', initial: '王', color: '#0066CC', preview: '教練好，承恩這週四想多留半小時練後手翻，可以嗎？', time: '10 分鐘前', unread: true },
	{ id: 'm2', from: '陳先生（思妤家長）', initial: '陳', color: '#EC4899', preview: '謝謝教練上次的動作影片，思妤回家有跟著練！', time: '1 小時前', unread: true },
	{ id: 'm3', from: '館務管理員 陳怡君', initial: '陳', color: '#0F172A', preview: 'A 訓練館本週五場地維護，請改用 B 教室。', time: '今天 09:12', unread: false },
	{ id: 'm4', from: '蔡太太（昀軒家長）', initial: '蔡', color: '#F59E0B', preview: '昀軒下週一要請假，看牙醫，謝謝教練。', time: '昨天 18:40', unread: false },
	{ id: 'm5', from: '黃媽媽（柏睿家長）', initial: '黃', color: '#8B5CF6', preview: '教練好，柏睿想暫停一個月，下個月再回來上課可以嗎？', time: '2 小時前', unread: false },
	{ id: 'm6', from: '系統通知', initial: '系', color: '#0F172A', preview: '06/15（六）全館消防演練，當日 14:00–15:00 暫停排課。', time: '昨天 10:00', unread: false },
	{ id: 'm7', from: '周先生（哲瑋家長）', initial: '周', color: '#10B981', preview: '想詢問跑酷進階班的開課時間，謝謝！', time: '昨天 09:15', unread: false },
	{ id: 'm8', from: '高媽媽（梓睿家長）', initial: '高', color: '#0066CC', preview: '梓睿這週六比賽，想跟教練確認集合時間。', time: '2 天前', unread: false },
	{ id: 'm9', from: '李太太（宥蓁家長）', initial: '李', color: '#0EA5E9', preview: '宥蓁想換到週六的班別，請問還有名額嗎？', time: '30 分鐘前', unread: true },
	{ id: 'm10', from: '周曉彤 教練', initial: '周', color: '#EC4899', preview: '青少班這週需要多一位協助老師，可以幫忙安排嗎？', time: '今天 08:40', unread: false },
	{ id: 'm11', from: '武先生（品妍家長）', initial: '武', color: '#10B981', preview: '品妍的體驗券快到期了，想直接報名律動班。', time: '昨天 17:20', unread: false },
	{ id: 'm12', from: '系統通知', initial: '系', color: '#0F172A', preview: '06/20（六）夏季成果發表會開始售票，請協助於官網公告。', time: '2 天前', unread: false }
];

/* 教練名單，逐字搬自 $lib/domain/coaches 原 COACHES(R15 候選 F-3)。 */
export const COACHES: Coach[] = [
	{ id: 'c1', userId: 'u1', name: '林雅婷', initial: '林', title: '資深競技體操教練 · 國家級認證', color: '#0066CC', tags: ['競技啦啦隊', '競技體操'], isActive: true },
	{ id: 'c2', userId: 'u2', name: '陳冠宇', initial: '陳', title: '兒童體操主教練 · 體操C級教練', color: '#0EA5E9', tags: ['兒童基礎', '幼兒體操'], isActive: true },
	{ id: 'c3', userId: 'u3', name: '黃詩涵', initial: '黃', title: '幼兒啟蒙教練 · 幼兒體適能認證', color: '#10B981', tags: ['幼兒體操', '親子課'], isActive: true },
	{ id: 'c4', userId: 'u4', name: '王思齊', initial: '王', title: '跑酷與成人體操教練', color: '#F59E0B', tags: ['跑酷', '成人體操'], isActive: false },
	{ id: 'c5', userId: 'u5', name: '張育誠', initial: '張', title: '競技啦啦隊助理教練', color: '#8B5CF6', tags: ['競技啦啦隊'], isActive: false },
	{ id: 'c6', userId: 'u6', name: '周曉彤', initial: '周', title: '競技啦啦隊編排教練 · 啦啦隊 B 級', color: '#EC4899', tags: ['競技啦啦隊'], isActive: true },
	{ id: 'c7', userId: 'u7', name: '蘇建宏', initial: '蘇', title: '體能與跑酷專項教練 · 體適能C級', color: '#14B8A6', tags: ['跑酷', '成人體操'], isActive: true },
	{ id: 'c8', userId: 'u8', name: '李孟潔', initial: '李', title: '幼兒啟蒙教練 · 幼兒體適能認證', color: '#0EA5E9', tags: ['幼兒體操', '親子課'], isActive: true },
	{ id: 'c9', userId: 'u9', name: '鄭凱文', initial: '鄭', title: '成人體操與體能教練 · 重訓專項', color: '#F59E0B', tags: ['成人體操', '跑酷'], isActive: true }
];
