<script lang="ts">
  /* Error-state block with an optional retry button. */
  import Icon from './Icon.svelte';
  import Button from './Button.svelte';
  export let title = '載入失敗';
  export let body = '連線發生問題，無法取得最新資料，請稍後再試。';
  export let onRetry: (() => void) | null = null;
</script>

<div class="err">
  <div class="bubble"><Icon name="cloud-off" size={30} color="var(--df-error)" /></div>
  <div class="title">{title}</div>
  <div class="body">{body}</div>
  {#if onRetry}
    <div class="action">
      <Button variant="secondary" on:click={onRetry}>
        <Icon name="rotate-cw" size={15} /> 重新載入
      </Button>
    </div>
  {/if}
</div>

<style>
  .err {
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 56px 24px;
  }
  .bubble {
    width: 66px;
    height: 66px;
    border-radius: 18px;
    background: var(--df-error-bg);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }
  .title {
    font-size: 16px;
    font-weight: var(--df-weight-bold);
    color: var(--df-ink);
  }
  .body {
    font-size: 13.5px;
    color: var(--df-text-light);
    max-width: 360px;
    line-height: 1.6;
  }
  .action {
    margin-top: 12px;
  }
</style>
