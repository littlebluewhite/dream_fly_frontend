<script lang="ts">
  /* 學員詳情 sheet。admin.jsx MemberSheet (162) 的行動版接線改版。
   * onEdit 由 host 傳入時用之;OverlayHost 未傳 onEdit,故 fallback 直接
   * overlay.sheet('memberForm',{m})(與 app.jsx onEdit 等價)。
   *
   * Task 20：改讀真 GET /users 形狀（MemberRow 已瘦身為 id/name/initial/phone/
   * joined/status/points）——同桌面 admin/data.ts 的 MemberAccount，MembersTable
   * 早已是「誠實、精簡」呈現，這裡鏡射同一決定，拿掉舊 mock 才有的 course/coach/
   * att/pay/remain/campus/birthday/parent/emergency/lineId/近六堂出席等欄位
   * （真後端從未提供過，繼續顯示只會是假資料）。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import StatusBadgeM from '$lib/mobile-admin/components/StatusBadgeM.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { overlay, toasts } from '$lib/mobile-admin/stores';
  import type { MemberRow } from '$lib/mobile-admin/data';

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
        ['聯絡電話', m.phone || '—', 'var(--df-font-mono)'],
        ['入會時間', m.joined],
        ['會員點數', m.points + ' 點']
      ] as [string, string, string?][])
    : [];
</script>

<Sheet open {onClose} maxHeight="92%" title="學員資料">
  {#if m}
    <div style="display:flex; flex-direction:column; gap:18px;">
      <div style="display:flex; align-items:center; gap:14px;">
        <Avatar name={m.initial} size="lg" color="var(--df-primary)" />
        <div>
          <div style="font-size:21px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{m.name}</div>
          <div style="margin-top:5px;"><StatusBadgeM s={m.status} /></div>
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
      on:click={() => m && toasts.notify('info', '聯絡學員', m.phone || '—')}
      class="df-tapscale"
      style="flex:none; width:54px; height:48px; border-radius:12px; border:1.5px solid var(--df-border);
        background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;"
      aria-label="聯絡學員"
    >
      <Icon name="phone" size={19} color="var(--df-primary)" />
    </button>
    <Button variant="primary" on:click={edit} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">
      <Icon name="pencil-line" size={16} />編輯資料
    </Button>
  </svelte:fragment>
</Sheet>
