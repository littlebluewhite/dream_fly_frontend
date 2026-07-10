<script lang="ts">
  /* 優惠碼管理 — Task 8 piece 3：新頁面（列表 + 建立）。Task F6：後端已補上
   * PATCH/DELETE /coupons/{id}（契約 §3.9），這裡接上編輯／停用啟用／刪除。
   *
   * 停用（PATCH is_active:false）是主要路徑——列表列的「停用/啟用」按鈕一鍵直接呼叫
   * updateCoupon，不開對話框、也不需要確認步驟（可逆、低風險）。DELETE 是次要、危險
   * 的路徑，只留給誤建且尚未被使用的 code（orders 只存 code 字串快照、無 FK，刪除
   * 不影響歷史訂單，但已被使用過的代碼還是該用停用）——所以刪除藏在編輯對話框
   * （CouponCreateDialog，現已擴為建立/編輯兩用）最下方的危險區，且必須先經過一個
   * 獨立的確認 Dialog（confirmDelete）才會真的送出 DELETE。
   *
   * 三態載入（loading/error/ready）同其餘 admin 頁慣例。建立/編輯/停用啟用成功後一律
   * gate.silentRefresh() 重新整包刷新列表；失敗顯示繁中錯誤 toast——建立/編輯對話框
   * 維持開啟以便修正重試（同 tickets/venues 頁慣例），刪除確認對話框則無論成敗都
   * 關閉（沒有「欄位」可修正重試，失敗只能之後從列表重新觸發一次）。 */
  import { onMount } from 'svelte';
  import { Button, Card, Icon, Dialog, LoadGate, Skeleton, SkelCard, PaginationBar } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatusBadge from '$lib/admin/components/StatusBadge.svelte';
  import CouponCreateDialog from '$lib/admin/components/CouponCreateDialog.svelte';
  import { buildCreateCouponBody, buildUpdateCouponBody } from '$lib/admin/components/coupon-request';
  import { fmtNT } from '$lib/admin/format';
  import { toasts } from '$lib/admin/stores';
  import { createPagedLoadGate } from '$lib/load-gate';
  import { getCoupons, createCoupon, updateCoupon, deleteCoupon, type Coupon } from '$lib/admin/api';
  import { apiErrorText } from '$lib/api/error-text';

  // Blank 優惠碼 for the 新增 flow (mirrors tickets/venues 頁 blankTicket/blankVenue)。
  const blankCoupon = (): Coupon => ({ id: '', code: '', discount: 0, active: true, expiresAt: '—' });

  let coupons: Coupon[] = [];
  let edit: Coupon | null = null;
  let editOpen = false;
  let addNew = false;
  let deleteTarget: Coupon | null = null;

  const gate = createPagedLoadGate({
    fetch: (page) => getCoupons(page),
    onData: (d) => { coupons = d.coupons; }
  });
  onMount(() => {
    gate.load();
  });

  function openEdit(c: Coupon) {
    addNew = false;
    edit = c;
    editOpen = true;
  }
  function openNew() {
    addNew = true;
    edit = blankCoupon();
    editOpen = true;
  }
  function closeEdit() {
    editOpen = false;
    edit = null;
    addNew = false;
  }

  // 409（代碼重複）/ 422 驗證 / 403 權限 / 404（操作當下代碼已被別處刪除）→ 對應的
  // 繁中錯誤提示；其餘給通用訊息，同 tickets/venues 頁的 ApiError 判斷慣例。
  function couponErrorMessage(e: unknown): string {
    return apiErrorText(e, {
      409: '此優惠碼代碼已存在，請換一組代碼。',
      422: '輸入資料不符規則，請確認後再試。',
      403: '沒有權限執行此操作。',
      404: '此優惠碼已不存在，請重新整理列表。'
    });
  }

  async function save(updated: Coupon) {
    const wasNew = addNew;
    try {
      if (wasNew) {
        await createCoupon(buildCreateCouponBody(updated));
      } else {
        await updateCoupon(updated.id, buildUpdateCouponBody(updated));
      }
    } catch (e) {
      toasts.notify('error', wasNew ? '新增失敗' : '儲存失敗', couponErrorMessage(e));
      return;
    }
    closeEdit();
    toasts.notify(
      'success',
      wasNew ? '已新增優惠碼' : '已儲存優惠碼',
      `「${updated.code}」已${wasNew ? '建立' : '更新'}。`
    );
    await gate.silentRefresh();
  }

  // 列表列「停用/啟用」——一鍵直達，不開對話框、不需確認（可逆、低風險，見檔頭註解）。
  async function toggleActive(c: Coupon) {
    try {
      await updateCoupon(c.id, { is_active: !c.active });
    } catch (e) {
      toasts.notify('error', '操作失敗', couponErrorMessage(e));
      return;
    }
    toasts.notify('success', c.active ? '已停用' : '已啟用', `「${c.code}」已${c.active ? '停用' : '啟用'}。`);
    await gate.silentRefresh();
  }

  // 刪除——危險區按鈕先關掉編輯對話框、開確認 Dialog；真正的 DELETE 呼叫在
  // confirmDelete()，使用者按下確認後才會送出。
  function requestDelete(c: Coupon) {
    closeEdit();
    deleteTarget = c;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    deleteTarget = null;
    try {
      await deleteCoupon(target.id);
    } catch (e) {
      toasts.notify('error', '刪除失敗', couponErrorMessage(e));
      return;
    }
    toasts.notify('success', '已刪除優惠碼', `「${target.code}」已刪除。`);
    await gate.silentRefresh();
  }
