<script lang="ts">
  /* 共用分頁列（Task 17）—— members/classes/tickets/orders/coupons 五個 admin 列表頁
   * 共用同一顆換頁 UI。純受控元件：不持有 page 狀態，只依 page/total/perPage 算出
   * 「第 x 頁，共 M 筆」與是否為第一/最末頁；換頁一律經 onPageChange 通知呼叫端 ——
   * 呼叫端持有 page state，收到通知後自行重新呼叫對應 seam 重抓資料。 */
  import Button from './Button.svelte';
  import Icon from './Icon.svelte';

  export let page: number;
  export let total: number;
  export let perPage: number;
  export let onPageChange: (page: number) => void = () => {};

  $: lastPage = Math.max(1, Math.ceil(total / perPage));
</script>

<div class="pager">
  <Button variant="secondary" size="sm" disabled={page <= 1} on:click={() => onPageChange(page - 1)}>
    <Icon name="chevron-left" size={15} />上一頁
  </Button>
  <span class="info">第 {page} 頁，共 {total} 筆</span>
  <Button variant="secondary" size="sm" disabled={page >= lastPage} on:click={() => onPageChange(page + 1)}>
    下一頁<Icon name="chevron-right" size={15} />
  </Button>
</div>

<style>
  .pager {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 6px 0;
  }
  .info {
    font-size: 13px;
    color: var(--df-text-light);
    white-space: nowrap;
  }
  .pager :global(button) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
