<script lang="ts">
  /* 編輯個人資料 sheet。mobile/profile.jsx EditProfileSheet (20-70)。
   * 編輯姓名/生日/電話 + 通知偏好 → 一次 saveProfile(PATCH /users/me)→ toast + close。
   * 編輯的是本地副本 f / p，按儲存才送出（取消不影響）。
   *
   * R13 Task 3(C1):改走 member 側唯一的會員資料 module($lib/member/profile;
   * 原 $lib/mobile/pref-sync 退役)。Task 7(架構深化 R15·F-4)起直取該模組，不再
   * 經 $lib/mobile/stores 轉手。
   *  - 開啟時先 await hydrateProfile(),落地後才用真值建立 f/p(水合前 Switch 與「儲存
   *    資料」一律 disabled——不讓使用者在那個窗口編輯,避免落地後把剛切的那一下悄悄蓋掉)。
   *  - 存檔只呼叫一次 saveProfile:module 自己比對、只送改過的欄位,沒改就不發請求;
   *    表單規則(姓名 2–100、電話 8–20、原本有電話不能清空)用同一份 profileEditError。
   *  - busy 鎖:儲存飛行中「儲存資料」停用、save() 再擋一次(合成 click 不受 disabled 限制)
   *    ——關掉 ADR-0022 遞延的防連點項。失敗時 sheet 不關、可重試。
   *  - 後端沒有的會員編號、家長聯絡人、大頭照底色拿掉(D2);email 只讀。 */
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import { toasts } from '$lib/mobile/stores';
  import { memberProfile, prefs, hydrateProfile, saveProfile, profileEditError, type Prefs } from '$lib/member/profile';
  import type { IconName } from '$lib/icon-registry';
  import { initialOf } from '$lib/api/wire';

  export let onClose: () => void;

  // local editable copies — (re)built from the module once hydrateProfile() resolves.
  let f = { name: '', phone: '', birth: '', email: '' };
  let p: Prefs = { ...get(prefs) };
  let hydrating = true;
  let busy = false;

  onMount(async () => {
    try {
      await hydrateProfile();
    } catch (err) {
      console.error('EditProfileSheet: 會員資料載入失敗', err);
      toasts.notify('error', '載入失敗', '連線發生問題，請稍後再試。');
      onClose();
      return;
    }
    const cur = get(memberProfile);
    if (cur) f = { name: cur.name, phone: cur.phone, birth: cur.birth, email: cur.email };
    p = { ...get(prefs) };
    hydrating = false;
  });

  $: error = hydrating ? null : profileEditError({ name: f.name, phone: f.phone }, $memberProfile);

  async function save() {
    // 雙重保險：Button 的 disabled 擋不掉合成 click，這裡再擋一次。
    if (hydrating || busy || error) return;
    busy = true;
    const outcome = await saveProfile({ name: f.name, phone: f.phone, birth: f.birth, prefs: p });
    busy = false;
    if (outcome.kind === 'failed') {
      toasts.notify('error', '儲存失敗', '連線發生問題，請稍後再試。');
      return;
    }
    toasts.notify('success', '資料已更新', f.name.trim());
    onClose();
  }

  const PREF_ROWS: { icon: IconName; label: string; sub: string; k: keyof Prefs }[] = [
    { icon: 'calendar-clock', label: '課前提醒', sub: '課程開始前一日推播', k: 'classReminder' },
    { icon: 'message-circle', label: '教練訊息', sub: '教練回覆即時通知', k: 'coachMsg' },
    { icon: 'megaphone', label: '活動與優惠', sub: '新課程與優惠資訊', k: 'promo' }
  ];
</script>

<Sheet open {onClose} maxHeight="93%" title="編輯個人資料">
  <div style="display:flex; flex-direction:column; gap:20px;">
    <!-- avatar -->
    <div style="display:flex; flex-direction:column; align-items:center;">
      <span style="width:80px; height:80px; border-radius:50%; background:var(--df-primary); color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:34px; font-weight:800; font-family:var(--df-font-body); line-height:1; user-select:none;">{initialOf(f.name, $memberProfile?.initial ?? '')}</span>
    </div>
    <!-- editable fields -->
    <div style="display:flex; flex-direction:column; gap:13px;">
      <Input label="學員姓名" bind:value={f.name} disabled={hydrating} />
      <div style="display:flex; gap:12px;">
        <Input label="生日" type="date" bind:value={f.birth} disabled={hydrating} style="flex:1;" />
        <Input label="聯絡電話" bind:value={f.phone} disabled={hydrating} style="flex:1;" />
      </div>
      <Input label="Email" type="email" value={f.email} disabled helper="Email 無法在此變更" />
      {#if error}<div role="alert" style="font-size:12.5px; color:var(--df-error);">{error}</div>{/if}
    </div>
    <!-- notification preferences -->
    <div>
      <div style="font-size:12px; font-weight:700; color:var(--df-text-muted); letter-spacing:0.5px; margin:0 2px 8px;">通知偏好</div>
      <div style="background:var(--df-bg-light); border-radius:13px; overflow:hidden;">
        {#each PREF_ROWS as row, i}
          <div style="display:flex; align-items:center; gap:12px; padding:12px 14px; {i < PREF_ROWS.length - 1 ? 'border-bottom:1px solid var(--df-border);' : ''}">
            <Icon name={row.icon} size={18} color="var(--df-text-muted)" />
            <div style="flex:1; min-width:0;">
              <div style="font-size:14px; color:var(--df-text-dark);">{row.label}</div>
              <div style="font-size:11.5px; color:var(--df-text-muted); margin-top:1px;">{row.sub}</div>
            </div>
            <Switch checked={p[row.k]} disabled={hydrating} on:change={(e) => (p = { ...p, [row.k]: e.detail })} />
          </div>
        {/each}
      </div>
    </div>
  </div>
  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={onClose}>取消</Button>
    <Button variant="primary" disabled={hydrating || busy || !!error} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;" on:click={save}>
      <Icon name="check" size={16} />儲存資料
    </Button>
  </svelte:fragment>
</Sheet>
