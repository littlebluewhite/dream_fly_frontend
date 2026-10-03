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
`staff/`) typically containing: `data.ts` (the surface facade — see the domain section below),
`stores.ts` (Svelte stores), `nav.ts`, `format.ts`, `api.ts` (API seam — see below), and a `components/`
(or `overlays/`) subfolder. `member/stores.ts` is the one exception to the single-file pattern: it's a
pure barrel re-exporting 7 concern modules that live alongside it (`waitlist.ts`, `leave.ts`,
`points.ts`, `subscriptions.ts`, `checkout-sync.ts`, `notifications.ts`, `ui.ts`) plus a pass-through of
lib-root's `cart.ts` (`docs/adr/0019`), so the four call sites that pull `cart` alongside other member
symbols in one import clause keep a single import — new store/function additions go in the owning
module, never in the barrel file itself. `nav.ts` is each chrome-bearing surface's navigation model
(`admin`/`coach`/`mobile`/`mobile-admin`) — the nav/tab item list and the `isActive` predicate, plus, on
`admin` and `coach`, the layout's longest-prefix `resolve()` title/subtitle map — as pure functions with
a sibling `nav.test.ts`. `admin`'s sidebar labels and its `TITLES` labels disagree in a few spots
(會員管理 vs 學員管理) — a pre-existing divergence kept verbatim, not unified. `admin/api.ts`'s Reports
group (`GET /reports/admin` types/mappers/`getReports`) lives in `admin/reports-api.ts`, with
`admin/api.ts` re-exporting it name-by-name so consumers keep importing `$lib/admin/api`; the file's other
groups (Settings, Courses) are not preemptively split (`docs/adr/0018`). Cross-surface shared code lives
in: lib-root single-file pure modules (`checkout-math.ts`/`checkout-gate.ts`/`checkout-order.ts`/
`load-gate.ts`/`hydration-gate.ts`; `cart-item.ts` — the `CartItem` types + `courseToCartItem`/
`passToCartItem` adapters, imported by member/mobile/public routes without going through a surface
facade; `format.ts` — `fmtNT` + `fmtRatio`, with `admin`'s `fmtPct` and `member`'s `fmtRate` as one-line
surface bindings over `fmtRatio` carrying each surface's null-label; and `cart.ts`, the `createCart`
factory plus the app-wide persisted singleton and `cartCount` — lib-root because the cart is a global
concept, not a member-surface one, see `docs/adr/0019`), `lib/components/` (marketing/shared UI, plus the
`ui/` and `mobile/` shelves below), `lib/data/` (marketing seed + nav config), `lib/domain/` (single-source
seed feeding several facades — see below), `lib/stores/` (`authStore` is cross-cutting; the toast deep
store `toasts.ts` / `marketingToasts.ts` is cross-cutting too, via three adapters in
`lib/components/toast/` per ADR 0005 — `notificationsStore` is public/marketing-only; `read-state.ts`'s
`createReadState` factory is the shared per-item read/unread store shape behind mobile-admin's and
coach's notification bells), `lib/styles/` (`global.css` + design tokens), `lib/types/`, `lib/utils/`.

## `src/lib/domain/` — single source for the ops-pair and member-app facades

`src/lib/domain/` holds seed and display knowledge shared across surfaces:

- **Ops entities** for the admin↔mobile-admin ops-pair: `venues.ts`, `tickets.ts`, `coaches.ts`,
  `activity.ts`, plus the entity type files `classes.ts` / `members.ts` / `orders.ts` (`ClassBase`/
  `OrderBase` interfaces — there are no base seed arrays; mobile-admin's ops collections boot empty, see
  the API seam section).
- **`member-app.ts`** — the member↔mobile desktop/mobile twin seed: 8 constants (`STATS`, `SKILLS`,
  `UPCOMING`, `WEEK`, `TIME_ROWS`, `CONTACT_THREAD`, `COACH_REPLIES`, `NOTIF_CATS`) plus type-only exports
  (`EnrolledCourse`/`ScheduleBlock`/`Order`, `LedgerEntry`/`LedgerType`) that back type annotations in
  `mobile/api.ts`, `member/points.ts` and the facades' own local interfaces. `ANNOUNCE` stays forked in
  each facade because one announcement's background colour differs between the two. The notification and
  points-ledger seed values (`NOTIFS_SEED`/`POINTS_LEDGER`) exist only as test fixtures in
  `src/lib/testing/seed-fixtures.ts` (`docs/adr/0010`, `docs/adr/0013`, `docs/adr/0024`).
- **Per-entity display lookups** — each entity file single-sources a status/type → tone-and-label
  lookup: `VENUE_STATUS` (`venues.ts`), `TICKET_TYPE` (`tickets.ts`), `MEMBER_ACCOUNT_STATUS`
  (`members.ts`), `STATUS_TONE` (`classes.ts`), `LEVEL_TONE` (`course-level.ts`) and `SESSION_STATUS`
  (`sessions.ts`, alongside the `TodayStatus` union) (`docs/adr/0013`,
  `docs/adr/0018`). `SESSION_STATUS` is the one today's-session-status table for `coach`, `admin` and
  `mobile-admin`; its canonical `live` label is `上課中`.
- **`session-format.ts`** — pure per-session display derivation, imported directly by its six
  member/mobile consumers with no facade hop (`docs/adr/0014`).
- **`class-detail.ts`** — `classDetailRows`, the 6-row `[icon, label, value]` course detail list behind
  `admin`'s `ClassDialog` and `mobile-admin`'s `ClassSheet`, plus `classFill(enrolled, cap)`, the
  full/percentage derivation (`cap <= 0` gives `pct: 0`, never `Infinity`/`NaN`). It maps to no backend
  enum and yields no `Tone`, so it isn't a per-entity lookup (`docs/adr/0013`, `docs/adr/0026`).
- **`order-detail.ts`** — `orderDetailRows(o)`, `class-detail.ts`'s sibling for orders: the 9-row (10 with
  a refund reason) detail list behind `admin`'s `OrderDialog` and `mobile-admin`'s `OrderSheet`, typed
  structurally over `OrderDetailSource` (`docs/adr/0023`, `docs/adr/0026`).
- **`leave-requests.ts`** — its public surface is a single function, `leaveRow(source): LeaveRow`
  (`{ tone, label, when, makeupWhen, action }`), which absorbs both the display lookup (the module-private
  `STATUS_BADGE`) and the one 請假 action rule — `pending` → cancel, `approved` without a makeup → book
  補課, `approved` with one → already booked, else nothing — behind a private `leaveAction(lr)`.
  `makeupWhen` is `null` (not an empty string) when the makeup session's date/time is missing. member/mine
  and mobile's `MyCourseDetail` both destructure `leaveRow()`'s result. It lives in an entity file rather
  than `member-app.ts`, whose header restricts it to constants and lookups, and mobile imports it directly
  as a pure function (`docs/adr/0022`, `docs/adr/0025`).
- **`sessions.ts`'s `toTodaySession(s)`** — projects the generated wire `TodaySessionResponse`
  (re-exported from `wire.ts`) onto a `TodaySession` with `'—'` for a missing coach/venue and the
  backend-derived `status` mapped to a `TodayStatus` (`upcoming`→`wait`, `ongoing`→`live`, `done`→`done`). `admin`'s `mapTodaySession` and `coach`'s `mapTodayClass`/`mapAttendanceClass` build on it
  instead of re-deriving `hhmm`/venue defaults/status themselves (`docs/adr/0023`).
- **`course-category.ts`** — `COURSE_CATEGORIES` (key/chip/trial label/icon/age) plus
  `courseCategoryIcon(cat)` (unknown → `graduation-cap`), the single source for `mobile`'s home, courses
  page, `TrialScreen` and `mobile/api.ts`; it yields no `Tone` and leaves `admin/data.ts`'s `CATS` alone
  (`docs/adr/0026`).

