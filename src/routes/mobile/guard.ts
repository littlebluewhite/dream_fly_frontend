/* Dream Fly — pure redirect logic for the /mobile/* login guard.
 *
 * Mirrors src/routes/member/guard.ts (same rationale: extracted so the
 * redirect decision is unit-testable without rendering the layout). Task 19:
 * replaces the demo `df_mobile_session` localStorage flag — real gate is
 * `authStore`/token, same as member. `/mobile/login` is the only pre-auth
 * page (`+page@.svelte` escapes this layout entirely, mirroring member's
 * login/register/etc.), so no `redirect` query round-trip is needed here
 * (mobile has no deep-link-then-bounce-back requirement the way checkout does
 * on desktop). */

const PUBLIC_MOBILE_PATHS = ['/mobile/login'];

/** Where an arrival at `pathname` should be redirected, given the current
 *  login state. Returns null when no redirect is needed — the visitor is
 *  logged in, or already on the login page. */
export function mobileGuardTarget(pathname: string, loggedIn: boolean): string | null {
  if (loggedIn || PUBLIC_MOBILE_PATHS.includes(pathname)) return null;
  return '/mobile/login';
}
