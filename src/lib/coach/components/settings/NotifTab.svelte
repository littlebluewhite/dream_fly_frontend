<script lang="ts">
  /* 通知設定 tab — 6 CoachSettingRow with Switch */
  import { toasts } from '$lib/coach/stores';
  import Card from '$lib/components/ui/Card.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import CoachSettingRow from '$lib/coach/components/CoachSettingRow.svelte';

  let notifClass  = true;   // 課程提醒
  let notifAttend = true;   // 點名提醒
  let notifParent = true;   // 家長訊息
  let notifSystem = false;  // 系統公告
  let notifReview = true;   // 評核到期
  let notifReport = false;  // 週報

  function toggle(name: string, val: boolean) {
    toasts.notify('info', val ? `已開啟${name}` : `已關閉${name}`);
  }
</script>

<div style="padding-top:20px">
  <Card padding={24}>
    <div
      style="font-size:var(--df-text-base);font-weight:var(--df-weight-bold);color:var(--df-text-dark);font-family:var(--df-font-heading);margin-bottom:6px"
    >
      通知設定
    </div>
    <div style="font-size:var(--df-text-sm);color:var(--df-text-light);margin-bottom:8px">
      選擇您希望接收的通知類型
    </div>

    <CoachSettingRow
      icon="calendar-clock"
      title="課程提醒"
      desc="課程開始前 30 分鐘推播提醒"
    >
      <Switch
        bind:checked={notifClass}
        on:change={(e) => toggle('課程提醒', e.detail)}
      />
    </CoachSettingRow>

    <CoachSettingRow
      icon="clipboard-check"
      title="點名提醒"
      desc="課程開始後尚未完成點名時通知"
    >
      <Switch
        bind:checked={notifAttend}
        on:change={(e) => toggle('點名提醒', e.detail)}
      />
    </CoachSettingRow>

    <CoachSettingRow
      icon="message-circle"
      title="家長訊息"
      desc="收到家長傳送訊息時即時通知"
    >
      <Switch
        bind:checked={notifParent}
        on:change={(e) => toggle('家長訊息', e.detail)}
      />
    </CoachSettingRow>

    <CoachSettingRow
      icon="bell"
      title="系統公告"
      desc="Dream Fly 系統更新與重要公告"
    >
      <Switch
        bind:checked={notifSystem}
        on:change={(e) => toggle('系統公告', e.detail)}
      />
    </CoachSettingRow>

    <CoachSettingRow
      icon="award"
      title="評核到期提醒"
      desc="學員技能評量到期 7 天前通知"
    >
      <Switch
        bind:checked={notifReview}
        on:change={(e) => toggle('評核到期提醒', e.detail)}
      />
    </CoachSettingRow>

    <CoachSettingRow
      icon="bar-chart-3"
      title="每週報告"
      desc="每週一早上 08:00 寄送教學摘要報告"
    >
      <Switch
        bind:checked={notifReport}
        on:change={(e) => toggle('每週報告', e.detail)}
      />
    </CoachSettingRow>
  </Card>
</div>
