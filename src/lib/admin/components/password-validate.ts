/* Pure validation for the 變更密碼 dialog (admin.jsx SettingsView password
 * EditModal). The prototype's modal is mock-only — no current-password check —
 * so the only rules are: a new password must be non-empty, and the confirmation
 * must match it exactly. `current` is accepted for shape parity but not gated. */

export interface PasswordInput {
	current: string;
	next: string;
	confirm: string;
}

export interface PasswordResult {
	ok: boolean;
	error?: string;
}

export function validatePassword({ next, confirm }: PasswordInput): PasswordResult {
	if (!next) return { ok: false, error: '請輸入新密碼' };
	if (next !== confirm) return { ok: false, error: '兩次輸入的新密碼不一致' };
	return { ok: true };
}
