<script lang="ts">
  /* 編輯個人資料 sheet。mobile/profile.jsx EditProfileSheet (20-70)。
   * 編輯 profile 欄位 + prefs 通知偏好 → 寫回 stores + toast + close。
   * 編輯的是本地副本 f / p，按儲存才 commit 到 store（取消不影響）。 */
  import Sheet from '$lib/mobile/components/Sheet.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Input from '$lib/components/ui/Input.svelte';
  import Switch from '$lib/components/ui/Switch.svelte';
  import { get } from 'svelte/store';
  import { profile, prefs, toasts, type Prefs } from '$lib/mobile/stores';

  export let onClose: () => void;

  const AVATAR_COLORS = ['#0066CC', '#0EA5E9', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

  // local editable copies — committed to the stores only on save
  let f = { ...get(profile) };
  let p: Prefs = { ...get(prefs) };

  $: valid = (f.name || '').trim().length > 0;

  function onName(e: Event) {
    const v = (e.target as HTMLInputElement).value;
    f = { ...f, name: v, initial: v.trim().charAt(0) || f.initial };
  }

  function save() {
    profile.set(f);
    prefs.set(p);
    toasts.notify('success', '資料已更新', f.name);
    onClose();
  }

  const PREF_ROWS: { icon: string; label: string; sub: string; k: keyof Prefs }[] = [
    { icon: 'calendar-clock', label: '課前提醒', sub: '課程開始前一日推播', k: 'classReminder' },
    { icon: 'message-circle', label: '教練訊息', sub: '教練回覆即時通知', k: 'coachMsg' },
    { icon: 'megaphone', label: '活動與優惠', sub: '新課程與優惠資訊', k: 'promo' }
  ];
</script>

<Sheet open {onClose} maxHeight="93%" title="編輯個人資料" sub={'會員編號 ' + f.id}>
  <div style="display:flex; flex-direction:column; gap:20px;">
    <!-- avatar + 大頭照底色 -->
    <div style="display:flex; flex-direction:column; align-items:center; gap:13px;">
      <span style="width:80px; height:80px; border-radius:50%; background:{f.color}; color:#fff; display:inline-flex; align-items:center; justify-content:center; font-size:34px; font-weight:800; font-family:var(--df-font-body); line-height:1; user-select:none;">{f.initial}</span>
      <div>
        <div style="font-size:12px; color:var(--df-text-muted); text-align:center; margin-bottom:9px;">大頭照底色</div>
        <div style="display:flex; gap:11px; justify-content:center;">
          {#each AVATAR_COLORS as c}
            {@const on = f.color === c}
            <button
              type="button"
              on:click={() => (f = { ...f, color: c })}
              aria-label={'選擇底色 ' + c}
              class="df-tapscale"
              style="width:32px; height:32px; border-radius:999px; background:{c}; border:{on ? '3px solid var(--df-ink)' : '2px solid #fff'}; box-shadow:0 0 0 1px var(--df-border); cursor:pointer; flex:none;"
            ></button>
          {/each}
        </div>
      </div>
    </div>
    <!-- editable fields -->
    <div style="display:flex; flex-direction:column; gap:13px;">
      <Input label="學員姓名" value={f.name} on:input={onName} />
      <div style="display:flex; gap:12px;">
        <Input label="生日" bind:value={f.birth} style="flex:1;" />
        <Input label="聯絡電話" bind:value={f.phone} style="flex:1;" />
      </div>
      <Input label="Email" type="email" bind:value={f.email} />
      <Input label="家長 / 緊急聯絡人" bind:value={f.guardian} />
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
            <Switch checked={p[row.k]} on:change={(e) => (p = { ...p, [row.k]: e.detail })} />
          </div>
        {/each}
      </div>
    </div>
  </div>
  <svelte:fragment slot="footer">
    <Button variant="secondary" on:click={onClose}>取消</Button>
    <Button variant="primary" disabled={!valid} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;" on:click={save}>
      <Icon name="check" size={16} />儲存資料
    </Button>
  </svelte:fragment>
</Sheet>
