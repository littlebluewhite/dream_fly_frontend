/* Dream Fly — 管理後台 · 學員寫入 module（R13 Task 4 / C2）。
 * 桌面 MemberCreateDialog / MemberEditDialog 與 mobile-admin MemberForm 三個表單共用：
 * 表單欄位 → checkNewMember()/checkMemberEdit() → valid 時直接是 POST/PATCH /users 的
 * body。新增與編輯是兩支函式、兩套型別（ADR-0022：不用 isNew）。
 *
 * 上限對齊後端 CreateUserRequest/UpdateUserRequest：姓名 2–100、電話 8–20（選填）、
 * 密碼 8–128（validator 以字元數計）。email 只檢查必填——格式交給後端 422。空白電話
 * 省略欄位：POST 是「無電話」；PATCH 是「維持原值」——後端 PATCH 沒有清空電話的
 * 語意（空字串會撞 8–20 字驗證），所以編輯時無法清空電話（遞延，需後端改）。
 *
 * 驗證文案住本檔（exported const，ADR-0012 ④）；toast 與 API 錯誤文案留頁面。 */
import type { CreateMemberBody, UpdateMemberBody } from '$lib/admin/api';

export interface NewMemberDraft {
	email: string;
	name: string;
	phone: string;
	password: string;
	/** YYYY-MM-DD；空字串＝不填。mobile 表單沒有這個欄位，傳空字串。 */
	birthDate: string;
}

export interface MemberEditDraft {
	name: string;
	phone: string;
	isActive: boolean;
}

export type MemberErrors = Partial<Record<'email' | 'name' | 'phone' | 'password', string>>;

export type NewMemberCheck = { kind: 'valid'; body: CreateMemberBody } | { kind: 'invalid'; errors: MemberErrors };
export type MemberEditCheck = { kind: 'valid'; body: UpdateMemberBody } | { kind: 'invalid'; errors: MemberErrors };

export const MEMBER_EMAIL_ERROR = '請輸入 Email';
export const MEMBER_NAME_ERROR = '姓名需為 2–100 字';
export const MEMBER_PHONE_ERROR = '電話需為 8–20 字，或留空';
export const MEMBER_PASSWORD_ERROR = '密碼需為 8–128 碼';

const charLen = (s: string) => [...s].length;
const inLen = (s: string, lo: number, hi: number) => charLen(s) >= lo && charLen(s) <= hi;

/** 姓名/電話兩個表單共用的規則，回傳 trim 後的值。 */
function checkNamePhone(name: string, phone: string, errors: MemberErrors) {
	const n = name.trim();
	const p = phone.trim();
	if (!inLen(n, 2, 100)) errors.name = MEMBER_NAME_ERROR;
	if (p && !inLen(p, 8, 20)) errors.phone = MEMBER_PHONE_ERROR;
	return { name: n, phone: p };
}

export function checkNewMember(d: NewMemberDraft): NewMemberCheck {
	const errors: MemberErrors = {};
	const email = d.email.trim();
	if (!email) errors.email = MEMBER_EMAIL_ERROR;
	const { name, phone } = checkNamePhone(d.name, d.phone, errors);
	if (!inLen(d.password, 8, 128)) errors.password = MEMBER_PASSWORD_ERROR;
	if (Object.keys(errors).length > 0) return { kind: 'invalid', errors };

	const body: CreateMemberBody = { email, name, password: d.password };
	if (phone) body.phone = phone;
	if (d.birthDate) body.birth_date = d.birthDate;
	return { kind: 'valid', body };
}

export function checkMemberEdit(d: MemberEditDraft): MemberEditCheck {
	const errors: MemberErrors = {};
	const { name, phone } = checkNamePhone(d.name, d.phone, errors);
	if (Object.keys(errors).length > 0) return { kind: 'invalid', errors };

	const body: UpdateMemberBody = { name, is_active: d.isActive };
	if (phone) body.phone = phone;
	return { kind: 'valid', body };
}