Four facades consume `lib/domain/` — each of `admin`'s, `mobile-admin`'s, `member`'s, and `mobile`'s
`data.ts` — and **none of them re-exports a pass-through** (`docs/adr/0019`): an export line that carries
no local type fact (no narrowing annotation, no `as` assertion, no local interface) and does no value
transformation over a same-name-same-type symbol from `$lib/domain` or `$lib/api/wire` doesn't belong in
a facade; consumers import the canonical source directly, with import-site aliases where a facade name
differs (`Activity as ActivityRow`). What the four `data.ts` files hold is what makes them facades: local
interfaces and local mock arrays, real mappers (`admin`'s `mapMemberAccount`), the `docs/adr/0013`
Form 2/3 narrowing re-asserts that genuinely re-assert a stricter local type over the same reference
(`member`'s and `mobile`'s `LEVEL_TONE`, `member`'s one `as`-assertion narrowing `UPCOMING`,
`mobile-admin`'s five status tables), and one ADR-named boundary seam: `mobile-admin/data.ts` re-exports
the `Student` type from `$lib/coach/data` — its canonical home — for mobile-admin's coach-side consumers
(`docs/adr/0014`, `docs/adr/0019`, `docs/adr/0026`). `coach` has no persona mapping into this shared
ops-pair/member-app seed, so it stays outside the four-facade group, but it does consume `lib/domain/`
directly: `coach/data.ts` imports `SESSION_STATUS` and `coach/api.ts` imports `toTodaySession` from
`domain/sessions.ts`. The guards on the domain values are `domain/member-app.test.ts`,
`status-lookups.test.ts` and `course-level.test.ts` — literal snapshots and row/key-count canaries, plus
`toBe` same-reference pins for exactly the narrowing re-asserts listed above. There is no facade-level
type-export regression test (`docs/adr/0009`, `docs/adr/0019`).

## Shared component shelves: `lib/components/ui` and `lib/components/mobile`

`lib/components/ui/` is the cross-surface primitive shelf (`Button`, `Card`, `Input`, `Dialog`, … barrelled
through `index.ts`) plus four async three-state components — `Skeleton`, `SkelCard`, `ErrorState`,
`EmptyState` — consumed by API-seam pages across every surface for their loading/error states; the
shimmer animation `Skeleton` uses (`df-shimmer`) is a `@keyframes` in `global.css`, not a per-component
style block. `lib/components/mobile/` is the parallel shelf for the two mobile surfaces — `Sheet`,
`TabBar`, `ScreenHeader`, plus smaller pieces (`HeaderIcon`, `NoteBox`, `SectionTitle`, …) — consumed
directly by both `mobile` and `mobile-admin`'s pages/overlays; each surface wraps the shared `TabBar` in
its own thin local component to attach its own tab items. The same shelf holds `overlay.ts` — the
`createOverlay` factory (push/pop screen stack + one bottom sheet), shared by `mobile` and
`mobile-admin`; each surface builds its own singleton in its `stores.ts` by importing the factory
directly (`stores.ts` does not re-export `createOverlay`/`OverlayEntry`/`OverlayState`). Push and sheet
are non-intersecting id namespaces, so the factory takes two type parameters, and those parameters are
each surface's registry rather than bare id unions (`docs/adr/0022`): the `PUSH`/`SHEETS` id → component
maps live in `src/lib/mobile/overlay-registry.ts` and `src/lib/mobile-admin/overlay-registry.ts`
(`satisfies OverlayRegistry`), and `overlay = createOverlay<MobilePushRegistry, MobileSheetRegistry>()`
derives the legal ids from the registry keys and each id's props from the registered component's props
minus the host-injected `onBack`/`onClose`. A `push()`/`sheet()` call with an unknown id, a wrong or
missing required prop, or a host-injected prop is a compile error, pinned by `@ts-expect-error` lines in
`components/mobile/overlay.test.ts`. `stores.ts` pulls the registry in with a statement-level
`import type` only, so the overlay components never enter the stores' runtime import chain.

`src/lib/icon-registry.ts` (K6) is the single source of every icon name used anywhere in the codebase. It
sits at lib-root rather than under `lib/components/`, deliberately: `lib/components/` (including
`Icon.svelte`) already imports lib-root values downward, and this way `lib/domain`/each surface's
`data.ts` only need a type-only import of `IconName` — erased at transpile time, so no
`domain → components` runtime edge opens. `Icon.svelte`'s `name` prop and every data-layer `icon` field
are typed `IconName = keyof typeof ICONS`, so an unregistered icon name is a `npm run check` failure
everywhere it's used, not just where `<Icon>` renders it. Together with the overlay registries above, this
means `src/lib/mobile/foundation-contracts.test.ts` needs no icon-registry-completeness or
overlay-map-completeness source scans — `check` catches a strict superset. The file's contracts are
route inventory (a deleted route only 404s at navigation time) and CSS safety (two regression regexes
`check` can't reach). See `docs/adr/0012` for the full K6 rationale, including a type-assertion lesson
from the same batch.

`src/lib/testing/` holds first-class test-support modules: `import-scan.ts` — `walk`, the
comment/string/template-aware import-specifier extraction (`importSpecifiers`), and the reach predicate
(`makeReachPredicate`) — whose self-proving fixtures live in `import-scan.test.ts` (foundation-contracts
uses its `walk`); `fake-router.ts` (`fakeRouter(overrides, defaults?)`, a fetch-path lookup stub with
fn-eval support); `auth-mock.ts` (`makeAuthMockA`/`makeAuthMockB`, canonical
`vi.mock('$lib/stores/authStore')` factories, both passing through the real `sessionIdentity`);
`session-reset.ts` (`resetSessionStores()` — a real `authStore.login` then `logout`, so every session
gate resets through its production path; there are no per-store `reset…ForTests` exports except
`resetOpsForTests`, the identity-free ops gate's); `wire-fixtures.ts` (builders such as
`orderSummary(over?)`/`adminLeaveRequest(over?)`/`pointsMe(over?)` that return a full generated wire type
with defaults and take `Partial<T>` overrides, so a new backend field is one default to add); and fixtures
such as `coach-routes.ts` and `seed-fixtures.ts`. A dogfood contract inside `import-scan.test.ts` pins that no production file under
`src/lib`/`src/routes` imports `$lib/testing`; its production-file scan excludes `src/lib/testing/`
itself (it's the module being scanned *for*, not a production consumer).

## Auth / cart / checkout — the domain core (read `docs/adr/0001` first)

Where the pieces live (the *rules* for changing them are in the `coding-standards` skill):

- **auth-at-checkout**: guests browse and fill the cart freely; login is required **only** at 結帳
  (checkout). Session lives in `lib/stores/authStore.ts`, backed by the real `/auth/*` API: access token
  in memory only, refresh token in `localStorage` under `dreamfly_refresh` (`lib/api/tokens.ts`), rotated
  single-flight on 401 (see `docs/adr/0006`). The `dreamfly_auth` `localStorage` key is only a
  first-paint cache of the member profile (so the UI doesn't flash "logged out" before `hydrate()`
  resolves) — the actual truth is whether the refresh token is still valid against the server. Login state
  follows that truth across tabs and on expiry (`docs/adr/0006` R17 addendum, `docs/adr/0027` §1): the
  refresh single-flight clears tokens only on an explicit backend rejection (400/401/403 — never a 408,
  429 or 5xx) and only if the stored
  refresh token is still the one it sent (compare-and-clear), then fires `client.ts`'s
  `onSessionExpired` signal, which `authStore` turns into `LOGGED_OUT`; `authStore` also listens for
  `storage` events and decides from the *current* storage only (no refresh token → log out; cached
  identity is a different logged-in member → drop this tab's access token and re-hydrate, logging out
  if the tab still isn't that member afterwards; plain
  rotation → do nothing, otherwise tabs would trigger each other's refresh forever).
  `authStore.syncUser(user)` lets a module that has just read or `PATCH`ed `/users/me` for the logged-in
  user push the fresh name into `member` (and so into that cache) without a re-login; it's a no-op for any
  other user id and leaves the identity key alone, so no session gate resets.
- **Self account** (本人帳號資料; 會員資料 is its member-side view): the logged-in user's own
  name/phone/birthday (plus read-only email, join month and last login) and four notification preferences
  live in one module, `src/lib/self-account.ts` (`docs/adr/0023`, `docs/adr/0026`), imported directly by
  `member`, `mobile` and `coach`; coach's private coach gate caches only the `CoachResponse` row and reads the
  person from `$selfAccount`, so a rename shows up on every surface at once. It sits on a
  `createSessionGate` (one `GET /users/me` per identity, reset on account switch) and serializes every
  `PATCH /users/me` through one write chain that hydrates first. It owns the `prefs` store: `setPref` is
  optimistic per key, with a whole-object resync when a save fails and a single-key rollback when the
  resync fails too (`saved`/`resynced`/`rolledBack`); `saveSelfAccount` sends only changed fields (no
  request at all when nothing changed). Fields the backend has no column for (member number, parent
  contact, avatar colour) have no input.
- **One persistent cart** spanning guest → login → checkout: the factory and the singleton both live at
  lib-root in `src/lib/cart.ts` (`docs/adr/0019`) — the single app-wide `cart = createCart(true)`
  (persisted to `dreamfly_cart_v3` — string uuid item ids deduped by `(type, id)`; no migration runs
  against the old `dreamfly_cart_v2` key, see `docs/adr/0006`) plus the `cartCount` badge derived.
  `lib/member/stores.ts` re-exports `createCart`/`cart`/`cartCount` as a pass-through of `$lib/cart` (see
  above); the public chrome (`components/Header.svelte`, `components/CartDropdown.svelte`,
  `routes/cart/+page.svelte`) imports `$lib/cart` directly. There must be exactly one `createCart(true)`
  call — a second persisting singleton would double-write `localStorage`. The `createCart(persist=false)`
  factory exists so tests get an isolated, non-persisting cart — and so does `mobile`, which builds its
  own non-persisting instance behind a deliberately narrow seam in `mobile/stores.ts` exposing exactly
  four members (`subscribe`/`add`/`remove`/`clear`), with the mobile-only `icon` override expressed as its
  own `addItem` input rather than as a factory option: **a shared factory is not a shared store instance**.
- **Routing contract is single-sourced** in `lib/checkout-gate.ts`: `checkoutTarget()`, `wantsCheckout()`,
  and `safeRedirect()` (open-redirect guard — only same-origin root-relative `?redirect=` targets allowed).
- **Course vs Pass**: checkout syncs the cart and `POST /orders`s it through the checkout
  controller that `member/checkout-sync.ts`'s `createCheckout` builds for each surface (its private `placeOrder`
  calls `checkout-order.ts`'s `syncCartToServer` then `POST /orders`; see `docs/adr/0003`'s FE-5 addendum; see also the
  controller section below). The lines it submits are `chargeableLines(cart, subscriptions)`
  (`member/checkout.ts`) — the branded `ChargeableLine[]` filter that skips passes the member already
  holds (the `/cart` page and `CartDropdown` total through the same filter and mark held lines 「已持有，不計費」), a no-op for mobile's course-only carts; mobile's cart is typed as the shared `CartItem`
  (`$lib/cart-item`). The backend creates both artifacts atomically in one transaction. A
  `type: 'course'` line becomes a real 報名 (enrolment row); the member's weekly schedule is real too,
  hydrated from `GET /schedule/me` (`member/api.ts`'s `getSchedule()`, derived from the member's active
  enrolments, see `docs/adr/0006`); a `type: 'pass'` line becomes a real 訂閱 (entitlement), re-hydrated
  from `GET /subscriptions/me` after checkout — subscriptions are not persisted in `localStorage`. Per
  ADR 0001 the two remain independent products.
- **Waitlist guard:** a full course (`spots: 0`) is blocked from the paid cart and routed to 候補
  (waitlist) — see the `AddResult = 'added' | 'bumped' | 'waitlisted'` add path in `lib/cart.ts`
  (re-exported through member stores). Mobile's cart returns the same `AddResult`; on `'waitlisted'` its
  three call sites (`routes/mobile/+page.svelte`, `routes/mobile/courses/+page.svelte`,
  `CourseDetailSheet`) `await joinWaitlist()` from `$lib/member/waitlist` against the real `/waitlist`
  endpoint, so a mobile 候補 is the same server row the desktop member/mine card shows.
- **Staff role switch:** `lib/staff/roles.ts` maps admin↔coach and remembers the last role in
  `df_staff_last_role` — a local UI convenience, independent of the real role check at staff login.
- **Google OAuth callback is one shared component:** `lib/components/GoogleCallbackCard.svelte` takes
  `successPath`/`loginPath` props; `member`'s and `mobile`'s `/login/google` routes are both ten-line
  shells over it. `staff`/`mobile-admin` have no Google option (`docs/adr/0006`).

Known, deferred caveat (ADR 0001): persisted stores read `localStorage` at module-init, which can cause a
hydration flicker on a hard reload of a logged-in SSR page. Intentional follow-up, not a regression.

## API 接縫 (seam): every app surface but `staff` has an `api.ts`

Every app surface except `staff` — `public`, `admin`, `coach`, `member`, `mobile`, `mobile-admin` — has
`src/lib/<surface>/api.ts`: async getters over the real `dream_fly_backend` API (seam design:
`docs/superpowers/specs/2026-06-21-mock-api-seam-design.md`). `public`, `admin`, `coach`, and `member`'s
getters mostly call `api<T>()` (`lib/api/client.ts`); the handful of P2-commented gaps that have no
backend equivalent (or are purely cosmetic) return the mock/hardcoded value directly inside the same
`async` getter — full inventory in `docs/adr/0006`. `mobile` and `mobile-admin` both hold an `api.ts` that
re-delegates to the real getters built for their desktop counterpart (`mobile` → `$lib/member/api.ts`;
`mobile-admin` → `$lib/admin` + `$lib/coach`), adding light field-mapping only where the mobile shape
diverges, with their own small residual mock spots (same ADR 0006 inventory) inlined the same direct way.

`mobile-admin/api.ts` keeps exactly five combinators — `getMore`/`getCoachHome`/`getAdminHome`/
`getOpsCollections`/`getMessages` — the ones that fan out to more than one source or reshape a response;
mobile-admin production code imports everything else from the owning module (`$lib/admin/api`,
`$lib/admin/data`, `$lib/admin/components/coach-save`, `$lib/admin/settings-form`, `$lib/coach/api`,
`$lib/coach/load-error-copy`, `$lib/coach/data`) directly, aliasing at the import site on a name clash
(`docs/adr/0019` C4's judgement extended from `data.ts` facades to this combinator layer,
`docs/adr/0025`). `mobile/stores.ts` has exactly six exports — `overlay`, `MobilePushId`/`MobileSheetId`,
`cart`, `checkout`, `toasts` — and mobile production code imports `$lib/member/<concern>` modules
directly rather than through the `member/stores` barrel. There is no import-direction contract on
mobile → member imports (`docs/adr/0014` §1, `docs/adr/0025`).

Backend wire shapes shared across ≥2 surfaces — order-status badges (`orderStatusBadge`, with a fallback
for unknown statuses), the admin/coach `TodaySessionResponse` (generated, re-exported),
the `OrderStatus`/`LeaveStatus` unions (generated, re-exported; leave and order DTOs are imported straight from
`$lib/api/generated`), display atoms like `ageRange`/`initialOf` — live in the
single source `src/lib/api/wire.ts` rather than each `api.ts` redeclaring its own copy
(`docs/adr/0007`). Response shapes themselves have one source:
`src/lib/api/generated/`, a byte-exact mirror of the backend's ts-rs `bindings/` kept in sync by
`scripts/wire.mjs` (`npm run wire:sync`; `npm run check` runs `wire:check` first). Hand-written code
only `import type`s from it, directly or via `wire.ts` (no single-entry rule); request bodies and UI view
types stay hand-written, and the only `Api*` types left are `Pick<…>` projections (`ApiUser`, `ApiMe`,
`ApiUserAccount`) and the settings-shape assertions (`ApiStudioProfile` etc.) (`docs/adr/0007`
addendum, `docs/adr/0027` §7). Wire also owns two pieces of order knowledge as zero-import pure helpers:
`orderIdentity`, the dual-identity protocol picking the display `order_number` vs the real uuid for
`PATCH /orders/{id}/status` (used by admin's `mapAdminOrder` and member's `mapOrder`), and `taxFromGross`,
the 5% tax-inclusive display derivation `round(amount - amount/1.05)` whose unit follows the caller (used
by admin's `mapAdminOrder`). mobile-admin takes its order row type from `$lib/admin/data`
(`Order as OrderRow`, aliased at the import site) and its badge from wire's `orderStatusBadge`.

Error-toast plumbing is single-sourced the same way: `src/lib/api/error-text.ts`'s `apiErrorMessage`
(pass-through) and `apiErrorText` (status-table, never leaks the backend message) — table-form call sites
keep their own 1-4-line entity text table, pass-through ones delegate outright (`docs/adr/0011`). The
coach pages' *load*-error copy — the gate `onError` title/body pairs — is single-sourced in
`src/lib/coach/load-error-copy.ts`, imported directly by eight coach pages (five desktop, three
mobile-admin). It recognises `CoachNotFoundError` with `instanceof`, so a whole-module mock of
`$lib/coach/api` would break it: the eight `routes/coach/**/page.test.ts` files test through the HTTP
seam — `vi.mock('$lib/api/client')` + `fakeRouter` with `src/lib/testing/coach-routes.ts`'s
`COACH_ROUTES` — and an `import-scan.test.ts` contract pins zero whole-module `vi.mock('$lib/coach/api')`
(`docs/adr/0014` addenda, `docs/adr/0026`). The ten `routes/admin/**/page.test.ts` files do the same with
`src/lib/testing/admin-routes.ts`'s `ADMIN_ROUTES` (`{ ...OPS_ROUTES, … }`, plus the `apiCalls`/`apiBody`
inspection helpers), and a sibling contract pins zero mocks of `$lib/admin/api` or `$lib/mobile-admin/api` in any
form — whole-module, `importOriginal` partial, `vi.doMock`, or a relative path resolving to either (`mobile-admin/stores.test.ts`
uses the same HTTP seam; `docs/adr/0026` W-8 addendum, `docs/adr/0027` §10). Per-entity *action* error tables stay at call sites —
`docs/adr/0014` draws that boundary. mobile-admin's coach attendance page's `ATTENDANCE_ERROR_TEXT` is
one: it maps 403/404/422 to the same wording desktop's inline attendance-error table uses, so a save
failure shows the specific reason (`docs/adr/0011` addendum).

Pages call `gate.load()` on a `createLoadGate`/`createPagedLoadGate` gate from the single source
`src/lib/load-gate.ts` (`docs/adr/0008`) and read `$gate` for `'loading' | 'error' | 'ready'`, rendering
`Skeleton`/`SkelCard` while loading and `ErrorState` on failure. That branching is usually collapsed into
a presentation wrapper, `src/lib/components/ui/LoadGate.svelte` (`slot="loading"` / `slot="error"` with
`let:retry`, default slot for ready; retry always calls `gate.refresh()`, never `load()`), consumed at 55
call sites: one per route page across 45 route pages, plus 10 mobile/mobile-admin overlay screens (among
them `VenuesScreen`/`TicketsScreen`/`CoachesScreen`, and mobile's `MyCourseDetail` with its own in-card
attendance gate, which overrides `slot="error"` with a bare `ErrorState` because it already sits inside
a `Card`). The member 我的課程 page's in-card attendance-history load is not a second gate — it lives in
`member/mine-controller.ts` (`docs/adr/0008`). `ScheduleCalendar` keeps its bespoke inline template
outside the wrapper.

Data that already lives in a store (member/mobile's notification centre; mobile-admin's ops collections
and messages) hydrates once behind the gate's hydrated guard (`notifications` — shared by member and
mobile — the ops collections, `messages`; stores no longer export `*Hydrated`), with `gate.refresh()` always re-fetching for `ErrorState`'s
retry regardless of the guard — but the guard's mechanism and ownership differ by surface. The wiring is
the same for all of them (`docs/adr/0025` F-1): `load-gate.ts` exposes a `LoadSource` port
(`guarded()`/`load(isCurrent)`/`refresh(isCurrent)`), `LoadGateOptions<T>` is a discriminated union of
`{ fetch, onData?, onError? }` (plain pages) or `{ source, onError? }` (pages reading a shared store), and
a hydration gate's `pageEntry()` returns `{ source }` — a page writes
`createLoadGate({ ...gate.pageEntry() })`. load-gate owns only phase, its own run-generation, unmount,
and `onError`; every fetch/apply/flag decision (guard short-circuit, post-await mutation-wins re-check,
the flag-flip, the fourth and fifth decision points below) lives inside `hydration-gate.ts`'s internal
`loadRun`/`refreshRun`, reached only through the source's `load`/`refresh` closures. `isCurrent` is the
one thing load-gate hands the source: "unmounted or superseded by a newer run" — the source can only
read it, never touch phase or generation itself. `fetchGenStable` is a module-private function inside
`hydration-gate.ts`, called only by its own `refreshRun` (`docs/adr/0016`, `docs/adr/0025`). The
mutation-wins re-check compares `entered !== mutationGen || get(flag)` (both the entry-time generation
*and* the flag), so "load in flight → `write()` → `invalidate()` → response lands" doesn't apply the
stale snapshot.

The refresh family is covered by a *fourth* decision point (`docs/adr/0020`): `fetchGenStable` —
capture the gate's monotonic mutation generation on entry, re-read it when the response lands, and if a
local mutation happened inside that window discard the snapshot and refetch in place until it is stable.
It is deliberately never applied to `load()`/`source.load()` (hydrate's contract is
mutation-wins-discard, with the reconcile chain owing the refetch; refresh's is explicit freshness, so a
discard *must* be followed by one) — this asymmetry lives entirely inside `refreshRun`; no generation
reader is exposed for a page to reach for, on purpose. A *fifth* decision point (`docs/adr/0021`) is the
**mutation settle signal**, an axis orthogonal to the generation one. Optimistic mutators are
mark-before-await (write the store *first*, `await` the PATCH after), so "the PATCH is
in flight" is invisible to a generation check: a GET leaving inside that window reaches the server
before the write does, gets the old truth back, finds the generation stable, and applies it. So an
optimistic `write({ optimistic, send, … })` books `send()`'s promise as the mutation's network tail with
`tail.then(done, done)` (a rejection settles too — structurally, rather than trusting call sites to
`catch`; the tail *is* `send()`, so the old "caller must pass a pure network tail" obligation is now a
type-level shape, `commit`/recovery run outside it), an internal
`pendingSettle()` reports whether any tail is outstanding, and `fetchGenStable` waits on it in a
re-asking loop *before* capturing the generation and firing. **Wait by tails, discard by generations,
never swap the two** — the honest boundaries (a hung tail makes refresh wait with it; a continuous
mutation stream starves refresh until the user stops) are in the ADR. When idle, `pendingSettle()`
returns `undefined` **synchronously** — a hard contract, since one extra microtask would push the
generation capture past a caller's "refresh then synchronously optimistic `write()`"; in port terms,
`source.refresh(isCurrent)` dispatches its fetch synchronously whenever there is no pending tail
(`docs/adr/0021` addendum). The enrolled call sites are `member/notifications.ts`'s
`markRead`/`markAllRead` (optimistic `write({ optimistic, send, onFailure: 'keep' })`) and the self
account's `setPref` (optimistic PATCH, `onFailure: 'resync'`), which book their tails through `write()`;
`markRead`/`markAllRead` are mobile's mutators too; the pages keep only the toast. The gate's own `generation`/`destroyed` bookkeeping (no page-local
flag needed) discards a response that resolves after the page unmounts.

Mobile-admin's ops collections and messages are store-owned: the fetch/apply/guard lifecycle lives in
`stores.ts`'s `opsGate`/`messagesGate`, because a mutator (`markMessageRead`) flips
the guard true (a mutation *is* the session's source of truth) and none of them is "the page". The pages
spread the gate's own entry pack — `createLoadGate({ ...opsPageEntry })`/
`createLoadGate({ ...messagesPageEntry })` — so the store write goes through the source's `load` closure
and a response landing after unmount or after a newer run is dropped; the hydrated guard is rechecked
right before the write, so a mutation racing an in-flight fetch always wins. The four ops collections
(`members`/`classes`/`orders`/`coaches`) boot honestly (`docs/adr/0025` F-3): a private `EMPTY_OPS`
constant (four empty arrays, `pages` all `{ total: 0, perPage: 0 }`) is both the stores' boot value and
what `opsGate`'s `reset: () => applyOps(EMPTY_OPS)` restores on identity reset — the admin home page's
pending-payment banner and `CoachesScreen`'s subtitle read `0`/nothing before the gate is ready. The
member/course/coach writes don't go through `write()` at all: the store's per-entity, add/edit-split
write verbs (`docs/adr/0022`) — `addMember`/`saveMember`, `addCourse`/`saveCourse` (taking a
`ValidCourse` from `course-request.ts`'s `checkCourseDraft` and building the body with
`buildCreateCourseBody`/`buildUpdateCourseBody`) and `addCoach`/`saveCoach` (wrapping `coach-save.ts`,
returning its outcome untouched) — call the real `/users`/`/courses`/`/coaches` API followed by an
unconditional `refreshOps()` refetch. Each verb throws on a failed write (coach verbs return the failing
outcome) and otherwise awaits the refetch before resolving, so a caller's success toast lands together
with the updated list; a failed refetch after a successful write is only `console.error`ed. There's
deliberately no generic CRUD helper and no `isNew` flag (`docs/adr/0018` C6, `docs/adr/0012`).
"Unconditional" describes the refetch *call*, nothing guards it; what it *applies* is generation-stable,
see `docs/adr/0020`. Mobile-admin orders are read-only: 「標記已付款」(`markOrderPaid`) was removed in W-6
fix 1 because the backend rejects pending→paid since BE-3, so no ops mutator goes through `opsGate.write()`
any more (desktop's `LEGAL_NEXT` offers pending → cancelled only). The same gate also
publishes `opsPages` (backend `total`/`perPage` for the page-1-only members/classes/orders lists), which
the three pages show as header totals plus a `searchCapHint()` line once `total > perPage`.

That store-owned guard + post-await re-check protocol is a shared factory, `src/lib/hydration-gate.ts`'s
`createHydrationGate` (public surface: `hydrated: Readable<boolean>`, `hydrate`/`refresh`/`invalidate`/
`write()`/`pageEntry()`/`reset()` — the mutation-generation and settle readers never leave
the gate, not even through `pageEntry()`). `mobile-admin/stores.ts`'s ops gate builds on it directly;
every identity-scoped store builds on it through `src/lib/session-gate.ts` (`docs/adr/0017`, see the
dedicated section below) — member's waitlist, leave-requests and notifications, mobile-admin's messages,
the self account and coach identity. `hydrateWaitlist`/`hydrateLeaveRequests`/`hydrateNotifications`
*are* `gate.hydrate`, and their
mutators run through one `gate.write()`. There is no `refreshWaitlist` (YAGNI); `refreshLeaveRequests`
is `gate.refresh`, used by `MyCourseDetail`'s open-refresh — accepting once-per-session freshness, with
in-flight cross-login responses discarded and the explicit-refresh window closed by the
generation-stable refetch loop, so a cancel landing inside that window discards the stale snapshot and
refetches instead of reverting the row to pending (`docs/adr/0016`, `docs/adr/0020` — which records
extending mutation-wins into refresh as an explicit rejection).

Separately, each surface's layout declares a **warm set** — the shared stores its shell reads before any
page does — and calls `src/lib/store-warm.ts`'s `warmStores(caller, tasks)` keyed on identity
(`docs/adr/0024`): member and mobile warm notifications (Topbar/Sidebar/TabBar badges), mobile-admin warms
messages in the coach section only (keyed on the route section, not the account's roles). Individual
*pages* declare their own warm set the same way, run in `Promise.all` alongside their own main fetch
(`docs/adr/0025` F-2): `member/mine` (`getMine()` + 候補 waitlist/請假), `member/account` (`getAccount()` +
points/subscriptions), and `mobile/account` (`getAccount()` + points) each call `warmStores(caller, tasks)`
with a caller label that also prefixes the console warm-up log (`'member/mine'`/`'member/account'`/
`'mobile/account'`). `warmStores` is `Promise.allSettled`, best-effort (a failed hydrate only
`console.error`s, never throws) — deliberately unlike `getPoints()`'s own fail-hard points refresh, which
is page-critical rather than incidental. One GET per identity: the gate's guard stops revisits, the
in-flight coalescing merges the warm call with a page's own load on the same screen, and an identity
change resets the gate. Getters don't warm stores as a side effect (`docs/adr/0012` K7): `getDashboard()`
reads neither points nor notifications, `getMine()` fetches `activeEnrolments()` only, and `getAccount()`
fetches `GET /orders/me` only — `mobile/account` doesn't request `GET /subscriptions/me` at all.
`getPoints()` is called directly by whichever page reads `$points`. The account pages' own fetch awaits
the self account's `hydrateSelfAccount()` in parallel with `getAccount()` and the warm set — fail-hard,
not in the best-effort helper, because the page renders from `$selfAccount`.

Layout shells stay outside the seam — a deliberate boundary, not an oversight: `admin`'s `Sidebar.svelte`
/ `Topbar.svelte` have no `data.ts` or `api.ts` import at all (nav config from `admin/nav.ts`), while
`coach`'s Topbar imports `NOTIFS` from `data.ts` for its unread-bell dropdown — synchronously, never
through `api.ts` or the load gate (coach's workflow notifications have no backend feed, a standing P2).
The identity slot is a separate axis: both shells read it off `$authStore.member` — avatar initial,
display name, and profile popover on `admin`'s and `coach`'s `Sidebar.svelte`; on `coach`'s
`Topbar.svelte` just the avatar-initial disc (its only popover is the notification bell, not an identity
surface) — a synchronous store read, not an `api.ts`/load-gate seam (`docs/adr/0013`). `staff` is
excluded because it's pre-auth login/role-switch UI with no `data.ts` to seam. `public`'s seam is
`src/lib/public/api.ts` + `adapters.ts` — the one place that converts the backend's `*_cents`/enum/id
shapes into the marketing types, including cents→NT$ conversion via the shared `ntd()` helper (single
*definition* here, not its only caller, see `docs/adr/0006`) — over the real `/courses`, `/coaches`,
`/venues`, `/schedule`, `/posts`, `/contact` endpoints. `src/lib/public/calendar-grid.ts` is the same
shape applied to `ScheduleCalendar`'s date-grid math — Sunday-leading grid/date pure functions, with the
component a thin adapter over them; deliberately incompatible with, and never merged into, coach's own
Monday-leading `schedule-dates.ts`. Its sibling `calendar-selection.ts` does the same for the component's
*selection* transitions — month paging and date/time-slot picking as pure
`CalendarSelection → CalendarSelection` functions, with `gate.refresh()` staying a component-side effect
at the `loadMonth` call site; the bespoke inline three-state template is ADR 0008's standing exemption.

## Load gate vs. hydration gate: which one owns a shared store's fetch?

Two shapes exist for a page whose data already lives in a cross-route store (`docs/adr/0008`). Picking
between them only depends on one question — can the store's hydration be triggered from more than one
place, independent of any single page's own load-gate?

- **member notifications — several entry points, one shared flag**: the member notifications *page*
  and mobile's notifications page each drive their own load-gate, and the member and mobile layouts' warm
  sets also hydrate the same store (`warmStores`, see above) — independent triggers that must agree on one
  guard. The store (`member/notifications.ts`) therefore owns a full `createHydrationGate` instance
  (wrapped by `createSessionGate`, see the next section), and both pages'
  `createLoadGate({ ...notificationsPageEntry })` read that *same* `gate.hydrated` (`Readable<boolean>`,
  not writable outside the gate) rather than declaring their own. Mobile's page imports
  `$lib/member/notifications` directly — there is one gate and one `mapNotification` over the same
  server-side read state, so a read on one surface shows on the other in the same session
  (`docs/adr/0022`).
- **mobile-admin ops/messages — store-owned, multiple mutators**: `opsGate`/`messagesGate` live in
  `stores.ts`, not the page; the pages build their load-gate from the gate's entry pack
  (`opsPageEntry`/`messagesPageEntry`), the same wiring the notifications pages use. The messages gate is
  a `createSessionGate`, so a second coach logging in doesn't see the first one's conversation list; the
  ops gate is a plain `createHydrationGate` because ops is organisation-wide data. A mutator
  (`markMessageRead`) can flip the guard, and it is not "the page", so the
  fetch/apply/guard lifecycle has to live where the mutators do: the full `createHydrationGate` factory,
  store-owned. The store-level `refreshOps()` gets the generation-stable refetch for free — the
  store-owned gate holds the mutation generation itself; "`await write()` → `await refreshOps()`"
  is a single fetch whose snapshot applies (`docs/adr/0020`'s conservation pin), and the pages' retry
  reaches the same ledger only indirectly, through `source.refresh(isCurrent)`. The mutator enrols no
  settle tail in the fifth decision point, and doesn't need to: it is a non-optimistic `write()`, so
  the store is touched (`commit`) and the generation bumped only after `send` has settled.
  `markMessageRead(id, ack)` takes the controller's
  `badgeCleared` promise as the write's `send` — mobile-admin's `MessageThread` calls it immediately
  and the gate waits for the ack; only `true` flips the local row (a failed `markRead` leaves the
  thread unread), and an identity change before the ack lands makes the write `stale` so the new
  identity's store is untouched (`docs/adr/0021`, `docs/adr/0024`, `docs/adr/0027` §5). The overlay screens on this store render their own three states: `CoachesScreen`
  uses a real load-gate + `<LoadGate>` (`createLoadGate({ ...opsPageEntry })`, ready synchronously when
  the guard hits), so its coach cards never render stale rows during the hydrate window
  (`docs/adr/0016`).

Rule of thumb: reach for a store-owned `createHydrationGate` (or `createSessionGate`, for identity-scoped
data) when a store's hydration can be triggered from more than one place (another getter, another
mutator, another page); a page with no shared store uses the plain `createLoadGate({ fetch, onData })`
form.

Why `pageEntry()` hands pages a `{ source: LoadSource }` rather than the store-owned `{ fetch, refresh }`
pair (`docs/adr/0023`, `docs/adr/0016` addendum, `docs/adr/0024`, `docs/adr/0025`): with the raw pair,
the store gate would write the shared store without knowing the page exists, losing protections that
only the load-gate wiring gives — stop re-fetching once the page unmounts, never write a superseded run's
snapshot, and the re-entry re-checks (the load-gate's own "F1/F5"). All five store-owned callers (the
four `hydrateOps` pages/screens and the messages page) spread `pageEntry()` like the notifications pages
do. `source.load`'s in-flight GET is shared with `hydrate()`, `source.refresh` is a separate, uncoalesced
call, and the re-entry bookkeeping stays in load-gate.

## Session gate: session-identity-aware resets on top of the hydration gate

`createHydrationGate`/`createLoadGate`'s guard/mutation-wins protocol (above) knows nothing about
*who* is logged in — it only tracks whether a store has been hydrated at all. An SPA logout has no full
page reload, so without identity awareness the next account's first hydrate would be
guard-short-circuited into reading the previous account's data, and an in-flight refetch spanning the
switch would land unconditionally. `src/lib/session-gate.ts` (`docs/adr/0017`) is the single source for
that awareness. It has **two** factories, both sitting between `authStore` and the domain stores:

- **`createSessionGate<T>({ fetch, apply, reset })`** — waitlist / leave / notifications (one gate shared
  by member and mobile), the self account (`self-account.ts`, shared by member, mobile and coach), the
  coach identity (private to `coach/api.ts`: just `CoachResponse | null`, resolved once per session from
  `hydrateSelfAccount()` + `GET /coaches`, the flag flipped back on `CoachNotFoundError` so a retry
  re-resolves) and mobile-admin's messages (`docs/adr/0023`). The coach and mobile-admin ones are
  staff-side consumers — staff logins write the same `authStore`. It builds a `HydrationGate`
  (`createHydrationGate({ fetch, apply, reset })`, whose `reset()` is layered with the write-chain reset
  below, `docs/adr/0025`). The one mutator skeleton is the *base* gate's `write()` (`docs/adr/0027` §5):
  it records the owner (reset epoch) and whether the gate was hydrated before `await`, discards a
  write that landed after a reset as `stale` (the outcome still carries how `send` ended — the
  server-side effect already happened), re-checks completeness on write-back (a prior reconcile may
  have flipped the flag back to `false`), bumps the generation, then conditionally queues a serialized,
  retryable reconciliation refetch (the reconcile chain lives in the base gate too). The session gate
  adds only `queueWrite(task, skipped)`, one serialized write chain per gate: a queued
  write whose identity changed before its turn is skipped, the task gets a `stale()` probe for its failure
  handling, and an identity change resets the chain — the self account's `setPref`/`saveSelfAccount` run
  on it. Its **`pageEntry()`** (inherited from the hydration gate) is the pack a page spreads into its own
  load-gate: `{ source: LoadSource }`, where `source.load`/`source.refresh` are the *epoch-checking* fetch
  and refresh, and the mutation-generation ledger they compare against is the gate's own — the page's
  refresh and the store gate read **one** ledger, without exposing it as a separate reader. That closes
  the reconcile window: the gate's `queueReconcile` needs no second queued reconcile, because a reconcile refetch
  whose snapshot predates a later mutation is discarded and refetched by `gate.refresh`'s own generation
  check (`docs/adr/0020`). A failed reconcile flips the flag back through `gate.invalidate()`; `hydrate()`
  shares one in-flight GET among concurrent callers, so no consumer module carries its own `inflight`
  wrapper.
- **`createSessionRefresher<T>({ fetch, apply, reset })`** — points / subscriptions. Unconditional-refetch
  semantics (no guard), plus identity-change reset and *silent* in-flight cross-login discard (`return`,
  not `throw` — throwing would inject a new "switched accounts" failure mode into `redeemReward`'s and
  the checkout's existing rejection chains).

Both factories share one private identity core, keyed by `sessionIdentity(auth)` — an exported pure
function in `stores/authStore.ts` (the identity owner; `null` when logged out, else `member.id`, degrading to `''`) that the member/mobile/
mobile-admin layouts' warm keys and mobile-admin's `MessageThread` call too instead of hand-copying the
formula (`docs/adr/0026`). The core fixes its identity *baseline* at construction: the subscription's
immediate callback only records who is logged in, so a restored (or guest) boot fires no reset at all —
reset value equals boot value, so nothing on screen differs — and declaration order at call sites is not
a contract. On a real identity change `createSessionGate` calls its underlying `gate.reset()`
(`opts.reset()`, flag false, drop the in-flight coalesced GET, bump the reset epoch, clear the
settle-tail ledger and reconcile chain, and wake any waiters — the hydration gate's own general-purpose
`reset()`, `docs/adr/0025`) and resets its write chain.

Each factory call opens its own `authStore` subscription (eight module-level subscriptions total — six
`createSessionGate`s plus two `createSessionRefresher`s) rather than sharing a registry. Session-gate is
deliberately *not* folded into `hydration-gate.ts` itself: not every hydration gate is identity-scoped
(mobile-admin's organisation-wide ops gate isn't), and `load-gate.ts` — used by ~55 route pages and
overlay screens across every surface but `staff` — must not take on auth awareness either;
that would be a wrong-direction dependency on the repo's widest shared seam.

Epoch knowledge lives only in `session-gate.ts`; `load-gate.ts` knows nothing about it, and the entry
pack's only dependency on it is a type-only `import type { LoadSource }` (`docs/adr/0025`). Because both
notifications pages spread `notificationsPageEntry` rather than calling a raw API getter, they can't
escape the epoch check. There is no separate code path for a stale response: it makes `epochFetch` throw,
which lands in the load-gate's existing error state, and the user's retry re-enters the *same*
`epochFetch` under the new epoch. See `docs/adr/0019` for the full walkthrough and `docs/adr/0017` for why
the guard-short-circuit and navigate-away cases are safe.

## Admin write rules: one module per entity (course, member, coach, order status)

The "form values → validation → request body" step for each admin entity lives in one pure module shared
by the desktop dialog and the mobile-admin form (`docs/adr/0023`):

- **`src/lib/admin/components/course-request.ts`** — `courseDraftOf(row)` → `CourseDraft` (writable
  fields only, numeric fields as text buffers), `checkCourseDraft(draft, coaches)` →
  `valid{course: ValidCourse} | invalid{errors}`, then `buildCreateCourseBody`/`buildUpdateCourseBody`.
  Both builders put every field in the body and send `null` for a cleared one — an edit always sends
  both age bounds, because the backend merges a missing bound with the stored one. `coach_id` is never
  `null` (`GET /coaches` lists active coaches only, so `null` would silently unbind).
- **`src/lib/admin/components/member-request.ts`** — `checkNewMember`/`checkMemberEdit` → `valid{body} |
  invalid{errors}`.
- **`src/lib/admin/components/coach-save.ts`** — `checkNewCoach`/`checkCoachEdit` beside
  `saveNewCoach`/`saveCoachEdit`.
- **`src/lib/admin/components/order-status.ts`** — the legal-transition table (`legalNextStatuses`,
  `applyStatusChange`), the revenue rule (`isRevenueStatus`/`revenueTotal`, the backend's `is_revenue`:
  paid/processing/completed) and `changeOrderStatus(id, next, deps)`, which maps a 400 to
  `illegalTransition` and a 409 (points clawback shortfall) to `pointsShortfall`.

The rules follow the backend DTOs: fields the backend has go in, fields it derives (a course's
enrolment status) are read-only, fields it lacks (venue/term/session count) have no input. Validation
copy is exported from each module; toast and API-error copy stays on the page (`docs/adr/0012` ④,
`docs/adr/0011`). Each entity keeps its own types and private helpers, add and edit are separate
functions, and there's no cross-entity CRUD helper (`docs/adr/0018` C6, `docs/adr/0022`).

## Single-page controllers, orchestrators, and twin modules (coach, admin, member)

Some pages have a same-page-only state-orchestration layer thick enough to be worth extracting into a
sibling `.ts` (per the Testing convention below) but not general enough to become a shared
`lib/<surface>/` module consumed by more than one caller — see `docs/adr/0012` for the four-part test
(K1/K3/K4), and its contrast with the cross-page "list-page controller factory" that `docs/adr/0011`
rejected.

- **`src/lib/coach/attendance-controller.ts`**'s `createAttendanceController` (K1) sits in front of
  `coach/attendance/+page.svelte` (and mobile-admin's coach attendance page — see the twin class below):
  a single `AttendanceViewState` snapshot store instead of mirrored page variables, with
  `saveAttendance` and an optional `now` (defaulting to the exported `nowHHMM`) injected as deps (no
  Svelte component/lifecycle imports — `svelte/store` only — and construction is side-effect-free,
  SSR-safe). It owns the draft transitions as non-exported internals tested through the controller's
  interface. `save()` layers an incrementing save-token guard on top of the state-based stale guard — not
  a replacement for it — closing an ABA hole where an in-flight save's late response could land on a
  class switched away from mid-save. Attendance notes are local-only (`docs/adr/0022` D1): the backend's
  `PUT /sessions/{id}/attendance` has no notes field, so `applyNote` only writes `notes` and doesn't mark
  the draft dirty, and both note editors say 「僅存本機，重新整理後會消失」.
- **`src/lib/coach/conversations-filter.ts`** (K3) is a framework-free port of
  `coach/messages/+page.svelte`'s tab × search filtering, selection-fallback, and compose-insert logic
  (`filterConversations`/`pickSelection`/`applyCreatedConversation`), consumed only by that page.
- **`src/lib/admin/components/coach-save.ts`**'s `saveNewCoach`/`saveCoachEdit` (K4) is a stateless async
  orchestrator for `admin/coaches/+page.svelte`'s two-step account-then-coach create sequence and its
  `pendingUserId` retry sentinel — sentinel *semantics* live in the module, sentinel *storage* stays on
  the page. Both functions return a `kind`-tagged outcome so the page — not the module — picks the error
  mapper (`docs/adr/0011`) and toast text. It also owns the coach form rules — `checkNewCoach`/
  `checkCoachEdit` (see "Admin write rules" above).
- **`src/lib/coach/clock-controller.ts`**'s `createClockController`: the coach home page's
  clock-in/out orchestration as a two-field snapshot store (`clockedIn`/`clocking`) with
  `clockIn`/`clockOut`/`isClockedIn` injected as deps. `ApiError` 409/404 reclassification
  (already-clocked-in / not-clocked-in) and the hydrate-vs-mutation ABA guard (`clockTouched`, mutation
  wins) live inside, returning `kind`-tagged outcomes so all six toast strings stay on the page
  (`docs/adr/0014` records the adjudication, over `docs/adr/0013`'s earlier note).
- **`src/lib/member/checkout-controller.ts`**'s `createCheckoutController`: the 結帳 payment lifecycle
  *and* its inputs as one snapshot store. The snapshot is `step`/`paying`/`paid` plus
  `coupon`/`codeErr`/`preview` (`checkoutMath(lines, coupon, points, usePoints)`)/`hasChargeable`, and
  `checkout.form` (`code`/`usePoints`/`paymentMethod`) is what the components `bind:` to, so a
  mid-payment reopen shows the order being sent rather than a reset form. The deps are
  `{ placeOrder, applyCouponCode, lines, points }` — two effects plus two read-only sources, which
  `docs/adr/0012` clarifies are data, not behaviour flags; `deps.placeOrder` is
  `(lines: ChargeableLine[], order: PlaceOrderInput) => Promise<PaidSummary>`, and `confirmPay()` (no
  arguments) reads `lines` once and passes it down. The idempotency-key lifecycle (fresh key per checkout
  open, same key across a failed retry — the double-charge safety machine), `setOpen` edge detection
  (`freshCheckout | resumedInFlight | noop`) and the paying guard live inside, returning `kind`-tagged
  outcomes (`orderPlaced`/`orderFailed`/`alreadyPaying`/`nothingChargeable`, original throwable passed
  through). `freshCheckout` resets form and coupon, `resumedInFlight` keeps them; `applyCode()` drops a
  response that lands after a `freshCheckout`; `removeCoupon()` backs desktop's 「移除」 link. Surfaces
  don't assemble the controller themselves: `member/checkout-sync.ts`'s
  `createCheckout({ cart, refreshAfterOrder, refreshOnOpen })` builds it, deriving `lines` from the given
  `cart` and running its private `placeOrder`, and its `setOpen` fires `refreshOnOpen` on the `freshCheckout`
  edge. Its two consumers, with no branch inside the machine, are member's `CheckoutDialog`
  (`[refreshSubscriptions, refreshPoints]` for both lists) and mobile's module-level singleton `checkout`
  in `mobile/stores.ts`, beside `cart` and with the same lifetime (`[refreshPoints]` only — its cart never
  carries pass lines). `CartSheet` calls `setOpen(true)` on mount and `setOpen(false)` on destroy and
  refuses to close while `paying`; a reopen after navigation lands on `resumedInFlight` — same key, still
  locked. The constructor-time-key guarantee is pinned by `checkout-controller.test.ts`. Toast copy and
  `CartSheet`'s `close()` guard stay on the components (`docs/adr/0016` supersedes `docs/adr/0008`'s
  "keep the double-charge guard in the dialog" note; see also `docs/adr/0014`, `docs/adr/0023`,
  `docs/adr/0024`, `docs/adr/0025`).
- **`src/lib/coach/messages-controller.ts`**'s `createMessagesController`: `coach/messages/+page.svelte`'s
  conversation-thread orchestration as a single `MessagesViewState` snapshot store, with
  `getThread`/`markRead`/`sendMessage`/`getStudents`/`createConversation` injected as deps.
  `selectThread` returns two independent promises rather than a single outcome — `threadReady` layers an
  incrementing-token stale-guard (the same shape as `attendance-controller`'s save-token guard) over the
  `getThread` fetch, while `badgeCleared` (`markRead`) is deliberately unguarded and never blocks on
  `threadReady`, so a stuck read-receipt call can't delay the thread-loaded/failed toast; `send`'s
  stale-response guard instead re-checks a captured `conversationId` snapshot; `confirmCompose`'s
  `creating` guard mirrors `checkout-controller`'s `alreadyPaying`. `composeOpen` lives in the
  controller's snapshot, so the page closes the compose dialog through `closeCompose()` — assigning the
  destructured mirror directly would be overwritten back to `true` by the controller's next `publish()`.
  Toast text, the conversations list and its gate, and the tab×search filtering (`conversations-filter.ts`,
  K3) stay on the page; `docs/adr/0018` records the criterion walkthrough. mobile-admin's `MessageThread`
  is a second caller (see the twin paragraph).
- **`src/lib/member/mine-controller.ts`**'s `createMineController`, in `messages-controller`'s shape:
  member/mine's *inner* coordination — course selection × the in-card attendance-history load × the
  waitlist-cancel busy guard — as one `MineViewState` snapshot (`active`/`attState`/`attendance`/
  `cancellingId`) with `getEnrolmentAttendance`/`cancelWaitlist` as its only deps. "Latest request wins"
  comes from the controller's own incrementing `seq`/`token` guard (`attendance-controller`'s shape
  again), and "write `active` before fetching" is structural rather than a comment —
  `fetchAttendance(id)` takes the id as a parameter and never reads the `active` closure. Toast copy and
  the outer `getMine` gate stay on the page (`docs/adr/0012`, `docs/adr/0008`).
- **`src/lib/public/contact-form.ts`**'s `createContactForm`, `public`'s form machine:
  `ContactForm.svelte`'s four sequential validation guards, submit and 3-second reset choreography, with
  `send` and `schedule: (fn, ms) => cancel` (a timer effect, the same injection habit as
  `attendance-controller`'s `now`) as deps and 洽詢-domain outcome kinds
  (`inquirySent`/`validationFailed`/`failed`/`alreadySubmitting`). It draws a boundary the ADR states
  outright: *validation* copy lives in the machine as exported consts (single string source for the
  module's own mapping and the component's inline error box — `login-submit.ts`'s `EMPTY_FIELDS_ERROR` is
  the precedent), while *toast* copy stays at the call site as criterion ④ requires. A leftover reset
  timer from an earlier successful submit can't cut the next success message short (`docs/adr/0012`).

The same deps-injected, outcome-tagged shape also has a sanctioned *twin* variant — modules whose callers
are desktop↔mobile twins with byte-identical orchestration rather than a single page. Gate wiring, error
mappers, and toast copy stay at each call site — `docs/adr/0012`'s criterion ① is relaxed for exactly
this class by `docs/adr/0014`. Its members:

- `member/leave-form.ts` (the 請假/補課 form machines behind `LeaveDialog`/`MakeupDialog` and mobile's
  `LeaveSheet`/`MakeupSheet`) and `member/cancel-leave.ts` (the shared cancel-leave busy guard behind
  member/mine and mobile's `MyCourseDetail`).
- `admin/settings-form.ts`'s `createSettingsForm` — the admin desktop settings page and mobile-admin's
  `AdminSettingsScreen` share one factory for their byte-identical 10-field draft-flattening/assembly
  orchestration, deliberately *not* split into a leave-form-style shared core plus two wrapper factories
  since there's only one outcome domain to serve (`docs/adr/0018`).
- `coach/attendance-controller.ts` — the mobile-admin coach attendance page is its second caller, with
  desktop semantics: an unsaved draft survives a class switch, switching mid-save is blocked with a toast,
  and a late save response is dropped as `stale`. The page imports `getAttendance`/`saveAttendance`
  from `$lib/coach/api` directly, with no mapping layer (`docs/adr/0014`).
- `member/checkout-controller.ts` — mobile's `CartSheet` is the factory's second caller (details in the
  controller bullet above); the two surfaces differ in *wiring* (who supplies the cart and refresh lists,
  who drives the lifecycle), not in the machine, which supersedes `docs/adr/0016`'s original "非 twin"
  note. The twins' coupon-apply step is single-sourced as `member/checkout.ts`'s `applyCouponCode` (trim
  guard + the real `GET /coupons/{code}/validate` + one shared 404/network copy), injected into the
  controller as a dep, so the components don't call it; there is no separate `validateCoupon` any more
  (`docs/adr/0027` §3).
- `coach/messages-controller.ts` — mobile-admin's `MessageThread` builds it with the same five deps,
  imported directly from `$lib/coach/api` (`docs/adr/0024` F5). The one wiring difference is the badge:
  `MessageThread` hands `badgeCleared` to the store's `markMessageRead(id, badgeCleared)`, whose
  `write()` flips the row only when it resolves true, so the unread badge clears after the backend
  acknowledged the read, as on desktop.
- `coach/student-forms.ts` — `createCertificateForm`/`createReportCardForm` (one file, two factories, no
  mode flag) hold the required-field guard, double-submit guard, trimming, optional-field omission and
  local-date default shared by desktop's `CertificateDialog`/`ReportCardDialog` and mobile-admin's
  `StudentActionSheet`; toast copy and the `lastOpen` reset timing stay in the components
  (`docs/adr/0026`).
- `coach/data.ts`'s `ATT_CHOICES` — the one attendance-status list (`present`/`leave`/`absent`; there is
  no 遲到, the backend only has those three) shared by desktop's `AttSegment` and stat chips and
  mobile-admin's attendance page; `tally()` is a zero-initialised `Record<AttDefault, number>`
  (`docs/adr/0026` R17 addendum).
- mobile-admin's `MemberForm`/`ClassForm`/`CoachForm` take `onCreate`/`onUpdate` (promise-returning, close
  only on success) instead of `onSave(body, isNew)`, validate on submit with the same `checkX` modules as
  desktop and show errors on the field; `CoachForm`'s `onCreate` also reports `'bind-failed'`, which
  keeps the sheet open and locks email/name/password for the retry (`docs/adr/0023` R17 addendum,
  `docs/adr/0027` §4).

`src/lib/login-submit.ts`'s `submitLogin(io: LoginSubmitIO)` pushes the pattern further still — an
IO-callback orchestrator, not a deps-injected snapshot store, shared by *four* surfaces' login pages
(`member`/`mobile`/`mobile-admin`/`staff`) rather than a desktop↔mobile pair. It owns the `submit()`
skeleton (re-entrancy guard → optional empty-fields check → clear error, lock → login → resolve a
role-based redirect target → navigate → catch → unlock); each page keeps its own `let busy`/`let error`
locals and markup, wiring them through the `LoginSubmitIO` callbacks. The same file holds three siblings
covering member's other three auth pages (`docs/adr/0019`) — `submitRegister`, `submitPasswordReset` and
`submitForgot`, each with its own narrow IO interface (`RegisterSubmitIO`/`PasswordResetSubmitIO`/
`ForgotSubmitIO`) — deliberately *not* refactored into a shared private core or a generic
`submitAuthAction`: the four functions' success side effects and catch policies genuinely differ
(register always has a redirect target, password-reset neither navigates nor logs in, forgot swallows
the error silently), and the timing contracts they encode differ in the same breath — `navigate`/
`onSuccess` fire *before* the `finally` unlock while forgot's `onSettled` fires *after* it. Forgot's
anti-enumeration guarantee is structural rather than documentary: `ForgotSubmitIO` simply has no
`setError`, so no call site can leak whether the address existed.

## Testing

Vitest + `@testing-library/svelte` (jsdom, setup in `src/vitest-setup.ts`), with co-located `*.test.ts`.
The *convention* — extract pure logic into a sibling `.ts` so it's testable without rendering — is a
coding standard; see the `coding-standards` skill → `references/frontend.md`. Not every `.ts` has a
same-named `.test.ts`, though: `member/waitlist.ts`, `leave.ts`, `points.ts`, and `subscriptions.ts` have
no sibling test file of their own — their mutator/adapter pins live in the topic-named
`checkout-api.test.ts` and `leave-requests-api.test.ts` instead, while the shared session-identity
protocol itself (guard, epoch, reconcile chain) is tested exactly once, generically, in lib-root's
`session-gate.test.ts` (`docs/adr/0017`). "Co-located" above means co-located with the API surface a test
exercises, not a strict 1:1 file-name mirror.

## Mobile surfaces use an overlay host, not nested routes

`/mobile` and `/mobile-admin` render most secondary views as sheets/screens via `OverlayHost.svelte` +
an `overlays/` folder, rather than as additional SvelteKit routes. New mobile views usually mean a new
overlay component + a store entry, not a new route.
