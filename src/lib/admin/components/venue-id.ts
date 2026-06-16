/* Ensures a newly-added venue gets a unique keyed id, so the keyed
 * `{#each venues as v (v.id)}` never receives a duplicate id (which throws Svelte's
 * duplicate-key runtime error). The 場地代號 is user-editable in the 新增 dialog, so a
 * collision with an existing code — or with the generated fallback sequence — is possible.
 * A taken user code is suffixed (`A` → `A-2`); a blank code gets the next free `V{n}`. */
export function uniqueVenueId(existing: { id: string }[], desired: string): string {
  const taken = new Set(existing.map((v) => v.id));
  const base = desired.trim();
  if (base && !taken.has(base)) return base;
  if (base) {
    let n = 2;
    while (taken.has(`${base}-${n}`)) n++;
    return `${base}-${n}`;
  }
  let n = existing.length + 1;
  while (taken.has(`V${n}`)) n++;
  return `V${n}`;
}
