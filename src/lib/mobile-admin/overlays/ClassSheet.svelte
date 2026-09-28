<script lang="ts">
  /* 班級詳情 sheet。admin.jsx ClassSheet (252)。
   * onEdit 必填,由開 sheet 的呼叫端帶入(classes 頁帶 openEdit,內含 onSave)——舊的
   * overlay.sheet('classForm',{k}) fallback 沒帶 onSave,編輯後送出即無聲丟失,已刪。 */
  import Sheet from '$lib/components/mobile/Sheet.svelte';
  import LevelBadge from '$lib/mobile-admin/components/LevelBadge.svelte';
  import MiniBar from '$lib/mobile-admin/components/MiniBar.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { STATUS_TONE } from '$lib/mobile-admin/data';
  import type { ClassRow } from '$lib/admin/data';
  import { classFill, classDetailRows } from '$lib/domain/class-detail';

  export let onClose: () => void;
  export let k: ClassRow | null = null;
  export let onEdit: (k: ClassRow) => void;

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

  function edit() {
    if (!k) return;
    onEdit(k);
  }

  // null 保真:k 為 null(sheet 未開)時給 { full: false, pct: 0 } 預設值——不可讓
  // classFill(0, 0) 的 full=true 洩入未開態。
  $: fill = k ? classFill(k.enrolled, k.cap) : { full: false, pct: 0 };
  $: full = fill.full;
  $: pct = fill.pct;
  $: rows = k ? classDetailRows(k) : [];
</script>

<Sheet open {onClose} maxHeight="92%" title="課程資料" sub={k ? '班級編號 ' + k.id : ''}>
  {#if k}
    <div style="display:flex; flex-direction:column; gap:18px;">
      <div>
        <div style="display:flex; align-items:center; gap:7px; margin-bottom:7px;">
          <LevelBadge level={k.level} />
          <Badge tone={(STATUS_TONE[k.status] || 'neutral') as Tone} solid={k.status === '額滿'}>{k.status}</Badge>
        </div>
        <h2 style="margin:0; font-family:var(--df-font-heading); font-size:22px; font-weight:800; color:var(--df-ink);">{k.name}</h2>
      </div>

      <div style="background:var(--df-bg-light); border-radius:13px; padding:13px 15px;">
        <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:7px;">
          <span style="color:var(--df-text-light);">報名人數</span>
          <span style="font-weight:700; color:{full ? 'var(--df-warning)' : 'var(--df-text-dark)'};">{k.enrolled} / {k.cap} 人</span>
        </div>
        <MiniBar value={pct} tone={full ? 'warning' : 'primary'} height={7} />
      </div>

      <div style="background:var(--df-bg-light); border-radius:14px; padding:4px 14px;">
        {#each rows as [ic, kk, v], i (kk)}
          <div
            style="display:flex; align-items:center; gap:11px; padding:11px 0;
              border-top:{i ? '1px solid var(--df-border)' : 'none'};"
          >
            <Icon name={ic} size={17} color="var(--df-primary)" />
            <span style="font-size:13px; color:var(--df-text-light); width:84px; flex:none;">{kk}</span>
            <span style="font-size:14px; font-weight:600; color:var(--df-text-dark); text-align:right; flex:1;">{v}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <svelte:fragment slot="footer">
    <button
      on:click={() => k && toasts.notify('info', k.name, '顯示班級學員名單(' + k.enrolled + ' 人)。')}
      class="df-tapscale"
      style="flex:none; width:54px; height:48px; border-radius:12px; border:1.5px solid var(--df-border);
        background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;"
      aria-label="班級學員"
    >
      <Icon name="users" size={19} color="var(--df-primary)" />
    </button>
    <Button variant="primary" on:click={edit} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;">
      <Icon name="pencil-line" size={16} />編輯課程
    </Button>
  </svelte:fragment>
</Sheet>
