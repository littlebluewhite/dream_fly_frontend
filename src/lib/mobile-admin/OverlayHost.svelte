<script lang="ts">
  /* Overlay host — 把 overlay store 的 push-stack 頂層 + 當前 sheet 對應到元件並渲染。
   * 對應 app.jsx 的 push-stack（178-183）與 sheets（186-193）區塊。
   * push 一律帶 onBack={overlay.pop}，sheet 一律帶 onClose={overlay.closeSheet}，
   * 其餘 props 由 push/sheet 呼叫端透過 props 傳入並展開。 */
  import { overlay } from '$lib/mobile-admin/stores';
  import type { Component } from 'svelte';
  import type { MobileAdminPushId, MobileAdminSheetId } from '$lib/mobile-admin/stores';
  import { PUSH, SHEETS } from '$lib/mobile-admin/overlay-registry';

  // 註冊表(id → 元件)單源於 overlay-registry.ts,呼叫端 props 在 overlay.push/sheet 已按元件定型;
  // host 只負責展開,故此處取寬鬆的 Component<any> 視圖餵 <svelte:component>(寬化指派,非 as 斷言)。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const push: Record<MobileAdminPushId, Component<any>> = PUSH;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sheets: Record<MobileAdminSheetId, Component<any>> = SHEETS;

  $: top = $overlay.stack[$overlay.stack.length - 1];
</script>

{#if top && push[top.id]}
  <svelte:component this={push[top.id]} onBack={overlay.pop} {...top.props} />
{/if}

{#if $overlay.sheet && sheets[$overlay.sheet.id]}
  <svelte:component this={sheets[$overlay.sheet.id]} onClose={overlay.closeSheet} {...$overlay.sheet.props} />
{/if}
