<script lang="ts">
  /* Icon 門面元件——實際的 Lucide import + 141 鍵註冊表已搬至 $lib/icon-registry
   * (單源;見該檔 JSDoc)。這裡只做 name → component 的 runtime 查找 + 渲染。
   * `name` 本階段仍是 string(K6-3/T12 才收窄為 IconName)。 */
  import { ICONS, type IconComponent } from '$lib/icon-registry';

  export let name: string;
  export let size: number | string = 20;
  export let color: string = 'currentColor';
  export let strokeWidth: number | string = 2;
  export let style = '';
  let className = '';
  export { className as class };

  // ICONS keeps its literal-key type (via `satisfies`) so IconName stays a real
  // union; name is still a bare string this stage (K6-3/T12 narrows it), so the
  // lookup needs a dictionary view here — same laxity the old `Record<string, …>`
  // declaration always had, just relocated to the call site. Missing keys still
  // resolve to undefined and are caught by the {#if Cmp} guard below.
  $: Cmp = (ICONS as Record<string, IconComponent>)[name];
</script>

{#if Cmp}
  <svelte:component this={Cmp} {size} {color} {strokeWidth} {style} class={className} />
{/if}
