export type StaffRole = 'admin' | 'coach';

export const STAFF_ROLE_KEY = 'df_staff_last_role';

export const ROLE_HOME: Record<StaffRole, string> = { admin: '/admin', coach: '/coach' };

/** Persist the staff's chosen role so /staff/login can remember it. Navigation is done by the caller. */
export function rememberStaffRole(role: StaffRole): void {
  try {
    localStorage.setItem(STAFF_ROLE_KEY, role);
  } catch (_) {
    // SSR (no localStorage) or quota — persistence is best-effort, never fatal to the switch.
  }
}
