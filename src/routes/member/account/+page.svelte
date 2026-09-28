<script lang="ts">
  /* Dream Fly — 會員中心 · 帳戶 Account.
   * Ported from the prototype `function Account` (client/views.jsx). Profile card,
   * member-points card and the order/payment history table; editing opens the
   * ProfileEditDialog. Data + primitives come from the shared foundation. */
  import { onMount } from 'svelte';
  import { Card, Badge, Button, Avatar, Icon, EmptyState, Skeleton, SkelCard, ErrorState, LoadGate } from '$lib/components/ui';
  import { fmtNT } from '$lib/format';
  import {
    points,
    subscriptions,
    toasts,
    memberProfile,
    prefs,
    saveProfile,
    hydrateProfile,
    refreshPoints,
    refreshSubscriptions,
    type ProfileEdit
  } from '$lib/member/stores';
  import { warmStores } from '$lib/store-warm';
  import ProfileEditDialog from '$lib/member/components/ProfileEditDialog.svelte';
  import { createLoadGate } from '$lib/load-gate';
  import { getAccount, type AccountData } from '$lib/member/api';
  import type { IconName } from '$lib/icon-registry';

  let data: AccountData | null = null;
  let editing = false;
  let saving = false;

  // R15(候選 F2)：getAccount() 只回訂單資料，個人資料水合(hydrateProfile，失敗照拋——
  // $memberProfile 是本頁主資料之一)與點數/訂閱暖機由本頁自己宣告，與主 GET 同一個
  // Promise.all 並行發出(暖機是 best-effort，見 $lib/store-warm 的 warmStores 檔頭)。
  const gate = createLoadGate({
    fetch: async () => {
      const [account] = await Promise.all([
        getAccount(),
        hydrateProfile(),
        warmStores('member/account', [['點數', refreshPoints], ['訂閱', refreshSubscriptions]])
      ]);
      return account;
    },
    onData: (d) => { data = d; }
  });
  onMount(() => {
    gate.load();
  });

  $: profile = $memberProfile;
  $: contacts = profile
    ? ([['phone', profile.phone], ['mail', profile.email]] satisfies [IconName, string][]).filter(([, v]) => v)
    : [];

  // 儲存個人資料(R13 Task 3)——姓名/電話/生日/通知偏好經會員資料 module 一次寫回
  // PATCH /users/me(只送改過的欄位,不做樂觀更新)。saving 鎖防連點;失敗時 dialog
  // 不關、可重試。
  async function save(edit: ProfileEdit) {
    if (saving) return;
    saving = true;
    const outcome = await saveProfile(edit);
    saving = false;
    if (outcome.kind === 'failed') {
      toasts.notify('error', '儲存失敗', '連線發生問題，請稍後再試。');
      return;
    }
    editing = false;
    toasts.notify('success', '已儲存', '個人資料已更新。');
  }
</script>

