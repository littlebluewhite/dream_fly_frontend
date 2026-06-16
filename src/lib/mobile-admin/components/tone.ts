/** Resolve a MiniBar tone to a CSS colour. Semantic keywords map to --df-* tokens;
 *  any other value (a hex / var() colour) passes through verbatim. 'primary' MUST
 *  be mapped — emitting the bare keyword as `background:primary` is invalid CSS and
 *  renders the progress fill transparent. */
export function toneColor(tone: string): string {
	if (tone === 'primary') return 'var(--df-primary)';
	if (tone === 'warning') return 'var(--df-warning)';
	if (tone === 'success') return 'var(--df-success)';
	return tone;
}
