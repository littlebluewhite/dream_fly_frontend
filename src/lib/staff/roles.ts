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

/** Which staff portals `roles` (from GET /users/me) may enter. An admin can
 *  also enter the coach portal (switches view via the sidebar's 切換至其他身分
 *  role switch); a coach-only account gets coach alone; anything else (e.g. a
 *  plain member) gets none. */
export function staffPortals(roles: string[]): StaffRole[] {
  if (roles.includes('admin')) return ['admin', 'coach'];
  if (roles.includes('coach')) return ['coach'];
  return [];
}

const BLOCKED_QUERY = 'blocked';

/** Where a visitor to `portal` should be redirected, given their current login
 *  state — mirrors src/routes/member/guard.ts's memberGuardTarget. Returns
 *  null when no redirect is needed (the visitor holds the portal's role).
 *  Unlike the member guard, there's no pathname whitelist to consult:
 *  /admin/* and /coach/* have no pre-auth pages of their own (login lives
 *  outside, at /staff/login), so every path under either prefix is guarded
 *  the same way. */
export function staffGuardTarget(portal: StaffRole, loggedIn: boolean, roles: string[]): string | null {
  if (!loggedIn) return '/staff/login';
  if (!staffPortals(roles).includes(portal)) return `/staff/login?${BLOCKED_QUERY}=1`;
  return null;
}

/** True when a URL carries the ?blocked=1 marker set by staffGuardTarget — the
 *  staff login page shows 「此帳號無後台權限」 immediately on arrival when this
 *  is true, without requiring a fresh failed login attempt. */
export function wantsBlockedNotice(url: URL): boolean {
  return url.searchParams.get(BLOCKED_QUERY) === '1';
}
