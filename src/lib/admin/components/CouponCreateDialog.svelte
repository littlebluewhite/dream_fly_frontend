<script lang="ts">
  /* 新增優惠碼 — create-only form inside the shared EditModal (Task 8 piece 3).
   * 後端只有 POST /coupons（無 update/delete，issue #4 已註記，本輪不開新端點），所以
   * 這裡沒有 ClassEditDialog/TicketEditDialog 那種 isNew/編輯共用的分支——永遠是
   * 「新增」。三個欄位：優惠碼代碼／折扣金額 (NT$)／到期日（選填，留白為永久有效）。
   * 到期日用 <input type=date>（YYYY-MM-DD），送出前轉成「當日結束」的 UTC 時間戳
   * (T23:59:59Z)，讓「到期日當天仍可使用」符合直覺；留白則整個 expires_at 欄位省略
   * （JSON.stringify 略過 undefined），對應後端 Option 語意的「永不過期」。折扣金額
   * 經 toCents 轉換成 cents。不做欄位格式驗證——交由後端 422 判斷，成功/失敗一律由
   * 呼叫端（coupons/+page.svelte）依 API 結果顯示 toast，本元件不自己丟成功 toast。 */
  import { Input } from '$lib/components/ui';
  import EditModal from './EditModal.svelte';
  import { toCents } from '$lib/public/adapters';
  import type { CreateCouponBody } from '$lib/admin/api';

  export let open = false;
  export let onClose: () => void = () => {};
  export let onSave: (body: CreateCouponBody) => void = () => {};

  let code = '';
  let discountText = '';
  let expiresDate = ''; // yyyy-mm-dd（<input type=date>），留白＝永久有效

  // Reset the form whenever the dialog transitions to open. Check-and-update
  // must live in ONE reactive statement (mirrors ClassEditDialog's lastKlass
  // idiom) — splitting the `wasOpen` write into its own trailing `$:` statement
  // (as PasswordDialog does) is unreliable: Svelte topologically orders
  // reactive statements by dependency, so the writer can run BEFORE this
  // reader in the same flush, making the transition undetectable.
  let lastOpen = false;
  $: {
    if (open && !lastOpen) {
      code = '';
      discountText = '';
      expiresDate = '';
    }
    lastOpen = open;
  }

  function save() {
    const body: CreateCouponBody = {
      code: code.trim(),
      discount_cents: toCents(parseInt(discountText, 10) || 0)
    };
    if (expiresDate) body.expires_at = `${expiresDate}T23:59:59Z`;
    onSave(body);
  }
</script>

<EditModal
  {open}
  title="新增優惠碼"
  sub="建立新的折扣代碼"
  icon="percent"
  primaryLabel="建立優惠碼"
  {onClose}
  onSave={save}
>
  <div style="display:flex;flex-direction:column;gap:14px">
    <Input label="優惠碼代碼" bind:value={code} placeholder="例如 SPRING10" />
    <Input label="折扣金額 (NT$)" bind:value={discountText} placeholder="例如 300" />
    <Input label="到期日（選填，留白為永久有效）" type="date" bind:value={expiresDate} />
  </div>
</EditModal>
