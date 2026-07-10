<script lang="ts">
  /* 系統設定 — faithful port of admin.jsx SettingsView. Three cards:
   *  · 場館資訊 — venue info field grid.
   *  · 通知與自動化 — four Switch rows. 儲存變更 → putSettings().
   *  · 帳號與安全 — 變更密碼 (opens PasswordDialog), 雙重驗證 Switch, and the
   *    登入裝置 list (monitor / smartphone / tablet icons) with 登出其他裝置.
   *
   * Task F9：GET/PUT /settings 接真(integration-contract.md §3.25)。三態載入閘門
   * (createLoadGate)取代原本的純本地假資料；欄位改為 bind:value/bind:checked 的
   * 可編輯草稿，單一「儲存變更」動作打 putSettings() 全量送出三組 key(只有一個
   * Save 動作、沒有逐卡片獨立儲存 UI，全送最簡單，不需要另外追蹤 dirty 狀態，見
   * admin/api.ts SettingsWriteBody 附註)。切換 Switch 只更新本地草稿、不再各自
   * 即時 toast(接真前每次切換就跳「已開啟/已關閉」暗示已即時持久化；接真後這句話
   * 會變成謊言——真正持久化只發生在按下「儲存變更」的那一刻)。
   *
   * 「登入裝置清單」不在本任務範圍(契約 §3.25 開頭：需 session 管理，另案處理)，
   * 維持現狀——LOGINS 仍是純本地 mock，最小 diff。 */
  import { onMount } from 'svelte';
  import { Card, Input, Select, Switch, Button, Badge, Icon, LoadGate, Skeleton, SkelCard } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import SettingsRow from '$lib/admin/components/SettingsRow.svelte';
  import PasswordDialog from '$lib/admin/components/PasswordDialog.svelte';
  import { toasts } from '$lib/admin/stores';
  import { createLoadGate } from '$lib/load-gate';
  import { getSettings, putSettings, type SettingsWriteBody } from '$lib/admin/api';
  import { ApiError } from '$lib/api/client';

  let name = '';
  let phone = '';
  let address = '';
  let defaultRatio = '1:6';
  let maxClassSizeLabel = '12 人'; // Select 顯示字串；save() 時轉回數字，見 labelToMaxClassSize
  let email = true;
  let sms = false;
  let lowAtt = true;
  let autoWait = true;
  let twoFA = true;
  let pwOpen = false;
  let saving = false;

  const MAX_CLASS_SIZE_OPTIONS = ['8 人', '10 人', '12 人'];
  const DEFAULT_MAX_CLASS_SIZE = 12;
  const maxClassSizeToLabel = (n: number) => `${n} 人`;
  const labelToMaxClassSize = (label: string) => parseInt(label, 10) || DEFAULT_MAX_CLASS_SIZE;

  const gate = createLoadGate({
    fetch: getSettings,
    onData: (d) => {
      name = d.studioProfile.name;
      phone = d.studioProfile.phone;
      address = d.studioProfile.address;
      defaultRatio = d.studioProfile.defaultRatio;
      maxClassSizeLabel = maxClassSizeToLabel(d.studioProfile.maxClassSize);
      email = d.notificationFlags.email;
      sms = d.notificationFlags.sms;
      lowAtt = d.notificationFlags.lowAtt;
      autoWait = d.notificationFlags.autoWait;
      twoFA = d.security.twoFA;
    }
  });
  onMount(() => {
    gate.load();
  });

  function settingsErrorMessage(e: unknown): string {
    if (e instanceof ApiError && e.status === 403) return '沒有權限執行此操作。';
    return '連線發生問題，請稍後再試。';
  }

  async function save() {
    if (saving) return;
    saving = true;
    const body: SettingsWriteBody = {
      studio_profile: {
        name,
        phone,
        address,
        default_ratio: defaultRatio,
        max_class_size: labelToMaxClassSize(maxClassSizeLabel)
      },
      notification_flags: { email, sms, lowAtt, autoWait },
      security: { twoFA }
    };
    try {
      await putSettings(body);
    } catch (e) {
      toasts.notify('error', '儲存失敗', settingsErrorMessage(e));
      saving = false;
      return;
    }
    toasts.notify('success', '已儲存', '系統設定已更新。');
    await gate.silentRefresh();
    saving = false;
  }

  const LOGINS = [
    { icon: 'monitor', device: 'MacBook · Chrome', place: '台中 · 辦公室', time: '目前使用中', now: true },
    {
      icon: 'smartphone',
      device: 'iPhone · Dream Fly App',
      place: '台中 · 行動網路',
      time: '今天 08:14',
      now: false
    },
    { icon: 'tablet', device: 'iPad · Safari', place: '台中 · 場館 Wi-Fi', time: '昨天 19:32', now: false }
  ];
</script>

