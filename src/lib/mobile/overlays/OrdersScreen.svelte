<script lang="ts">
  /* 我的訂單 push screen。account.jsx OrdersScreen (179)。
   * ScreenHeader（自帶返回）→ ORDERS 清單，狀態 Badge（status[0] tone / status[1] 標籤）。
   * Legacy Svelte（無 runes）。 */
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { ORDERS, fmtNT } from '$lib/mobile/data';
  import type { ComponentProps } from 'svelte';

  export let onBack: () => void;

  type BadgeTone = ComponentProps<Badge>['tone'];
</script>

<PushScreen>
  <ScreenHeader {onBack} title="我的訂單" sub={ORDERS.length + ' 筆報名紀錄'} />
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
      {#each ORDERS as o (o.id)}
        <div style="background:#fff; border:1px solid var(--df-border); border-radius:14px; padding:15px; box-shadow:var(--df-shadow-card);">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
            <span style="font-size:12.5px; color:var(--df-text-muted); font-family:var(--df-font-mono);">{o.id}</span>
            <Badge tone={o.status[0] as BadgeTone} dot>{o.status[1]}</Badge>
          </div>
          <div style="font-size:14.5px; font-weight:600; color:var(--df-ink); margin-bottom:10px;">{o.item}</div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding-top:11px; border-top:1px solid var(--df-border);">
            <span style="font-size:12px; color:var(--df-text-light); display:flex; align-items:center; gap:5px;"><Icon name="calendar" size={13} color="var(--df-text-muted)" />{o.date}</span>
            <span style="font-size:16px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{fmtNT(o.amount)}</span>
          </div>
        </div>
      {/each}
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
