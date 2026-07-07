<script lang="ts">
  /* 優惠碼管理 — Task 8 piece 3：新頁面。後端只有 GET /coupons（列表）與 POST
   * /coupons（建立），沒有 update/delete 端點（issue #4 已註記，本輪刻意不開新
   * 端點），所以這裡沒有編輯/刪除欄或按鈕——同 MembersTable 對缺端點欄位的處理
   * 原則：沒有端點就誠實不做，不留假控制項。
   *
   * 三態載入（loading/error/ready）同其餘 admin 頁慣例。建立成功後重新整包呼叫
   * GET /coupons 刷新列表（優惠碼清單量小，重新拉取比手動映射插入更簡單可靠）；
   * 只有建立本身失敗才顯示錯誤 toast 且不刷新——若建立成功但刷新這一步失敗，
   * 視為最佳努力（不覆蓋剛才的成功提示，也不算整體失敗）。 */
  import { onMount } from 'svelte';
  import { Button, Card, Icon, ErrorState, Skeleton, SkelCard, PaginationBar } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatusBadge from '$lib/admin/components/StatusBadge.svelte';
  import CouponCreateDialog from '$lib/admin/components/CouponCreateDialog.svelte';
  import { fmtNT } from '$lib/admin/format';
  import { toasts } from '$lib/admin/stores';
  import { getCoupons, createCoupon, type Coupon, type CreateCouponBody } from '$lib/admin/api';
  import { ApiError } from '$lib/api/client';

  let phase: 'loading' | 'error' | 'ready' = 'loading';
  let coupons: Coupon[] = [];
  let createOpen = false;
  // Task 17：admin 列表分頁——page/total/perPage 皆來自 getCoupons() 回應；
  // PaginationBar 換頁時呼叫 changePage(newPage) 重新 load() 重抓。
  let page = 1;
  let total = 0;
  let perPage = 20;

  // 複審修復（Finding 3）：page 樂觀更新，寫在 getCoupons() 之前——即使這次換頁失敗，
  // page 也已經是使用者實際要求的目標頁，讓下面 <ErrorState onRetry> 的重試能對到正確
  // 頁碼（而非停留在換頁前的舊頁碼）。
  function load(p = page) {
    page = p;
    phase = 'loading';
    getCoupons(p)
      .then((d) => {
        coupons = d.coupons;
        total = d.total;
        page = d.page;
        perPage = d.perPage;
        phase = 'ready';
      })
      .catch(() => { phase = 'error'; });
  }
  onMount(load);

  function changePage(p: number) {
    load(p);
  }

  // 409（代碼重複）/ 422 驗證 / 403 權限 → 對應的繁中錯誤提示；其餘給通用訊息，
  // 同 classes/orders 頁的 ApiError 判斷慣例。
  function couponErrorMessage(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 409) return '此優惠碼代碼已存在，請換一組代碼。';
      if (e.status === 422) return '輸入資料不符規則，請確認後再試。';
      if (e.status === 403) return '沒有權限執行此操作。';
    }
    return '連線發生問題，請稍後再試。';
  }

  async function create(body: CreateCouponBody) {
    try {
      await createCoupon(body);
    } catch (e) {
      toasts.notify('error', '新增失敗', couponErrorMessage(e));
      return;
    }
    createOpen = false;
    toasts.notify('success', '已新增優惠碼', `「${body.code}」已建立。`);
    try {
      const refreshed = await getCoupons(page);
      coupons = refreshed.coupons;
      total = refreshed.total;
      page = refreshed.page;
      perPage = refreshed.perPage;
    } catch {
      // 最佳努力：新增已成功，只有刷新列表失敗——不覆蓋剛才的成功 toast。
    }
  }
</script>

{#if phase === 'ready'}
  <div class="view">
    <PageHead title="優惠碼管理" sub={total + ' 組優惠碼'}>
      <svelte:fragment slot="actions">
        <Button variant="primary" size="sm" on:click={() => (createOpen = true)}>
          <Icon name="plus" size={15} />新增優惠碼
        </Button>
      </svelte:fragment>
    </PageHead>

    <Card padding={0} style="overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--df-bg-light)">
            <th class="th">代碼</th>
            <th class="th">折扣金額</th>
            <th class="th">狀態</th>
            <th class="th">到期日</th>
          </tr>
        </thead>
        <tbody>
          {#each coupons as c (c.id)}
            <tr class="row">
              <td class="td td-code">{c.code}</td>
              <td class="td td-amount">{fmtNT(c.discount)}</td>
              <td class="td">
                <StatusBadge kind="memberAccount" value={c.active ? 'active' : 'inactive'} />
              </td>
              <td class="td td-muted">{c.expiresAt}</td>
            </tr>
          {/each}
          {#if coupons.length === 0}
            <tr>
              <td colspan="4" class="empty">尚無優惠碼</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </Card>

    <PaginationBar {page} {total} {perPage} onPageChange={changePage} />
  </div>

  <CouponCreateDialog open={createOpen} onClose={() => (createOpen = false)} onSave={create} />
{:else if phase === 'error'}
  <!-- 複審修復（Finding 3）：onRetry 包一層無參數箭頭函式——ErrorState 內部的 Button 會把
       原生 click 事件轉發給 onRetry，若直接傳 load，p 收到的會是 MouseEvent 而非
       page，讓上面的樂觀賦值失真；包成 () => load() 才能讓 p 正確地退回預設值 page。 -->
  <Card padding={0}><ErrorState onRetry={() => load()} /></Card>
{:else}
  <div class="view" data-testid="coupons-skeleton">
    <Skeleton w={180} h={32} r={8} />
    <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
  </div>
{/if}

<style>
  .view {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .th {
    text-align: left;
    padding: 11px 22px;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--df-text-light);
    letter-spacing: 0.03em;
    white-space: nowrap;
  }
  .row {
    border-bottom: 1px solid var(--df-border);
  }
  .row:last-child {
    border-bottom: none;
  }
  .td {
    padding: 13px 22px;
  }
  .td-code {
    font-family: var(--df-font-mono);
    font-size: 13px;
    font-weight: 600;
    color: var(--df-primary);
  }
  .td-amount {
    font-family: var(--df-font-mono);
    font-size: 13.5px;
    font-weight: 700;
    color: var(--df-text-dark);
  }
  .td-muted {
    font-size: 13px;
    color: var(--df-text-light);
    font-family: var(--df-font-mono);
  }
  .empty {
    padding: 40px 22px;
    text-align: center;
    color: var(--df-text-muted);
    font-size: 14px;
  }
  /* leading icon beside the PageHead action label */
  .view :global(.btn-primary) {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }
</style>
