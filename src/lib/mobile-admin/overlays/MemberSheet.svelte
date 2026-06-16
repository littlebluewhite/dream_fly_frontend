<script lang="ts">
  /* 學員詳情 sheet。admin.jsx MemberSheet (162)。
   * onEdit 由 host 傳入時用之;OverlayHost 未傳 onEdit,故 fallback 直接
   * overlay.sheet('memberForm',{m})(與 app.jsx onEdit 等價)。 */
  import Sheet from '$lib/mobile-admin/components/Sheet.svelte';
  import StatusBadgeM from '$lib/mobile-admin/components/StatusBadgeM.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { overlay, toasts } from '$lib/mobile-admin/stores';
  import { PAY_STATUS, ATT_MARK, type MemberRow } from '$lib/mobile-admin/data';

  export let onClose: () => void;
  export let m: MemberRow | null = null;
  export let onEdit: ((m: MemberRow) => void) | undefined = undefined;

  function edit() {
    if (!m) return;
    if (onEdit) onEdit(m);
    else overlay.sheet('memberForm', { m });
  }

  $: rows = m
    ? ([
        ['會員編號', m.id, 'var(--df-font-mono)'],
        ['年齡', m.age + ' 歲'],
        ['所屬分校', m.campus],
        ['會員分級', m.tier],
        ['報名課程', m.course],
        ['授課教練', m.coach + ' 教練'],
        ['繳費狀態', (PAY_STATUS[m.pay] || ['', '-'])[1]],
        ['剩餘堂數', m.remain + ' 堂'],
        ['續費到期', m.renewDue],
        ['最近出席', m.lastSeen, 'var(--df-font-mono)'],
        ['報名來源', m.source],
        ['生日', m.birthday],
        ['家長', m.parent],
        ['聯絡電話', m.phone, 'var(--df-font-mono)'],
        ['LINE', m.lineId, 'var(--df-font-mono)'],
        ['緊急聯絡人', m.emName + ' · ' + m.emPhone],
        ['入會時間', m.joined],
        ['會員點數', m.points + ' 點']
      ] as [string, string, string?][])
    : [];
</script>

<Sheet open {onClose} maxHeight="92%" title="學員資料">
  {#if m}
    <div style="display:flex; flex-direction:column; gap:18px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <Avatar name={m.initial} size="lg" color={m.color} />
        <div>
          <div style="font-size:21px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{m.name}</div>
          <div style="margin-top:5px;"><StatusBadgeM s={m.status} /></div>
        </div>
      </div>

      <div style="background:var(--df-bg-light); border-radius:13px; padding:13px 15px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:7px;">
          <span style="color:var(--df-text-light);">本月出席率</span>
          <span style="font-weight:700; color:var(--df-text-dark);">{m.att}%</span>
        </div>
        <MiniBar value={m.att} tone={m.att >= 80 ? 'success' : 'warning'} height={7} />
      </div>

      <div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span style="font-size:12.5px; color:var(--df-text-light);">近六堂出席</span>
          <span style="font-size:11px; color:var(--df-text-muted);">出 · 缺 · 遲 · 假</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center;">
          {#each m.recent as mk, i (i)}
            {@const mark = ATT_MARK[mk] || ATT_MARK.p}
            <span
              title={mark[1]}
              style="width:22px; height:22px; border-radius:7px; background:{mark[0]}1F; color:{mark[0]};
                font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; flex:none;"
            >{mark[1]}</span>
          {/each}
        </div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:14px 16px;">
        {#each rows as [k, v, f] (k)}
          <div>
            <div style="font-size:11.5px; color:var(--df-text-muted); margin-bottom:2px;">{k}</div>
            <div style="font-size:14px; color:var(--df-text-dark); font-weight:600; font-family:{f || 'inherit'};">{v}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <button
      on:click={() => m && toasts.notify('info', '聯絡家長', m.parent + ' · ' + m.phone)}
      class="df-tapscale"
      style="flex:none; width:54px; height:48px; border-radius:12px; border:1.5px solid var(--df-border);
        background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;"
      aria-label="聯絡家長"
    >
      <Icon name="phone" size={19} color="var(--df-primary)" />
    </button>
    <Button variant="primary" on:click={edit} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">
      <Icon name="pencil-line" size={16} />編輯資料
    </Button>
  </svelte:fragment>
</Sheet>
