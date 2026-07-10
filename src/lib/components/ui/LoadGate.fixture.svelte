<script lang="ts">
  /* LoadGate 契約測試 fixture:props 切換傳入的 gate、是否覆寫 error slot、
   * errorTitle/errorBody 透傳。slot 必須是元件的直接子節點,無法在單一實例內
   * 條件化提供,故以 {#if} 分出「有覆寫」與「無覆寫(走 fallback)」兩個實例。
   * 覆寫分支以 let:retry 取得重試函式——repo 首個 let: slot prop 用例,
   * 同時證明 Svelte 5 legacy 編譯下 slot fallback 與 let: 都可用。 */
  import LoadGate from './LoadGate.svelte';
  import type { LoadGate as FlatGate, PagedLoadGate } from '$lib/load-gate';

  export let gate: FlatGate | PagedLoadGate;
  export let withErrorSlot = false;
  export let errorTitle: string | undefined = undefined;
  export let errorBody: string | undefined = undefined;
</script>

{#if withErrorSlot}
  <LoadGate {gate} {errorTitle} {errorBody}>
    <span slot="loading">LOADING_SLOT_CONTENT</span>
    <svelte:fragment slot="error" let:retry>
      <span>ERROR_OVERRIDE_CONTENT</span>
      <button type="button" on:click={retry}>OVERRIDE_RETRY</button>
    </svelte:fragment>
    <span>READY_SLOT_CONTENT</span>
  </LoadGate>
{:else}
  <LoadGate {gate} {errorTitle} {errorBody}>
    <span slot="loading">LOADING_SLOT_CONTENT</span>
    <span>READY_SLOT_CONTENT</span>
  </LoadGate>
{/if}