<LoadGate {gate}>
  <div data-testid="account-skeleton" class="df-view" style="display:grid;grid-template-columns:340px 1fr;gap:18px;align-items:start" slot="loading">
    <div style="display:flex;flex-direction:column;gap:18px">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={96} r={12} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={340} r={12} /></SkelCard>
  </div>

  {#if data && profile}
  <div class="df-view" style="display:grid;grid-template-columns:340px 1fr;gap:18px;align-items:start">
    <div style="display:flex;flex-direction:column;gap:18px">
      <Card padding={24} style="text-align:center">
        <div style="display:inline-block"><Avatar name={profile.initial} size="xl" /></div>
        <div style="font-size:20px;font-weight:800;color:var(--df-ink);margin-top:12px;font-family:var(--df-font-heading)">{profile.name}</div>
        <div style="margin-top:10px"><Badge tone="primary">競技啦啦隊 進階班</Badge></div>
        <div style="border-top:1px solid var(--df-border);margin-top:16px;padding-top:14px;display:flex;flex-direction:column;gap:9px;text-align:left">
          {#each contacts as [ic, v] (ic)}
            <div style="display:flex;align-items:center;gap:9px;font-size:13px;color:var(--df-text-light)">
              <Icon name={ic} size={15} color="var(--df-text-muted)" /><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{v}</span>
            </div>
          {/each}
        </div>
        <Button variant="secondary" size="sm" fullWidth style="margin-top:16px" on:click={() => (editing = true)}>
          <Icon name="pencil-line" size={15} />編輯個人資料
        </Button>
      </Card>
      <Card padding={22}>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <Icon name="star" size={20} color="var(--df-accent-dark)" /><span style="font-size:14px;font-weight:700;color:var(--df-ink)">會員點數</span>
        </div>
        <div style="font-size:34px;font-weight:800;color:var(--df-ink);font-family:var(--df-font-heading)">{$points.toLocaleString()}</div>
        <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px">加入會員自 {profile.since} · 可折抵報名費</div>
      </Card>
      <Card padding={22}>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          <Icon name="ticket" size={20} color="var(--df-primary)" /><span style="font-size:14px;font-weight:700;color:var(--df-ink)">我的訂閱 · 使用權</span>
        </div>
        {#if $subscriptions.length === 0}
          <EmptyState icon="ticket" title="目前沒有訂閱中的方案" body="購買月票或會員卡後,使用權會顯示在這裡。" pad="16px 0" />
        {:else}
          <div style="display:flex;flex-direction:column;gap:12px">
            {#each $subscriptions as sub (sub.id)}
              <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
                <div style="min-width:0">
                  <div style="font-size:14px;font-weight:600;color:var(--df-text-dark);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{sub.name}</div>
                  <div style="font-size:12.5px;color:var(--df-text-light);margin-top:2px">開通自 {sub.since}</div>
                </div>
                <div style="font-family:var(--df-font-mono);font-size:13.5px;font-weight:700;color:var(--df-ink);white-space:nowrap">{fmtNT(sub.price)}</div>
              </div>
            {/each}
          </div>
        {/if}
      </Card>
    </div>
    <Card padding={0} style="overflow:hidden">
      <div style="padding:18px 24px;border-bottom:1px solid var(--df-border);display:flex;justify-content:space-between;align-items:center">
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--df-ink)">報名與繳費紀錄</h3>
        <Button variant="ghost" size="sm" on:click={() => toasts.notify('info', '下載收據', '繳費收據將寄送至您的信箱。')}>
          <Icon name="download" size={15} />收據
        </Button>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;min-width:480px;border-collapse:collapse">
          <thead>
            <tr style="background:var(--df-bg-light)">
              {#each ['訂單編號', '項目', '金額', '狀態', '日期'] as h, i (h)}
                <th style="text-align:{i === 2 ? 'right' : 'left'};padding:11px 24px;font-size:11.5px;font-weight:600;color:var(--df-text-light)">{h}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each data.orders as o, i (o.id)}
              <tr class="df-rowhover" style="border-bottom:{i < data.orders.length - 1 ? '1px solid var(--df-border)' : 'none'}">
                <td style="padding:14px 24px;font-family:var(--df-font-mono);font-size:13px;font-weight:600;color:var(--df-primary)">{o.id}</td>
                <td style="padding:14px 24px;font-size:13.5px;color:var(--df-text-dark)">{o.item}</td>
                <td style="padding:14px 24px;text-align:right;font-family:var(--df-font-mono);font-size:13.5px;font-weight:700;color:var(--df-text-dark)">{fmtNT(o.amount)}</td>
                <td style="padding:14px 24px"><Badge tone={o.status[0]} dot>{o.status[1]}</Badge></td>
                <td style="padding:14px 24px;font-size:12.5px;color:var(--df-text-muted);font-family:var(--df-font-mono)">{o.date}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </Card>
    <ProfileEditDialog
      open={editing}
      {profile}
      prefs={$prefs}
      {saving}
      onClose={() => (editing = false)}
      onSave={save}
    />
  </div>
  {/if}

  <div class="df-view" slot="error"><Card padding={0}><ErrorState onRetry={gate.refresh} /></Card></div>
</LoadGate>
