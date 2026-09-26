import { describe, it, expect } from 'vitest';
import {
	checkNewMember,
	checkMemberEdit,
	MEMBER_EMAIL_ERROR,
	MEMBER_NAME_ERROR,
	MEMBER_PHONE_ERROR,
	MEMBER_PASSWORD_ERROR,
	type NewMemberDraft,
	type MemberEditDraft,
	type MemberErrors
} from './member-request';

/* member-request.ts — 學員寫入 module（R13 Task 4 / C2）。三個學員表單共用，這裡測規則
 * 與 body；表單測試只剩接線。 */
const NEW: NewMemberDraft = { email: 'new@example.com', name: '新學員', phone: '', password: 'abcd1234', birthDate: '' };
const EDIT: MemberEditDraft = { name: '王小明', phone: '0912345678', isActive: true };

const errorsOfNew = (over: Partial<NewMemberDraft>): MemberErrors => {
	const r = checkNewMember({ ...NEW, ...over });
	return r.kind === 'invalid' ? r.errors : {};
};
const errorsOfEdit = (over: Partial<MemberEditDraft>): MemberErrors => {
	const r = checkMemberEdit({ ...EDIT, ...over });
	return r.kind === 'invalid' ? r.errors : {};
};

describe('checkNewMember — POST /users body', () => {
	it('valid ⇒ trim 後的 email/name/phone + 原樣密碼', () => {
		expect(checkNewMember({ ...NEW, email: '  new@example.com ', name: ' 新學員 ', phone: ' 0911222333 ' })).toEqual({
			kind: 'valid',
			body: { email: 'new@example.com', name: '新學員', phone: '0911222333', password: 'abcd1234' }
		});
	});

	it('電話、生日留空 ⇒ 省略欄位；生日有填 ⇒ birth_date', () => {
		const r = checkNewMember(NEW);
		expect(r.kind === 'valid' && r.body).toEqual({ email: 'new@example.com', name: '新學員', password: 'abcd1234' });
		const r2 = checkNewMember({ ...NEW, birthDate: '2015-06-12' });
		expect(r2.kind === 'valid' && r2.body.birth_date).toBe('2015-06-12');
	});

	it.each<[string, Partial<NewMemberDraft>, MemberErrors]>([
		['email 空白', { email: '  ' }, { email: MEMBER_EMAIL_ERROR }],
		['姓名 1 字', { name: '王' }, { name: MEMBER_NAME_ERROR }],
		['姓名 101 字', { name: '王'.repeat(101) }, { name: MEMBER_NAME_ERROR }],
		['電話 7 字', { phone: '0912345' }, { phone: MEMBER_PHONE_ERROR }],
		['電話 21 字', { phone: '0'.repeat(21) }, { phone: MEMBER_PHONE_ERROR }],
		['密碼 7 碼', { password: '1234567' }, { password: MEMBER_PASSWORD_ERROR }],
		['密碼 129 碼', { password: 'a'.repeat(129) }, { password: MEMBER_PASSWORD_ERROR }]
	])('%s ⇒ invalid', (_l, over, errors) => {
		expect(errorsOfNew(over)).toEqual(errors);
	});

	it.each<[string, Partial<NewMemberDraft>]>([
		['姓名 2 字', { name: '王明' }],
		['姓名 100 字', { name: '王'.repeat(100) }],
		['電話 8 字', { phone: '09123456' }],
		['電話 20 字', { phone: '0'.repeat(20) }],
		['密碼 8 碼', { password: '12345678' }],
		['密碼 128 碼', { password: 'a'.repeat(128) }]
	])('邊界 %s ⇒ valid', (_l, over) => {
		expect(checkNewMember({ ...NEW, ...over }).kind).toBe('valid');
	});
});

describe('checkMemberEdit — PATCH /users/{id} body', () => {
	it('valid ⇒ { name, phone, is_active }，trim', () => {
		expect(checkMemberEdit({ name: ' 王大明 ', phone: ' 0900000000 ', isActive: false })).toEqual({
			kind: 'valid',
			body: { name: '王大明', phone: '0900000000', is_active: false }
		});
	});

	it('電話留空 ⇒ 省略欄位(PATCH 維持原值；後端無法清空電話)', () => {
		const r = checkMemberEdit({ ...EDIT, phone: '' });
		expect(r.kind === 'valid' && r.body).toEqual({ name: '王小明', is_active: true });
	});

	it.each<[string, Partial<MemberEditDraft>, MemberErrors]>([
		['姓名空白', { name: '  ' }, { name: MEMBER_NAME_ERROR }],
		['電話 7 字', { phone: '0912345' }, { phone: MEMBER_PHONE_ERROR }]
	])('%s ⇒ invalid', (_l, over, errors) => {
		expect(errorsOfEdit(over)).toEqual(errors);
	});
});