<LoadGate {gate}>
  <div style="display:flex;flex-direction:column;gap:20px;max-width:760px" data-testid="settings-skeleton" slot="loading">
    <Skeleton w={160} h={32} r={8} />
    <SkelCard><Skeleton w="100%" h={180} r={12} /></SkelCard>
    <SkelCard><Skeleton w="100%" h={220} r={12} /></SkelCard>
    <SkelCard><Skeleton w="100%" h={260} r={12} /></SkelCard>
  </div>

  <div class="df-view" style="display:flex;flex-direction:column;gap:20px;max-width:760px">
    <PageHead title="系統設定" sub="場館資訊、通知與權限" />

    <!-- 場館資訊 -->
    <Card padding={24}>
      <h3 class="sec-title">場館資訊</h3>
      <p class="sec-sub">顯示於官網與報名通知</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <Input label="場館名稱" bind:value={name} />
        <Input label="聯絡電話" bind:value={phone} />
        <Input label="地址" bind:value={address} style="grid-column:span 2" />
        <Select label="預設師生比" bind:value={defaultRatio} options={['1:4', '1:6', '1:8']} />
        <Select label="每班人數上限" bind:value={maxClassSizeLabel} options={MAX_CLASS_SIZE_OPTIONS} />
      </div>
    </Card>

    <!-- 通知與自動化 -->
    <Card padding={24}>
      <h3 class="sec-title" style="margin-bottom:12px">通知與自動化</h3>
      <SettingsRow label="Email 通知" desc="報名、繳費與請假以 Email 通知家長">
        <Switch bind:checked={email} />
      </SettingsRow>
      <SettingsRow label="簡訊提醒" desc="課前一日發送簡訊提醒（需加購點數）">
        <Switch bind:checked={sms} />
      </SettingsRow>
      <SettingsRow label="出席偏低警示" desc="學員出席率低於 75% 時通知管理員">
        <Switch bind:checked={lowAtt} />
      </SettingsRow>
      <SettingsRow label="自動候補遞補" desc="額滿班級有人退出時自動通知候補學員">
        <Switch bind:checked={autoWait} />
      </SettingsRow>
      <div style="display:flex;justify-content:flex-end;margin-top:18px">
        <Button variant="primary" disabled={saving} on:click={save}>
          <Icon name="check" size={16} />
          儲存變更
        </Button>
      </div>
    </Card>

    <!-- 帳號與安全 -->
    <Card padding={24}>
      <h3 class="sec-title" style="margin-bottom:12px">帳號與安全</h3>
      <SettingsRow label="變更密碼" desc="上次更新於 2026/03/12">
        <Button variant="secondary" size="sm" on:click={() => (pwOpen = true)}>變更密碼</Button>
      </SettingsRow>
      <SettingsRow
        label="雙重驗證（2FA）"
        desc={twoFA ? '已啟用 · 登入時需輸入動態驗證碼' : '建議啟用以提升帳號安全'}
      >
        <Switch bind:checked={twoFA} />
      </SettingsRow>

      <div style="margin-top:18px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-size:13.5px;font-weight:600;color:var(--df-text-dark)">登入裝置</div>
          <button
            type="button"
            class="signout"
            on:click={() =>
              toasts.notify('warning', '已登出其他裝置', '除目前裝置外，所有工作階段已結束。')}
          >
            <Icon name="log-out" size={14} color="var(--df-error)" />
            登出其他裝置
          </button>
        </div>
        {#each LOGINS as l, i}
          <div
            class="device"
            style={i < LOGINS.length - 1 ? 'border-bottom:1px solid var(--df-border)' : ''}
          >
            <div class="device-icon"><Icon name={l.icon} size={17} color="var(--df-text-light)" /></div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:600;color:var(--df-text-dark)">{l.device}</div>
              <div style="font-size:12px;color:var(--df-text-light);margin-top:1px">{l.place}</div>
            </div>
            {#if l.now}
              <Badge tone="success" dot>{l.time}</Badge>
            {:else}
              <span style="font-size:12.5px;color:var(--df-text-muted);font-family:var(--df-font-mono)"
                >{l.time}</span
              >
            {/if}
          </div>
        {/each}
      </div>
    </Card>
  </div>

  <PasswordDialog open={pwOpen} onClose={() => (pwOpen = false)} onSave={() => (pwOpen = false)} />
</LoadGate>

<style>
  .sec-title {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .sec-sub {
    margin: 0 0 16px;
    font-size: 13px;
    color: var(--df-text-light);
  }
  .signout {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--df-border);
    background: #fff;
    border-radius: 8px;
    padding: 6px 11px;
    font-size: 12.5px;
    font-weight: 600;
    color: var(--df-error);
    cursor: pointer;
    font-family: var(--df-font-body);
  }
  .device {
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 12px 0;
  }
  .device-icon {
    width: 36px;
    height: 36px;
    border-radius: 9px;
    background: var(--df-bg-light);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
</style>
