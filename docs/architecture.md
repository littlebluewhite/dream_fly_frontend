# Architecture

How Dream Fly's frontend is wired. Read this before touching routing, layouts, surfaces, `src/lib` stores, or the cart/checkout/auth flow. The *rules* for changing this code live in the `coding-standards` skill; this file is the *facts* — what exists and where it lives.

## Seven surfaces, separated at the root layout

`src/routes/+layout.svelte` is the hinge. It inspects `$page.url.pathname` and only wraps the **public /
marketing** site in the shared `Header`/`Footer`. The six "app" surfaces start with a path prefix and
bring their own chrome via a nested `+layout.svelte` (or a layout-resetting `+page@.svelte`, e.g. the
member login). `global.css` loads at the root for everyone, so design tokens / `.btn` / `.card` apply
everywhere regardless of surface.

| Surface | Routes | Chrome |
| --- | --- | --- |
| Public / marketing (guest) | `/`, `/courses`, `/coaches`, `/venues`, `/schedule`, `/tickets`, `/contact`, `/cart` | shared `Header`/`Footer` |
| Member centre | `/member/*` | nested layout |
| Admin back-office | `/admin/*` | nested layout |
| Coach work-portal | `/coach/*` | nested layout |
| Staff login + role switch | `/staff/login` | bare |
| Mobile (member) | `/mobile/*` | nested layout + overlay host |
| Mobile-admin (staff) | `/mobile-admin/*` (`admin` + `coach`) | nested layout + overlay host |

(Adding a new surface has a wiring rule — see the `coding-standards` skill → `references/frontend.md`.)

## `src/lib` is organized by surface, not by file type

Each surface owns a folder under `src/lib/` (`admin/`, `coach/`, `member/`, `mobile/`, `mobile-admin/`,
`staff/`) typically containing: `data.ts` (mock seed), `stores.ts` (Svelte stores), `nav.ts`, `format.ts`,
and a `components/` (or `overlays/`) subfolder. Cross-surface shared code lives in:
`lib/components/` (marketing/shared UI), `lib/data/` (marketing seed + nav config), `lib/stores/`
(`authStore` is cross-cutting; `toastStore`/`notificationsStore` belong to the public/marketing surface), `lib/styles/` (`global.css` + design tokens), `lib/types/`, `lib/utils/`.

## Auth / cart / checkout — the domain core (read `docs/adr/0001` first)

Where the pieces live (the *rules* for changing them are in the `coding-standards` skill):

- **auth-at-checkout**: guests browse and fill the cart freely; login is required **only** at 結帳
  (checkout). Session lives in `lib/stores/authStore.ts` (mock, persisted to `localStorage` key
  `dreamfly_auth`).
- **One persistent cart** spanning guest → login → checkout: `lib/member/stores.ts` exports the single
  app-wide `cart = createCart(true)` (persisted to `dreamfly_cart_v2`). The `createCart(persist=false)`
  factory exists so tests get an isolated, non-persisting cart.
- **Routing contract is single-sourced** in `lib/checkout-gate.ts`: `checkoutTarget()`, `wantsCheckout()`,
  and `safeRedirect()` (open-redirect guard — only same-origin root-relative `?redirect=` targets allowed).
- **Course vs Pass**: a `type: 'course'` line checks out as 報名 (enrolment; mock, awards points only —
  does **not** write to schedule); a `type: 'pass'` line as 訂閱 (entitlement, persisted to
  `dreamfly_subscriptions`). Per ADR 0001 the two are independent.
- **Waitlist guard:** a full course (`spots: 0`) is blocked from the paid cart and routed to 候補
  (waitlist) — see the `AddResult = 'added' | 'bumped' | 'waitlisted'` add path in member stores.
- **Staff role switch:** `lib/staff/roles.ts` maps admin↔coach and remembers the last role in
  `df_staff_last_role`.

Known, deferred caveat (ADR 0001): persisted stores read `localStorage` at module-init, which can cause a
hydration flicker on a hard reload of a logged-in SSR page. Intentional follow-up, not a regression.

## Testing

Vitest + `@testing-library/svelte` (jsdom, setup in `src/vitest-setup.ts`), with co-located `*.test.ts`.
The *convention* — extract pure logic into a sibling `.ts` so it's testable without rendering — is a
coding standard; see the `coding-standards` skill → `references/frontend.md`.

## Mobile surfaces use an overlay host, not nested routes

`/mobile` and `/mobile-admin` render most secondary views as sheets/screens via `OverlayHost.svelte` +
an `overlays/` folder, rather than as additional SvelteKit routes. New mobile views usually mean a new
overlay component + a store entry, not a new route.
