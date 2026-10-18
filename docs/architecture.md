# Architecture

A map of Dream Fly's frontend: which surfaces exist, where things live in `src/lib`, and which module's header
to read. Rules (invariants, protocol steps, when to use what) live in the owner module's header doc. Terms live
in `GLOSSARY.md`, decisions and their reasons in `docs/adr/`, and coding conventions in the `coding-standards`
skill.

## Seven surfaces, separated at the root layout

`src/routes/+layout.svelte` decides by path prefix (`isAppSurface`). Only the public/marketing site gets the
shared `Header`/`Footer`. The six app surfaces bring their own chrome through a nested `+layout.svelte` or a
layout-resetting `+page@.svelte` (the login pages). `global.css` loads at the root for every surface. A new app
surface must add its prefix there; see that file's header.

| Surface | Routes | Chrome |
| --- | --- | --- |
| Public / marketing (guest) | `/`, `/courses`, `/coaches`, `/venues`, `/schedule`, `/tickets`, `/contact`, `/cart` | shared `Header`/`Footer` |
| Member centre | `/member/*` | nested layout |
| Admin back-office | `/admin/*` | nested layout |
| Coach work-portal | `/coach/*` | nested layout |
| Staff login + role switch | `/staff/login` | bare |
| Mobile (member) | `/mobile/*` | nested layout + overlay host |
| Mobile-admin (staff) | `/mobile-admin/*` (`admin` + `coach`) | nested layout + overlay host |

Four nested layouts depend on who is logged in: member, mobile, coach and mobile-admin. Each hands its slot to
the **session scope** (身分範圍, `src/lib/components/SessionScope.svelte`) and declares only its own inputs as
module-level constants: a guard, a warm set, and the overlay to close where it has one. The scope runs the
guard, warms the identity the guard admits, and ties the page's lifetime to the login identity; the root and
admin layouts don't use it (`docs/adr/0028` §2). Rules: the component's header.

## `src/lib` is organized by surface, not by file type

Each surface owns a folder under `src/lib/`: `admin/`, `coach/`, `member/`, `mobile/`, `mobile-admin/`,
`staff/`, plus `public/` for the marketing site. A surface folder typically holds `data.ts` (the surface
facade, below), `stores.ts`, `nav.ts` (the nav model, unit-tested), `format.ts`, `api.ts` (the API seam) and a
`components/` or `overlays/` folder. `staff/` holds only `roles.ts`. `member/stores.ts` is a barrel over
member's concern modules (`waitlist.ts`, `leave.ts`, `points.ts`, `subscriptions.ts`, `checkout-sync.ts`,
`notifications.ts`, `ui.ts`); its header says where new code goes. Admin's Reports API lives in
`admin/reports-api.ts`, re-exported by `admin/api.ts`.

Cross-surface code:

- lib-root single-file modules: `cart.ts`, `cart-item.ts`, `checkout-math.ts`, `checkout-gate.ts`,
  `format.ts`, `load-gate.ts`, `hydration-gate.ts`, `session-gate.ts`, `store-warm.ts`, `login-submit.ts`,
  `self-account.ts`, `icon-registry.ts`.
- `lib/api/` (transport, tokens, wire knowledge, error copy, generated wire types), `lib/stores/`
  (`authStore`, `login-state`, `toasts` + `marketingToasts`, `read-state`, the marketing-only
  `notificationsStore`), `lib/components/` (marketing/shared UI and the shelves below), `lib/domain/`,
  `lib/data/` (marketing seed and nav config), `lib/styles/` (`global.css` and design tokens), `lib/types/`,
  `lib/utils/`, `lib/testing/`.

### `src/lib/domain/`: shared seed and display knowledge

Rules live in each file's header; the display-lookup rules (tables, `lookupOr`) are in `src/lib/api/wire.ts`'s.

- `venues.ts`, `tickets.ts`, `members.ts`, `classes.ts`, `coaches.ts`, `orders.ts`, `activity.ts`: ops-pair
  (admin and mobile-admin) entity types and their status/type lookups.
