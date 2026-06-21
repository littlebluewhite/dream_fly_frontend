<script lang="ts">
  /* 預約補課 sheet。mobile/mine.jsx MakeupSheet (253-290)。
   * MAKEUP_SLOTS 清單（spots 0 → 額滿 disabled）→ toast + 切成功畫面。 */
  import Sheet from '$lib/mobile/components/Sheet.svelte';
  import SuccessBody from '$lib/components/mobile/SuccessBody.svelte';
  import MEmpty from '$lib/components/mobile/MEmpty.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import { toasts } from '$lib/mobile/stores';
  import { MAKEUP_SLOTS, type MyCourse } from '$lib/mobile/data';

  export let onClose: () => void;
  export let course: MyCourse | null = null;

  let pick = '';
  let isDone = false;

  $: chosen = MAKEUP_SLOTS.find((s) => s.id === pick);
  $: anyOpen = MAKEUP_SLOTS.some((s) => s.spots > 0);

  function confirm() {
    if (!chosen) return;
    isDone = true;
    toasts.notify('success', '補課已預約', chosen.date + ' ' + chosen.time);
  }
</script>

{#if course}
  {#if isDone}
    <Sheet open {onClose} title="預約補課" sub={course.name}>
      <SuccessBody
        icon="calendar-check"
        title="補課預約成功"
        body={chosen ? `已預約 ${chosen.date} ${chosen.time} · ${chosen.room}，已加入你的日程表。` : ''}
      />
      <svelte:fragment slot="footer">
        <Button variant="primary" fullWidth on:click={onClose}>完成</Button>
      </svelte:fragment>
    </Sheet>
  {:else}
    <Sheet open {onClose} title="預約補課" sub={course.name + ' · 選擇可補課時段'} maxHeight="88%">
      {#if !anyOpen}
        <MEmpty icon="calendar-x" title="目前沒有可預約的補課時段" body="新時段開放時將以通知提醒你，也可聯絡櫃台協助安排。" />
      {:else}
        <div style="display:flex; flex-direction:column; gap:10px;">
          {#each MAKEUP_SLOTS as s (s.id)}
            {@const full = s.spots === 0}
            {@const on = pick === s.id}
            <button
              disabled={full}
              on:click={() => (pick = s.id)}
              style="text-align:left; display:flex; align-items:center; gap:12px; padding:13px 14px; border-radius:13px; cursor:{full ? 'not-allowed' : 'pointer'}; width:100%; background:{on ? 'var(--df-primary-bg)' : '#fff'}; border:1.5px solid {on ? 'var(--df-primary)' : 'var(--df-border)'}; opacity:{full ? 0.55 : 1};"
            >
              <div style="width:22px; height:22px; border-radius:50%; border:2px solid {on ? 'var(--df-primary)' : 'var(--df-border-strong)'}; display:flex; align-items:center; justify-content:center; flex:none;">
                {#if on}<div style="width:11px; height:11px; border-radius:50%; background:var(--df-primary);"></div>{/if}
              </div>
              <div style="flex:1;">
                <div style="font-size:14px; font-weight:700; color:var(--df-ink);">{s.date} · {s.time}</div>
                <div style="font-size:12.5px; color:var(--df-text-light); margin-top:2px;">{s.room} · {s.coach} 教練</div>
              </div>
              {#if full}
                <Badge tone="error">已額滿</Badge>
              {:else}
                <Badge tone={s.spots <= 1 ? 'warning' : 'success'} dot>剩 {s.spots} 位</Badge>
              {/if}
            </button>
          {/each}
        </div>
      {/if}
      <svelte:fragment slot="footer">
        <Button variant="secondary" on:click={onClose}>取消</Button>
        <Button variant="primary" disabled={!pick} style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px;" on:click={confirm}>
          <Icon name="calendar-check" size={16} />確認預約
        </Button>
      </svelte:fragment>
    </Sheet>
  {/if}
{/if}
