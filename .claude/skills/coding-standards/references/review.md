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
- [ ] **Last-started wins**: when a shared store can be refetched while an earlier fetch is still in flight, the earlier one landing late must not overwrite the newer snapshot (e.g. the `refreshSeq` guard in `lib/coach/conversations.ts`), and a test interleaves two fetches to prove it.

## Domain safety
- [ ] If domain logic changed, the relevant `docs/adr/` was checked and any conflict with an ADR invariant (e.g. ADR-0001 course/pass independence) is surfaced.

## Verification
- [ ] The **verification gate** is green.
- [ ] Tests actually cover the new behaviour, not just compile.
- [ ] **Sibling tests**: when the diff changes an existing test's expected outcome, the other tests of the same unit are read for any still asserting the old behaviour; a contradicting pair is a failure.