</script>

<LoadGate {gate}>
  <div class="view" data-testid="coupons-skeleton" slot="loading">
    <Skeleton w={180} h={32} r={8} />
    <SkelCard><Skeleton w="100%" h={320} r={12} /></SkelCard>
  </div>

  <div class="view">
    <PageHead title="優惠碼管理" sub={$gate.total + ' 組優惠碼'}>
      <svelte:fragment slot="actions">
        <Button variant="primary" size="sm" on:click={openNew}>
          <Icon name="plus" size={15} />新增優惠碼
        </Button>
      </svelte:fragment>
    </PageHead>

    <!-- G6：五個分頁頁統一範圍提示（原本 coupons 沒有這個提示，見任務簡報「刻意行為
         變更」）——只在還有下一頁時才提示，避免全部資料剛好一頁裝得下時的多餘雜訊。 -->
    {#if $gate.total > $gate.perPage}
      <p style="margin:0; font-size:13px; color:var(--df-text-light);">
        搜尋與篩選僅套用於目前頁面，若找不到資料請嘗試切換頁碼查看其他頁。
      </p>
    {/if}

    <Card padding={0} style="overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="background:var(--df-bg-light)">
            <th class="th">代碼</th>
            <th class="th">折扣金額</th>
            <th class="th">狀態</th>
            <th class="th">到期日</th>
            <th class="th">操作</th>
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
              <td class="td">
                <div style="display:flex; gap:8px;">
                  <Button variant="secondary" size="sm" on:click={() => openEdit(c)}>
                    <Icon name="pencil-line" size={14} style="margin-right:6px;" />編輯
                  </Button>
                  <Button variant="secondary" size="sm" on:click={() => toggleActive(c)}>
                    <Icon name={c.active ? 'circle-x' : 'circle-check'} size={14} style="margin-right:6px;" />
                    {c.active ? '停用' : '啟用'}
                  </Button>
                </div>
              </td>
            </tr>
          {/each}
          {#if coupons.length === 0}
            <tr>
              <td colspan="5" class="empty">尚無優惠碼</td>
            </tr>
          {/if}
        </tbody>
      </table>
    </Card>

    <PaginationBar page={$gate.page} total={$gate.total} perPage={$gate.perPage} onPageChange={gate.changePage} />
  </div>

  <CouponCreateDialog
    coupon={edit}
    open={editOpen}
    isNew={addNew}
    onClose={closeEdit}
    onSave={save}
    onDelete={() => edit && requestDelete(edit)}
  />

  <Dialog
    open={deleteTarget !== null}
    title="刪除優惠碼"
    onClose={() => (deleteTarget = null)}
    primaryAction={{ label: '確認刪除', onClick: confirmDelete, variant: 'danger' }}
    secondaryAction={{ label: '取消', onClick: () => (deleteTarget = null) }}
  >
    {#if deleteTarget}
      <p>
        確定要刪除優惠碼「{deleteTarget.code}」嗎？此動作僅適用於誤建且尚未被使用的代碼，刪除後無法復原。若此代碼已經有人使用過，請改用「停用」，以免影響歷史訂單的顯示。
      </p>
    {/if}
  </Dialog>
</LoadGate>

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
