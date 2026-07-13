<script lang="ts">
  /* Icon 門面元件——實際的 Lucide import + 141 鍵註冊表已搬至 $lib/icon-registry
   * (單源;見該檔 JSDoc)。這裡只做 name → component 的 runtime 查找 + 渲染。
   * `name` 已收窄為 IconName(K6-3/T12)——全倉呼叫端型別即守衛,不需要 runtime
   * dictionary view 或斷言。{#if Cmp} 仍保留作執行期防線(理論上不會落空,但
   * 維持防禦寫法,和 registry 本身脫鉤的假設風險隔開)。 */
  import { ICONS, type IconName } from '$lib/icon-registry';

  export let name: IconName;
  export let size: number | string = 20;
  export let color: string = 'currentColor';
  export let strokeWidth: number | string = 2;
  export let style = '';
  let className = '';
  export { className as class };

  $: Cmp = ICONS[name];
</script>

{#if Cmp}
  <svelte:component this={Cmp} {size} {color} {strokeWidth} {style} class={className} />
{/if}
