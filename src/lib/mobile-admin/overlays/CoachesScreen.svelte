<script lang="ts">
  /* 教練管理 push screen。admin2.jsx CoachesScreen (68)。
   * $coaches 卡片（Avatar + 狀態點 + 標籤 + 4 欄統計 + 聯絡/課表）；
   * 新增 → onNew()（未提供時 overlay.sheet('coachForm',{c:null})）；
   * 編輯鉛筆 → overlay.sheet('coachForm',{c})。 */
  import PushScreen from '$lib/mobile-admin/components/PushScreen.svelte';
  import ScreenHeader from '$lib/mobile-admin/components/ScreenHeader.svelte';
  import HeaderIcon from '$lib/mobile-admin/components/HeaderIcon.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Avatar from '$lib/components/ui/Avatar.svelte';
  import Tag from '$lib/components/ui/Tag.svelte';
  import { overlay, coaches as coachesStore, toasts } from '$lib/mobile-admin/stores';
  import type { Coach } from '$lib/mobile-admin/data';

  export let onBack: () => void;
  export let onNew: (() => void) | undefined = undefined;

  const dot: Record<string, string> = {
    online: 'var(--df-success)',
    busy: 'var(--df-warning)',
    offline: 'var(--df-border-strong)'
  };

  function newCoach() {
    if (onNew) onNew();
    else overlay.sheet('coachForm', { c: null });
  }
  const stat = (c: Coach): [number, string][] => [
    [c.years, '年資'],
    [c.students, '學員'],
    [c.classes, '班級'],
    [c.awards, '獲獎']
  ];
</script>

<PushScreen>
  <ScreenHeader {onBack} title="教練管理" sub={$coachesStore.length + ' 位專任教練'}>
    <HeaderIcon slot="right" icon="user-plus" label="新增教練" onClick={newCoach} />
  </ScreenHeader>
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
      {#each $coachesStore as c (c.id)}
        <div
          style="background:#fff; border:1px solid var(--df-border); border-radius:16px;
            box-shadow:var(--df-shadow-card); overflow:hidden;"
        >
          <div style="display:flex; gap:13px; padding:15px 16px 13px;">
            <div style="position:relative; flex:none;">
              <Avatar name={c.initial} size="md" color={c.color} />
              <span
                style="position:absolute; right:-1px; bottom:-1px; width:12px; height:12px;
                  border-radius:999px; background:{dot[c.status]}; border:2px solid #fff;"
              ></span>
            </div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:15.5px; font-weight:700; color:var(--df-ink);">
                {c.name} <span style="font-size:12px; font-weight:500; color:var(--df-text-muted);">教練</span>
              </div>
              <div style="font-size:12px; color:var(--df-primary); margin-top:2px; line-height:1.4;">{c.title}</div>
              <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                {#each c.tags as t (t)}<Tag>{t}</Tag>{/each}
              </div>
            </div>
            <button
              on:click={() => overlay.sheet('coachForm', { c })}
              aria-label="編輯教練"
              class="df-tapscale"
              style="width:34px; height:34px; border-radius:10px; border:1px solid var(--df-border);
                background:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer;
                flex:none; align-self:flex-start;"
            >
              <Icon name="pencil-line" size={16} color="var(--df-text-light)" />
            </button>
          </div>
          <div style="display:grid; grid-template-columns:repeat(4,1fr); border-top:1px solid var(--df-border);">
            {#each stat(c) as [v, l], i (l)}
              <div
                style="padding:11px 0; text-align:center;
                  border-left:{i ? '1px solid var(--df-border)' : 'none'};"
              >
                <div style="font-size:18px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{v}</div>
                <div style="font-size:11px; color:var(--df-text-light); margin-top:1px;">{l}</div>
              </div>
            {/each}
          </div>
          <div style="display:flex; gap:8px; padding:12px 16px; border-top:1px solid var(--df-border);">
            <button
              on:click={() => toasts.notify('info', c.name + ' 教練', c.phone)}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border);
                background:#fff; color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer;
                display:flex; align-items:center; justify-content:center; gap:6px;"
            >
              <Icon name="phone" size={15} color="var(--df-primary)" />聯絡
            </button>
            <button
              on:click={() => toasts.notify('info', '課表', '顯示 ' + c.name + ' 教練的授課時段。')}
              class="df-tapscale"
              style="flex:1; height:38px; border-radius:10px; border:1.5px solid var(--df-border);
                background:#fff; color:var(--df-text-dark); font-size:13px; font-weight:600; cursor:pointer;
                display:flex; align-items:center; justify-content:center; gap:6px;"
            >
              <Icon name="calendar-days" size={15} color="var(--df-primary)" />課表
            </button>
          </div>
        </div>
      {/each}
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