- `course-level.ts` (levels, labels, tones), `sessions.ts` (`SESSION_STATUS`, `toTodaySession`),
  `attendance.ts` (attendance-status badge), `weekday.ts`, `session-format.ts`, `course-category.ts`.
- `member-app.ts`: constants and types shared by the member and mobile twins.
- `leave-requests.ts` (`leaveRow()`), `class-detail.ts`, `order-detail.ts`: row view-models shared by twins.

The `data.ts` facades of `admin`, `mobile-admin`, `member` and `mobile` hold local interfaces, mock data,
mappers and narrowing re-asserts, never a pass-through re-export (the test: `docs/adr/0019` §4). `coach`
imports `lib/domain` directly.

## Shared component shelves

- `lib/components/ui/`: cross-surface primitives barrelled through `index.ts`, including `Icon` and the async
  three-state components (`Skeleton`, `SkelCard`, `ErrorState`, `EmptyState`, `LoadGate`).
- `lib/components/mobile/`: the shelf both mobile surfaces use (`Sheet`, `TabBar`, `ScreenHeader`, …) and
  `overlay.ts`, the `createOverlay` factory. Each mobile surface's `overlay-registry.ts` maps ids to components
  and types `push()`/`sheet()` (`docs/adr/0022`).
- `lib/components/toast/`: the desktop, mobile and public adapters over `lib/stores/toasts.ts`
  (`docs/adr/0005`).
- `src/lib/icon-registry.ts`: every icon name. `IconName` makes an unregistered name a `npm run check` error
  (`docs/adr/0012`). `src/lib/mobile/foundation-contracts.test.ts` covers what `check` can't reach: the route
  inventory and CSS safety.

`src/lib/testing/` is test-only support (production never imports it); each module's header has its rules:
`import-scan.ts` (the scanner behind the seam contracts in `import-scan.test.ts`), `fake-router.ts` (the HTTP
seam behind `$lib/api/client`) with the `*-routes.ts` tables, `auth-fixtures.ts` and `coach-session.ts` (log in
through the real 登入狀態 core), `session-reset.ts`, `wire-fixtures.ts`, `page-lifetime.ts`,
`owner-switch-sweep.ts`, `seed-fixtures.ts`.

## Auth / cart / checkout: the domain core

