/* Dream Fly — auth-at-checkout gate (single-sourced routing contract).
 *
 * Guests fill a cart freely; login is required only when they hit "結帳".
 * Both halves of the gate live here so the trigger (cart surfaces) and the
 * receiver (member layout) can never drift apart:
 *  - checkoutTarget(): where the 結帳 button sends you, by login state.
 *  - wantsCheckout():  whether a landing URL asked to open the checkout dialog.
 *  - safeRedirect():   sanitise the post-login ?redirect= target (open-redirect guard). */

const CHECKOUT_DEST = '/member?checkout=1';

/** Where the 結帳 button navigates. A logged-in member goes straight to the
 *  member checkout; a guest is routed through login with a redirect that lands
 *  them back on the checkout once authenticated. */
export function checkoutTarget(loggedIn: boolean): string {
  return loggedIn
    ? CHECKOUT_DEST
    : `/member/login?redirect=${encodeURIComponent(CHECKOUT_DEST)}`;
}

/** True when a URL carries the ?checkout=1 marker — the member layout uses this
 *  to auto-open the checkout dialog after the login round-trip. */
export function wantsCheckout(url: URL): boolean {
  return url.searchParams.get('checkout') === '1';
}

/** Sanitise a post-login ?redirect= target. Only same-origin ROOT-RELATIVE paths
 *  are allowed, so a crafted link (?redirect=//evil.com, an absolute URL, or a
 *  backslash-prefixed authority) can't bounce a freshly-logged-in member off-site
 *  (open redirect -> phishing). Anything else falls back to the member home. */
export function safeRedirect(raw: string | null | undefined): string {
  // Require a single leading '/', then reject '//' and a backslash second char:
  // browsers normalise those to an external authority (protocol-relative or
  // backslash tricks like /\evil.com).
  if (!raw || raw[0] !== '/' || raw[1] === '/' || raw[1] === '\\') {
    return '/member';
  }
  return raw;
}
