<script lang="ts">
  /* 新增/編輯優惠碼 — form inside the shared EditModal. Task F6：後端已補上
   * PATCH/DELETE /coupons/{id}（契約 §3.9），這裡比照 TicketEditDialog（Task F1）的
   * isNew 分支擴成建立/編輯兩用，取代原本的 create-only 表單（issue #4 的「本輪不開
   * 新端點」已不成立）。
   *
   * 編輯模式（isNew=false）：code 唯讀（契約明文 PATCH 不可改 code——它是對外發放的
   * 識別）；可改折抵金額／狀態（優惠碼啟用 Switch，同 MemberEditDialog 帳號啟用
   * 慣例）／到期日（清空＝清成永久有效）。新增模式沒有狀態欄位——POST /coupons 沒有
   * is_active 欄位，新建立的優惠碼一律由後端預設為啟用。
   *
   * 危險區：刪除放在編輯模式表單最下方的獨立區塊（次要位置），按下只是 emit
   * onDelete()，實際的確認 + DELETE 呼叫在呼叫端（routes/admin/coupons/+page.svelte）
   * ——DELETE 是硬刪除，語意上僅適用誤建且尚未被使用的 code（orders 只存 code 字串
   * 快照無 FK，不影響歷史訂單，但用過的代碼仍該用停用），確認文案由呼叫端的確認
   * 對話框負責講清楚，這裡只放入口，不重複寫警語。
   *
   * onSave 沿用 TicketEditDialog/VenueEditDialog 慣例：emit 編輯後的 domain Coupon，
   * 由呼叫端依 isNew 分別組出 CreateCouponBody/UpdateCouponBody 送出真正的
   * POST/PATCH（兩者欄位形狀不同——code 只在 create、is_active 只在 update——不是
   * ProductWriteBody/VenueWriteBody 那種可共用的寬鬆單一型別，故由呼叫端各自組
   * body，本元件不知道 wire body 形狀，只認得 Coupon）。 */
  import { Input, Switch, Button } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import type { Coupon } from '$lib/admin/api';

  export let coupon: Coupon | null = null;
  export let open = false;
  export let isNew = false;
  export let onClose: () => void = () => {};
  export let onSave: (updated: Coupon) => void = () => {};
  export let onDelete: () => void = () => {};

  // Local editable copy, reset whenever the coupon prop changes (mirrors
  // TicketEditDialog's lastTicket idiom). expiresDate is the yyyy-mm-dd buffer for
  // <input type=date>；coupon.expiresAt 的 '—' 哨兵（見 admin/api.ts mapCoupon）對應
  // 空白（永久有效）。
  let f: Coupon | null = coupon;
  let code = coupon?.code ?? '';
  let discountText = coupon ? String(coupon.discount) : '';
  let expiresDate = coupon && coupon.expiresAt !== '—' ? coupon.expiresAt : '';
  let isActive = coupon ? coupon.active : true;
  let lastCoupon: Coupon | null = coupon;
  $: if (coupon !== lastCoupon) {
    lastCoupon = coupon;
    f = coupon ? { ...coupon } : null;
    code = coupon?.code ?? '';
    discountText = coupon ? String(coupon.discount) : '';
    expiresDate = coupon && coupon.expiresAt !== '—' ? coupon.expiresAt : '';
    isActive = coupon ? coupon.active : true;
  }

  function save() {
    if (!f) return;
    const updated: Coupon = {
      ...f,
      code: code.trim(),
      discount: parseInt(discountText, 10) || 0,
      active: isActive,
      expiresAt: expiresDate || '—'
    };
    onSave(updated);
  }
</script>

{#if f}
  <EditModal
    {open}
    title={isNew ? '新增優惠碼' : '編輯優惠碼'}
    sub={isNew ? '建立新的折扣代碼' : '優惠碼 ' + f.code}
    icon="percent"
    primaryLabel={isNew ? '建立優惠碼' : '儲存優惠碼'}
    {onClose}
    onSave={save}
  >
    <div style="display:flex;flex-direction:column;gap:14px">
      <Input label="優惠碼代碼" bind:value={code} placeholder="例如 SPRING10" disabled={!isNew} />
      <Input label="折扣金額 (NT$)" bind:value={discountText} placeholder="例如 300" />
      <Input label="到期日（選填，留白為永久有效）" type="date" bind:value={expiresDate} />
      {#if !isNew}
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:4px">
          <span style="font-size:14px;font-weight:600;color:var(--df-text-dark)">優惠碼啟用</span>
          <Switch bind:checked={isActive} />
        </div>
        <div class="danger-zone">
          <div>
            <div class="danger-title">刪除優惠碼</div>
            <div class="danger-sub">僅適用於誤建且尚未被使用的代碼，刪除後無法復原。</div>
          </div>
          <Button variant="danger" size="sm" on:click={onDelete}>刪除</Button>
        </div>
      {/if}
    </div>
  </EditModal>
{/if}

<style>
  .danger-zone {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-top: 14px;
    margin-top: 4px;
    border-top: 1px solid var(--df-border);
  }
  .danger-title {
    font-size: 13.5px;
    font-weight: 700;
    color: var(--df-text-dark);
  }
  .danger-sub {
    font-size: 12px;
    color: var(--df-text-light);
    margin-top: 2px;
  }
</style>
