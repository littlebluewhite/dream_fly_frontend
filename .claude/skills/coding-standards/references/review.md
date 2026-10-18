# Review checklist

Apply when reviewing a diff or PR. Each item is a pass/fail gate; cite `file:line` for any failure.

## Scope
- [ ] **Orphans**: are exported functions/types the change made unused removed? (Unused imports and locals already fail `noUnusedLocals`.) Pre-existing dead code is mentioned, left in place.

## Repo conventions (see `frontend.md`)
- [ ] Pure logic extracted to a sibling `.ts` and unit-tested.
- [ ] Co-located `*.test.ts` added/updated; new behaviour has a test.
- [ ] Shared stores built on the existing gates and the single `createCart`; `localStorage` stores follow the SSR-guard pattern.
- [ ] A new top-level surface is wired into the root layout's `isAppSurface` check.
- [ ] Domain terms match the `GLOSSARY.md` glossary (no *Avoid* synonyms).
- [ ] **GLOSSARY diffs touch only definitions and `_Avoid_` lines**: a rule change (invariant, protocol step, when to use what) shows up in the owner module's header doc instead (ADR 0032).
- [ ] **Last-started wins is the gate's job, not hand-written**: a shared store refetches through its 水合閘門 (or a session 閘門 built on it), whose departure ledger (`createDepartureLedger`) already stops an earlier fetch that lands late from overwriting a newer snapshot. A store or page must not keep its own sequence number or pass a custom `isCurrent` for this; a shared store that fetches outside the gates uses the ledger, and a test interleaves two fetches to prove it.

## Domain safety
- [ ] If domain logic changed, the relevant `docs/adr/` was checked and any conflict with an ADR invariant (e.g. ADR-0001 course/pass independence) is surfaced.

## Verification
- [ ] The **verification gate** is green.
- [ ] Tests actually cover the new behaviour, not just compile.
- [ ] **Sibling tests**: when the diff changes an existing test's expected outcome, the other tests of the same unit are read for any still asserting the old behaviour; a contradicting pair is a failure.
