/* src/lib/domain/classes.ts — 課程 seed data (base only; ClassRow derivation stays in admin) */

import type { Level } from './course-level';

export interface ClassBase {
	id: string;
	name: string;
	level: Level;
	cat: string;
	coach: string;
	room: string;
	day: string;
	time: string;
	enrolled: number;
	cap: number;
	age: string;
	price: number;
	status: '招生中' | '候補' | '額滿';
	wait: number;
	term: string;
	sessions: number;
}

export const CLASSES_BASE: ClassBase[] = [
	{ id: 'k1', name: '競技啦啦隊 進階班', level: '進階', cat: '競技啦啦隊', coach: '林雅婷', room: 'A 訓練館', day: '週二 / 週四', time: '19:00–20:30', enrolled: 11, cap: 12, age: '10–16 歲', price: 4800, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k2', name: '兒童基礎 B 班', level: '基礎', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週一 / 週三', time: '17:30–18:30', enrolled: 8, cap: 10, age: '7–9 歲', price: 3200, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k3', name: '幼兒體操 啟蒙班', level: '啟蒙', cat: '幼兒體操', coach: '黃詩涵', room: 'C 軟墊區', day: '週六', time: '10:00–11:00', enrolled: 6, cap: 8, age: '3–5 歲', price: 2800, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k4', name: '成人體操 基礎班', level: '基礎', cat: '成人體操', coach: '王思齊', room: 'A 訓練館', day: '週五', time: '20:00–21:30', enrolled: 9, cap: 12, age: '16 歲以上', price: 3600, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k5', name: '跑酷入門班', level: '入門', cat: '跑酷', coach: '王思齊', room: '戶外場', day: '週日', time: '15:00–16:30', enrolled: 7, cap: 10, age: '12 歲以上', price: 3400, status: '候補', wait: 2, term: '2026 春季', sessions: 12 },
	{ id: 'k6', name: '競技體操 選手班', level: '選手', cat: '競技體操', coach: '林雅婷', room: 'A 訓練館', day: '週二 / 週五', time: '17:00–19:00', enrolled: 12, cap: 12, age: '8–14 歲', price: 6200, status: '額滿', wait: 4, term: '2026 春季', sessions: 20 },
	{ id: 'k7', name: '親子體操 同樂班', level: '啟蒙', cat: '幼兒體操', coach: '黃詩涵', room: 'C 軟墊區', day: '週日', time: '10:00–11:00', enrolled: 5, cap: 8, age: '2–4 歲', price: 2600, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k8', name: '兒童基礎 A 班', level: '基礎', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週二 / 週四', time: '16:30–17:30', enrolled: 10, cap: 10, age: '7–9 歲', price: 3200, status: '額滿', wait: 3, term: '2026 春季', sessions: 16 },
	{ id: 'k9', name: '競技啦啦隊 基礎班', level: '基礎', cat: '競技啦啦隊', coach: '張育誠', room: 'A 訓練館', day: '週三 / 週六', time: '18:00–19:30', enrolled: 9, cap: 12, age: '8–12 歲', price: 4200, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k10', name: '幼兒體操 律動班', level: '啟蒙', cat: '幼兒體操', coach: '黃詩涵', room: 'C 軟墊區', day: '週三', time: '16:00–17:00', enrolled: 7, cap: 8, age: '3–5 歲', price: 2800, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k11', name: '成人體操 進階班', level: '進階', cat: '成人體操', coach: '王思齊', room: 'A 訓練館', day: '週四', time: '20:00–21:30', enrolled: 8, cap: 12, age: '16 歲以上', price: 3900, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k12', name: '競技體操 預備班', level: '進階', cat: '競技體操', coach: '林雅婷', room: 'A 訓練館', day: '週一 / 週四', time: '17:00–18:30', enrolled: 10, cap: 12, age: '7–12 歲', price: 5200, status: '招生中', wait: 0, term: '2026 春季', sessions: 18 },
	{ id: 'k13', name: '跑酷 進階班', level: '進階', cat: '跑酷', coach: '王思齊', room: '戶外場', day: '週六', time: '15:00–16:30', enrolled: 8, cap: 10, age: '14 歲以上', price: 3800, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k14', name: '兒童基礎 假日班', level: '基礎', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週日', time: '13:30–14:30', enrolled: 9, cap: 10, age: '7–9 歲', price: 3200, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k15', name: '競技啦啦隊 兒童班', level: '入門', cat: '競技啦啦隊', coach: '張育誠', room: 'A 訓練館', day: '週六', time: '16:00–17:30', enrolled: 11, cap: 12, age: '6–9 歲', price: 3800, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k16', name: '幼兒體操 親子探索', level: '啟蒙', cat: '幼兒體操', coach: '黃詩涵', room: 'C 軟墊區', day: '週日', time: '11:30–12:30', enrolled: 6, cap: 8, age: '2–4 歲', price: 2600, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k17', name: '幼兒體操 探索班', level: '啟蒙', cat: '幼兒體操', coach: '李孟潔', room: 'C 軟墊區', day: '週六', time: '09:00–10:00', enrolled: 7, cap: 8, age: '3–5 歲', price: 2800, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k18', name: '成人體適能 入門班', level: '入門', cat: '成人體操', coach: '鄭凱文', room: 'F 體能訓練室', day: '週二', time: '20:00–21:00', enrolled: 10, cap: 14, age: '16 歲以上', price: 3400, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k19', name: '競技啦啦隊 青少班', level: '進階', cat: '競技啦啦隊', coach: '周曉彤', room: 'A 訓練館', day: '週三 / 週五', time: '19:30–21:00', enrolled: 10, cap: 12, age: '13–17 歲', price: 5000, status: '招生中', wait: 0, term: '2026 春季', sessions: 16 },
	{ id: 'k20', name: '兒童基礎 體驗班', level: '啟蒙', cat: '兒童基礎', coach: '陳冠宇', room: 'B 教室', day: '週六', time: '14:00–15:00', enrolled: 6, cap: 10, age: '6–8 歲', price: 1800, status: '招生中', wait: 0, term: '2026 春季', sessions: 8 },
	{ id: 'k21', name: '跑酷 體能班', level: '基礎', cat: '跑酷', coach: '蘇建宏', room: '戶外場', day: '週四', time: '19:00–20:30', enrolled: 9, cap: 12, age: '12 歲以上', price: 3600, status: '招生中', wait: 0, term: '2026 春季', sessions: 12 },
	{ id: 'k22', name: '競技體操 菁英班', level: '選手', cat: '競技體操', coach: '林雅婷', room: 'A 訓練館', day: '週三 / 週六', time: '19:00–21:00', enrolled: 11, cap: 12, age: '9–15 歲', price: 6800, status: '候補', wait: 3, term: '2026 春季', sessions: 20 }
];
