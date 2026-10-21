# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This is a **single-context** repo: one `GLOSSARY.md` (the domain glossary) and one `docs/adr/` at the repo
root. `AGENTS.md` → Domain docs maps where each kind of question is answered (terms, rules, why, where;
ADR 0032). Before exploring an area, take its terms from `GLOSSARY.md`, its rules from the owner module's
header, and read the ADRs that touch it.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`; each entry's _Avoid_ line marks the wrong synonyms.

If the concept you need isn't in the glossary yet, that's a signal — either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/grill-with-docs`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly:

> _Contradicts ADR-0007 — but worth reopening because…_