Guests browse and fill the cart freely; login is required only at 結帳 (`docs/adr/0001`). Where each piece
lives (the rules are in each module's header):

- **登入狀態 (login state)**: the core `lib/stores/login-state.ts` owns the token pair, refresh, session
  generation, hydrate and cross-tab sync. `lib/stores/authStore.ts` is its public face (`$authStore`,
  `login`/`logout`/`hydrate`…, `sessionKey`/`lastSessionKey`). `lib/api/tokens.ts` is the core's private
  storage adapter. `lib/api/client.ts`'s `api()` is the transport: it asks the core for credentials and owns the
  401 resend. `lib/api/base-url.ts` builds URLs for both (`docs/adr/0006`, `docs/adr/0028` §1).
- **本人帳號資料 (self account)**: `lib/self-account.ts`, the logged-in user's own `/users/me` profile and
  notification preferences, one store shared by member, mobile and coach.
- **The one cart**: `lib/cart.ts` (`createCart`, the persisted app-wide `cart`, `cartCount`); the item type is
  in `lib/cart-item.ts`. Mobile takes its own non-persisting instance in `lib/mobile/stores.ts`.
- **Checkout routing contract**: `lib/checkout-gate.ts` (`checkoutTarget`, `wantsCheckout`, `safeRedirect`);
  the receiving side is `routes/member/+layout.svelte`.
- **結帳 (checkout)**: below. 報名 and 訂閱 stay independent products (`docs/adr/0001`).
- **Staff portals**: `lib/staff/roles.ts` (`staffPortals`, `staffGuardTarget`, `ROLE_HOME`).
- **Google OAuth callback**: `lib/components/GoogleCallbackCard.svelte`, shared by member's and mobile's
  `/login/google` routes. Staff and mobile-admin have no Google login.

**Checkout core.** `lib/member/checkout-controller.ts` is the 結帳 payment machine (lifecycle, form, coupon,
preview, the idempotency key). Surfaces never build it directly: `lib/member/checkout-sync.ts`'s
`createCheckout` assembles it, and `lib/member/checkout.ts`'s `chargeableLines` is the one filter the order and
the cart previews share. Consumers: member's `CheckoutDialog` and the `checkout` singleton in
`lib/mobile/stores.ts` that `CartSheet` drives. Rules: the three module headers (`docs/adr/0016`).

## API 接縫 (seam): every app surface but `staff` has an `api.ts`

`public`, `admin`, `coach`, `member`, `mobile` and `mobile-admin` each have `src/lib/<surface>/api.ts`: async
getters over the real backend, built on `api<T>()` in `lib/api/client.ts`. `mobile/api.ts` is a thin layer over
`member/api.ts`; `mobile-admin/api.ts` keeps only its combinators over `admin/api` and `coach/api`. Backend wire
knowledge shared across surfaces is in `lib/api/wire.ts` (`docs/adr/0007`); response types are in
`lib/api/generated/`, mirrored from the backend. Error copy: `lib/api/error-text.ts`, plus
`lib/coach/load-error-copy.ts` for coach load errors. Pages load through `lib/load-gate.ts` and render the three
states with `lib/components/ui/LoadGate.svelte`. The P2 gaps with no backend endpoint are inventoried in
`docs/adr/0006`. Rules: the headers of those modules and of each `api.ts`.

The public seam is `lib/public/api.ts` (public endpoints, `auth: false`) plus `adapters.ts`, the only place that
converts cents/enum/id shapes into marketing types. `ScheduleCalendar`'s pure logic is in
`lib/public/calendar-grid.ts` and `calendar-selection.ts`. The `admin` and `coach` `Sidebar.svelte`/
`Topbar.svelte` shells are outside the seam (`docs/adr/0013` §2).

## Shared stores: hydration gate, session gate, warm sets

A store with more than one hydration trigger owns a `createHydrationGate` from `src/lib/hydration-gate.ts`. The
gate holds the hydration protocol, the one write verb `write()`, `reset()` and `pageEntry()`. Identity-free
gates are mobile-admin's three ops units in `mobile-admin/stores.ts` (members, courses·coaches, orders) and the
marketing announcements in `stores/notificationsStore.ts`. Identity-scoped gates go through `session-gate.ts`:
`member/waitlist`, `member/leave`, `member/notifications` (one module for member and mobile), `self-account`,
the coach identity in `coach/api`, and `coach/conversations` (desktop coach and mobile-admin). Protocol:
`hydration-gate.ts`'s header. Readers, mutators and refetch fan-out: the owning store's header
(`docs/adr/0016`, `docs/adr/0025`).

`src/lib/session-gate.ts` (`docs/adr/0017`) is the one module that makes stores identity-aware. It keys on
`sessionIdentity()` from `stores/authStore`, resets a store when the identity changes, and drops responses that
left before the switch. `createSessionGate` is a hydration gate plus that reset, an epoch-checked fetch and a
serialized `queueWrite()` chain. `createSessionRefresher` always refetches (points, subscriptions). Rules: the
module header.

`src/lib/store-warm.ts`'s `warmStores(caller, tasks)` runs a warm set best-effort. App layouts hand a
module-level warm set to the session scope for the stores their shell reads (badges). The root layout warms
subscriptions and announcements for the marketing shell, and a few pages warm extras beside their main fetch.
Rules: `store-warm.ts`'s header.

## Load gate vs. hydration gate: which one owns a shared store's fetch?

Ask one question: can this data's hydration be triggered from more than one place, independent of any one
page's load gate (another page, a warm set, another getter or mutator)?

- No: the page owns it with `createLoadGate({ fetch, onData })` (`src/lib/load-gate.ts`).
- Yes, and the data is identity-free: a store-owned `createHydrationGate`. Example: mobile-admin ops, where
  several pages read one `coaches`/`orders` and a write on one page refreshes another page's list.
- Yes, and the data belongs to the login identity: `createSessionGate`. Examples: member notifications (the
  member and mobile pages plus both layouts' warm sets share one flag) and the coach conversation list (two
  surfaces' pages, warm sets and the dashboard).
- Identity-scoped, and every call must really fetch: `createSessionRefresher` (points, subscriptions).

How a page on a shared store enters its load gate (頁面進場包, the page entry): the headers of
`hydration-gate.ts` and `load-gate.ts` (`docs/adr/0025`).

## Admin write rules: one module per entity

Each admin entity's "form values → validation → request body" step is one pure module in
`src/lib/admin/components/` (`docs/adr/0023`):

- `course-request.ts`: course draft, `checkCourseDraft`, create/update bodies.
- `member-request.ts`: `checkNewMember`/`checkMemberEdit`.
- `coach-save.ts`: `checkNewCoach`/`checkCoachEdit` and the two-step account-then-coach save.
- `order-status.ts`: legal status transitions, the revenue rule, `changeOrderStatus`.

The desktop dialogs and mobile-admin's `MemberForm`/`ClassForm`/`CoachForm` validate with the same modules;
mobile-admin's orders page uses only `order-status.ts`'s revenue rule. Where copy lives and the add/edit split
are in each module's header; cross-entity CRUD helpers: `docs/adr/0018` C6.

## Page controllers and twin modules

When a page's state orchestration is worth testing on its own, it moves to a `.ts` module: effects injected as
deps, one snapshot store (or IO callbacks), `kind`-tagged outcomes, toast copy left on the page.
`docs/adr/0012` sets the criteria; `docs/adr/0014` §2 lets desktop and mobile twins share one module. Guards
and boundaries are in each module's header. Under `src/lib/`:

- `coach/attendance-controller.ts`: coach attendance, mobile-admin coach attendance
- `coach/messages-controller.ts`: coach messages, mobile-admin `MessageThread`
- `coach/conversations-filter.ts`: coach messages
- `coach/clock-controller.ts`: coach home
- `coach/student-forms.ts`: `CertificateDialog`/`ReportCardDialog`, mobile-admin `StudentActionSheet`
- `coach/data.ts`'s `ATT_CHOICES`: the one attendance-status list for both attendance pages
- `member/checkout-controller.ts`: member `CheckoutDialog`, mobile `CartSheet` (see Checkout core)
- `member/mine-controller.ts`: member/mine
- `member/leave-form.ts`: `LeaveDialog`/`MakeupDialog`, mobile `LeaveSheet`/`MakeupSheet`
- `member/cancel-leave.ts`: member/mine, mobile `MyCourseDetail`
- `admin/settings-form.ts`: admin settings, mobile-admin `AdminSettingsScreen`
- `admin/components/coach-save.ts`: admin coaches, mobile-admin `CoachesScreen` (through `stores.ts`)
- `public/contact-form.ts`: `ContactForm.svelte`
- `login-submit.ts`: the member, mobile, mobile-admin and staff login pages, plus member's register, reset and
  forgot pages (IO callbacks, not a store)

## Testing

Vitest + `@testing-library/svelte` in jsdom (setup in `src/vitest-setup.ts`), with co-located `*.test.ts`
(routes use `page.test.ts` / `layout.test.ts`). The convention — extract pure logic into a sibling `.ts` so it's
testable without rendering — is a coding standard; see the `coding-standards` skill → `references/frontend.md`.
Page and api tests go through the HTTP seam (`lib/testing/fake-router.ts`) and never mock an `api.ts`. Not every
module has a same-named test: `member/leave.ts` is covered by `member/leave-requests-api.test.ts`, and the gate
protocols are tested generically in `hydration-gate.test.ts` and `session-gate.test.ts`.

## Mobile surfaces use an overlay host, not nested routes

`/mobile` and `/mobile-admin` render secondary views as push screens and sheets through `OverlayHost.svelte` and
an `overlays/` folder, not as extra SvelteKit routes. A new mobile view is usually a new overlay component plus
an entry in the surface's `overlay-registry.ts`.
