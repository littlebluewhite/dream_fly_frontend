/* Dream Fly — pure redirect logic for the /member/* login guard.
 *
 * Extracted out of +layout.svelte so the redirect decision is unit-testable
 * without rendering the component (see docs/architecture.md → Testing: "the
 * convention — extract pure logic into a sibling .ts"). The four pre-auth
 * pages (login/register/forgot-password/reset-password) all use +page@.svelte
 * to escape this layout entirely, so in practice the guard only ever runs for
 * the real member pages — the whitelist below exists so the function is
 * correct on its own terms even if that routing choice changes later. */

const PUBLIC_MEMBER_PATHS = [
  '/member/login',
  '/member/register',
  '/member/forgot-password',
  '/member/reset-password'
];

/** Where an arrival at `pathname` should be redirected, given the current
 *  login state. Returns null when no redirect is needed — the visitor is
 *  logged in, or the path is one of the public (pre-auth) member pages. */
export function memberGuardTarget(pathname: string, loggedIn: boolean): string | null {
  if (loggedIn || PUBLIC_MEMBER_PATHS.includes(pathname)) return null;
  return `/member/login?redirect=${encodeURIComponent(pathname)}`;
}
