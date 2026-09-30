/* Dream Fly — pure redirect logic for the /mobile-admin/* login + role guard.
 *
 * Task 20: replaces the demo `df_madmin_session`/`df_madmin_role` localStorage
 * flags — real gate is authStore token + roles, same role-determination path
 * as desktop staff (`$lib/staff/roles`'s staffPortals()). Unlike desktop,
 * mobile-admin serves BOTH the admin and coach portals from one layout (role
 * is a path segment, see nav.ts's roleFromPath), and it has its OWN login
 * page — a blocked/unauthenticated visitor is bounced to `/mobile-admin/login`,
 * never to desktop's `/staff/login` (that would break out of the phone-frame
 * surface entirely). */
import { staffPortals } from '$lib/staff/roles';
import { roleFromPath, roleHome } from '$lib/mobile-admin/nav';

export const MOBILE_ADMIN_LOGIN_PATH = '/mobile-admin/login';

/** Where an arrival at `pathname` should be redirected, given the current
 *  login state — used by `+layout.svelte`, which guards every `/mobile-admin/
 *  {admin,coach}/*` page. Returns null when no redirect is needed: the visitor
 *  holds the portal's role, is already on the login page, or is on a path
 *  with no role segment (the bare `/mobile-admin` root — it owns its own
 *  forward-redirect via `mobileAdminRootTarget`, not this guard). */
export function mobileAdminGuardTarget(pathname: string, loggedIn: boolean, roles: string[]): string | null {
	if (pathname === MOBILE_ADMIN_LOGIN_PATH) return null;
	const portal = roleFromPath(pathname);
	if (portal === null) return null;
	if (!loggedIn) return MOBILE_ADMIN_LOGIN_PATH;
	if (!staffPortals(roles).includes(portal)) return `${MOBILE_ADMIN_LOGIN_PATH}?blocked=1`;
	return null;
}

/** Where the bare `/mobile-admin` root should forward to, given the current
 *  login state — mirrors `ROLE_HOME`'s role→home mapping (`$lib/staff/roles`)
 *  but resolves to the phone-frame surface's own per-role tab root
 *  (`adminPath`). A visitor with no staff portal access (e.g. a plain member)
 *  is bounced to login with the same `?blocked=1` marker the layout guard
 *  uses, so the login page shows「此帳號無後台權限」immediately. */
export function mobileAdminRootTarget(loggedIn: boolean, roles: string[]): string {
	if (!loggedIn) return MOBILE_ADMIN_LOGIN_PATH;
	const target = staffPortals(roles)[0];
	if (!target) return `${MOBILE_ADMIN_LOGIN_PATH}?blocked=1`;
	return roleHome(target);
}
