/* src/lib/domain/coaches.ts — 教練 seed data */

export interface Coach {
	id: string;
	name: string;
	initial: string;
	title: string;
	color: string;
	tags: string[];
	years: number;
	students: number;
	awards: number;
	classes: number;
	status: 'online' | 'busy' | 'offline';
	phone: string;
}

export const COACHES: Coach[] = [
	{ id: 'c1', name: '林雅婷', initial: '林', title: '資深競技體操教練 · 國家級認證', color: '#0066CC', tags: ['競技啦啦隊', '競技體操'], years: 12, students: 86, awards: 9, classes: 5, status: 'online', phone: '0912-345-678' },
	{ id: 'c2', name: '陳冠宇', initial: '陳', title: '兒童體操主教練 · 體操C級教練', color: '#0EA5E9', tags: ['兒童基礎', '幼兒體操'], years: 8, students: 64, awards: 3, classes: 4, status: 'online', phone: '0922-118-220' },
	{ id: 'c3', name: '黃詩涵', initial: '黃', title: '幼兒啟蒙教練 · 幼兒體適能認證', color: '#10B981', tags: ['幼兒體操', '親子課'], years: 5, students: 48, awards: 1, classes: 3, status: 'busy', phone: '0933-554-117' },
	{ id: 'c4', name: '王思齊', initial: '王', title: '跑酷與成人體操教練', color: '#F59E0B', tags: ['跑酷', '成人體操'], years: 7, students: 39, awards: 2, classes: 3, status: 'offline', phone: '0955-882-031' },
	{ id: 'c5', name: '張育誠', initial: '張', title: '競技啦啦隊助理教練', color: '#8B5CF6', tags: ['競技啦啦隊'], years: 4, students: 31, awards: 0, classes: 2, status: 'offline', phone: '0966-201-447' },
	{ id: 'c6', name: '周曉彤', initial: '周', title: '競技啦啦隊編排教練 · 啦啦隊 B 級', color: '#EC4899', tags: ['競技啦啦隊'], years: 6, students: 42, awards: 4, classes: 3, status: 'online', phone: '0977-114-258' },
	{ id: 'c7', name: '蘇建宏', initial: '蘇', title: '體能與跑酷專項教練 · 體適能C級', color: '#14B8A6', tags: ['跑酷', '成人體操'], years: 9, students: 53, awards: 5, classes: 4, status: 'busy', phone: '0988-336-470' },
	{ id: 'c8', name: '李孟潔', initial: '李', title: '幼兒啟蒙教練 · 幼兒體適能認證', color: '#0EA5E9', tags: ['幼兒體操', '親子課'], years: 6, students: 45, awards: 2, classes: 3, status: 'online', phone: '0912-556-330' },
	{ id: 'c9', name: '鄭凱文', initial: '鄭', title: '成人體操與體能教練 · 重訓專項', color: '#F59E0B', tags: ['成人體操', '跑酷'], years: 8, students: 41, awards: 3, classes: 3, status: 'busy', phone: '0921-667-441' }
];
