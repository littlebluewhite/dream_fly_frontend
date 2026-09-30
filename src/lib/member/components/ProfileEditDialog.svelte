<script lang="ts">
  /* 編輯個人資料 (Edit profile) — own modal (overlay + panel) with a local
   * editable copy of the member profile, a 2-col field grid and a notification
   * preferences section. Ported from the prototype's ProfileEditDialog
   * (client/views.jsx).
   * R13 Task 3(C1):姓名/電話/生日/課前提醒/活動與優惠全部真的寫回後端(PATCH
   * /users/me,經會員資料 module 的 saveSelfAccount,由帳戶頁呼叫)。後端沒有的欄位
   * (會員編號、家長聯絡人、頭像顏色)拿掉;email 只讀(後端不收)。表單規則同後端
   * (selfAccountEditError),不合法時「儲存資料」停用並顯示原因。 */
  import { Avatar, Button, IconButton, Input, Switch, Icon } from '$lib/components/ui';
  import { initialOf } from '$lib/api/wire';
  import { selfAccountEditError, type SelfAccount, type Prefs, type SelfAccountEdit } from '$lib/self-account';

  export let open = false;
  export let profile: SelfAccount;
  export let prefs: Prefs;
  /** 儲存中:停用「儲存資料」(防連點)。 */
  export let saving = false;
  export let onClose: () => void = () => {};
  export let onSave: (edit: SelfAccountEdit) => void = () => {};

  type Draft = { name: string; phone: string; birth: string; classReminder: boolean; promo: boolean };
  function draftOf(): Draft {
    return { name: profile.name, phone: profile.phone, birth: profile.birth, classReminder: prefs.classReminder, promo: prefs.promo };
  }

  // Local editable copy, reset each time the dialog transitions to open.
  // Check-and-update must live in ONE reactive statement (mirrors
  // CouponCreateDialog's lastOpen idiom) — splitting the write into its own
  // trailing `$:` statement (as this used to) is unreliable: Svelte
  // topologically orders reactive statements by dependency, so the writer runs
  // BEFORE this reader in the same flush, making the transition undetectable
  // (FE#19 — an unsaved edit could survive a close → reopen on the same
  // mounted instance instead of reverting to the real profile).
  let f: Draft = draftOf();
  let lastOpen = false;
  $: {
    if (open && !lastOpen) f = draftOf();
    lastOpen = open;
  }

  $: error = selfAccountEditError({ name: f.name, phone: f.phone }, profile);

  function save() {
    onSave({ name: f.name, phone: f.phone, birth: f.birth, prefs: { classReminder: f.classReminder, promo: f.promo } });
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={onKeydown} />

{#if open && f}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div
    on:click={onClose}
    style="position:fixed;inset:0;z-index:1000;background:rgba(15,23,42,0.55);backdrop-filter:blur(2px);display:flex;align-items:center;justify-content:center;padding:24px;font-family:var(--df-font-body)"
  >
    <div
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      on:click|stopPropagation
      style="width:100%;max-width:520px;background:#fff;border-radius:16px;box-shadow:var(--df-shadow-strong);overflow:hidden;display:flex;flex-direction:column;max-height:88vh"
    >
      <div style="padding:20px 24px;border-bottom:1px solid var(--df-border);display:flex;align-items:center;gap:12px">
        <Avatar name={initialOf(f.name, profile.initial)} size="md" />
        <div style="flex:1">
          <h3 style="margin:0;font-family:var(--df-font-heading);font-size:19px;font-weight:800;color:var(--df-ink)">編輯個人資料</h3>
          <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px;font-family:var(--df-font-mono)">{profile.email}</div>
        </div>
        <IconButton aria-label="關閉" variant="ghost" on:click={onClose}><Icon name="x" size={20} /></IconButton>
      </div>
      <div style="padding:24px;overflow-y:auto;display:flex;flex-direction:column;gap:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <Input label="學員姓名" bind:value={f.name} />
          <Input label="生日" type="date" bind:value={f.birth} />
          <Input label="聯絡電話" bind:value={f.phone} />
          <Input label="Email" value={profile.email} disabled helper="Email 無法在此變更" />
        </div>
        {#if error}<div role="alert" style="font-size:12.5px;color:var(--df-error)">{error}</div>{/if}
        <div style="border-top:1px solid var(--df-border);padding-top:16px">
          <div style="font-size:14px;font-weight:700;color:var(--df-ink);margin-bottom:10px">通知偏好</div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">課前提醒</div>
              <div style="font-size:12.5px;color:var(--df-text-light)">課程開始前一日以 Email 通知</div>
            </div>
            <Switch bind:checked={f.classReminder} />
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
            <div>
              <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">活動與優惠</div>
              <div style="font-size:12.5px;color:var(--df-text-light)">接收特訓營、賽事與優惠訊息</div>
            </div>
            <Switch bind:checked={f.promo} />
          </div>
        </div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid var(--df-border);display:flex;justify-content:flex-end;gap:12px">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" disabled={!!error || saving} on:click={save}><Icon name="check" size={16} />儲存資料</Button>
      </div>
    </div>
  </div>
{/if}
