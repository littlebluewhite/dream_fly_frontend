<script lang="ts">
  /* Dream Fly — 會員中心 · 帳戶 Account.
   * Ported from the prototype `function Account` (client/views.jsx). Profile card,
   * member-points card and the order/payment history table; editing opens the
   * ProfileEditDialog. Data + primitives come from the shared foundation. */
  import { onMount } from 'svelte';
  import { Card, Badge, Button, Avatar, Icon, EmptyState, Skeleton, SkelCard, ErrorState } from '$lib/components/ui';
  import { fmtNT } from '$lib/member/format';
  import { points, subscriptions, toasts } from '$lib/member/stores';
  import ProfileEditDialog from '$lib/member/components/ProfileEditDialog.svelte';
  import { createLoadGate } from '$lib/load-gate';
  import { getAccount, type AccountData, type AccountProfile } from '$lib/member/api';

  let data: AccountData | null = null;
  let profile: AccountProfile | null = null;
  let editing = false;

  const gate = createLoadGate({
    fetch: getAccount,
    onData: (d) => { data = d; profile = d.profile; }
  });
  onMount(() => {
    gate.load();
  });

  $: contacts = profile ? [
    ['phone', profile.phone],
    ['mail', profile.email],
    ['users', profile.guardian]
  ] as [string, string][] : [];
</script>

{#if $gate === 'ready' && data && profile}
  <div class="df-view" style="display:grid;grid-template-columns:340px 1fr;gap:18px;align-items:start">
    <div style="display:flex;flex-direction:column;gap:18px">
      <Card padding={24} style="text-align:center">
        <div style="display:inline-block"><Avatar name={profile.initial} size="xl" color={profile.color} /></div>
        <div style="font-size:20px;font-weight:800;color:var(--df-ink);margin-top:12px;font-family:var(--df-font-heading)">{profile.name}</div>
        <div style="font-size:13px;color:var(--df-text-light);margin-top:3px;font-family:var(--df-font-mono)">{profile.id}</div>
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
      onClose={() => (editing = false)}
      onSave={(fn) => {
        profile = fn;
        editing = false;
        toasts.notify('success', '已儲存', '個人資料已更新。');
      }}
    />
  </div>
{:else if $gate === 'error'}
  <div class="df-view"><Card padding={0}><ErrorState onRetry={gate.refresh} /></Card></div>
{:else}
  <div data-testid="account-skeleton" class="df-view" style="display:grid;grid-template-columns:340px 1fr;gap:18px;align-items:start">
    <div style="display:flex;flex-direction:column;gap:18px">
      {#each [0, 1, 2] as i (i)}
        <SkelCard><Skeleton w="100%" h={96} r={12} /></SkelCard>
      {/each}
    </div>
    <SkelCard><Skeleton w="100%" h={340} r={12} /></SkelCard>
  </div>
{/if}
