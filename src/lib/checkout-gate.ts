/* Dream Fly — auth-at-checkout gate (single-sourced routing contract).
 *
 * Guests fill a cart freely; login is required only when they hit "結帳".
 * Both halves of the gate live here so the trigger (cart surfaces) and the
 * receiver (member layout) can never drift apart:
 *  - checkoutTarget(): where the 結帳 button sends you, by login state.
 *  - wantsCheckout():  whether a landing URL asked to open the checkout dialog. */

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
