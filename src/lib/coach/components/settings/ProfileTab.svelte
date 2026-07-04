<script lang="ts">
  /* 個人資料 tab — edit form + live preview card + danger zone
   * coach 改為 required prop(元件樹檢查,Task 4):不再自行 import COACH,由
   * settings/+page.svelte 於 getSettings() ready 後下傳,換後端只動頁面一層。 */
  import type { Coach } from '$lib/coach/data';
  import { saveSettings } from '$lib/coach/api';
  import { toasts } from '$lib/coach/stores';
  import Card from '$lib/components/ui/Card.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Textarea from '$lib/components/ui/Textarea.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import CoachAvatar from '$lib/coach/components/CoachAvatar.svelte';

  export let coach: Coach;

  // Local copies of editable fields
  let name = coach.name;
  let email = coach.email;
  let phone = coach.phone;
  let gender = coach.gender;
  let birth = coach.birth;
  let emergency = coach.emergency;
  let bio = coach.bio;

  let saving = false;

  // name/phone 有對應的後端 PATCH /users/me 欄位，實際送出並儲存；email/gender/
  // birth/emergency/bio 後端不支援寫入，維持本地編輯、不送出(P2，同 api.ts 註解)。
  async function save() {
    saving = true;
    try {
      await saveSettings({ name, phone });
      toasts.notify('success', '個人資料已儲存', '變更將於下次登入時生效');
    } catch {
      toasts.notify('error', '儲存失敗', '連線發生問題，請稍後再試。');
    } finally {
      saving = false;
    }
  }

  function deactivate() {
    toasts.notify('warning', '帳號停用申請已送出', '請聯繫系統管理員確認');
  }
</script>

<div style="display:flex;flex-direction:column;gap:24px;padding-top:20px">
  <!-- Edit form + preview side by side on wide, stacked on narrow -->
  <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
    <!-- Form -->
    <Card padding={24} style="flex:2;min-width:280px">
      <div style="margin-bottom:20px">
        <div
          style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading);margin-bottom:4px"
        >
          基本資料
        </div>
        <div style="font-size:var(--df-text-sm);color:var(--df-text-light)">
          更新您的個人資訊
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:140px">
            <Input label="姓名" bind:value={name} required />
          </div>
          <div style="flex:1;min-width:140px">
            <Input label="性別" bind:value={gender} />
          </div>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div style="flex:1;min-width:140px">
            <Input label="電子郵件" bind:value={email} type="email" required />
          </div>
          <div style="flex:1;min-width:140px">
            <Input label="手機號碼" bind:value={phone} type="tel" />
          </div>
        </div>
        <Input label="出生年月日" bind:value={birth} type="date" />
        <Input label="緊急聯絡人" bind:value={emergency} placeholder="姓名 (關係) / 電話" />
        <Textarea label="個人簡介" bind:value={bio} rows={4} maxLength={200} />

        <div style="display:flex;justify-content:flex-end;padding-top:4px">
          <Button variant="primary" size="md" disabled={saving} on:click={save}>
            <span style="display:inline-flex;align-items:center;gap:8px">
              <Icon name="save" size={16} color="#fff" />
              {saving ? '儲存中…' : '儲存變更'}
            </span>
          </Button>
        </div>
      </div>
    </Card>

    <!-- Live preview card -->
    <Card padding={24} style="flex:1;min-width:220px">
      <div
        style="font-size:var(--df-text-sm);font-weight:var(--df-weight-semibold);color:var(--df-text-light);margin-bottom:16px;text-transform:uppercase;letter-spacing:0.06em"
      >
        預覽
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center">
        <CoachAvatar size={72} online initial={coach.initial} />
        <div>
          <div
            style="font-size:var(--df-text-lg);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading)"
          >
            {name || coach.name}
          </div>
          <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
            {coach.role}
          </div>
        </div>
        <div
          style="font-size:var(--df-text-xs);color:var(--df-text-light);line-height:1.6;padding:0 8px"
        >
          {bio || '尚無簡介'}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;width:100%;text-align:left;padding-top:8px;border-top:1px solid var(--df-border)">
          <div style="display:flex;align-items:center;gap:8px;font-size:var(--df-text-xs);color:var(--df-text-light)">
            <Icon name="mail" size={13} color="var(--df-text-light)" />{email || coach.email}
          </div>
          <div style="display:flex;align-items:center;gap:8px;font-size:var(--df-text-xs);color:var(--df-text-light)">
            <Icon name="phone" size={13} color="var(--df-text-light)" />{phone || coach.phone}
          </div>
        </div>
      </div>
    </Card>
  </div>

  <!-- Danger zone -->
  <Card padding={24}>
    <div
      style="display:flex;align-items:center;gap:12px;margin-bottom:16px"
    >
      <Icon name="triangle-alert" size={20} color="var(--df-error)" />
      <div
        style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-error);font-family:var(--df-font-heading)"
      >
        危險操作
      </div>
    </div>
    <div
      style="display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px;border-radius:var(--df-radius-md);border:1px solid var(--df-error-bg);background:#FFF5F5"
    >
      <div>
        <div
          style="font-size:var(--df-text-base);font-weight:var(--df-weight-semibold);color:var(--df-text-dark)"
        >
          停用帳號
        </div>
        <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-top:2px">
          停用後您的帳號將無法登入，課程資料仍會保留。
        </div>
      </div>
      <Button variant="danger" size="sm" on:click={deactivate}>
        停用帳號
      </Button>
    </div>
  </Card>
</div>
