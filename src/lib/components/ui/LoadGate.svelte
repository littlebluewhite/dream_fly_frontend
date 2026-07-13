<script lang="ts">
  /* 三態載入(loading/error/ready)的呈現層 wrapper。閘門機制本身在
   * `$lib/load-gate`(ADR 0008,凍結)——本元件只把各 route 頁手抄的
   * `{#if $gate === 'loading'} … {:else if error} … {:else} …` 模板分支
   * 收斂成一個插槽契約:
   *   - slot="loading":載入骨架(頁面自備,無 fallback)
   *   - slot="error":錯誤畫面;未提供時 fallback 為慣用的 Card + ErrorState,
   *     覆寫時以 `let:retry` 取得重試函式
   *   - default slot:ready 內容
   * retry 一律呼叫 gate.refresh()、絕不呼叫 load()——`hydrate` 選項的 guard 短路只擋 load(),
   * refresh() 一律真抓(ADR 0008),retry 走 refresh 才不會被守衛短路。 */
  import type { LoadGate, PagedLoadGate } from '$lib/load-gate';
  import Card from './Card.svelte';
  import ErrorState from './ErrorState.svelte';

  /** flat 或 paged 閘門;$gate 訂閱值對應為 LoadPhase 或 PagedGateState */
  export let gate: LoadGate | PagedLoadGate;
  /** 透傳給預設 ErrorState;未傳(undefined)時沿用 ErrorState 自己的預設文案 */
  export let errorTitle: string | undefined = undefined;
  export let errorBody: string | undefined = undefined;

  // flat gate 的訂閱值是 phase 字串;paged gate 是 { phase, page, … } 物件。
  $: phase = typeof $gate === 'string' ? $gate : $gate.phase;

  function retry() {
    void gate.refresh();
  }
</script>

{#if phase === 'loading'}
  <slot name="loading" />
{:else if phase === 'error'}
  <slot name="error" {retry}>
    <Card padding={0}><ErrorState title={errorTitle} body={errorBody} onRetry={retry} /></Card>
  </slot>
{:else}
  <slot />
{/if}
