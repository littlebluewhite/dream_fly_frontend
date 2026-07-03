<script lang="ts">
  /* 預約補課 (Makeup booking) — radio list of open makeup slots; confirming
   * shows a success confirmation. Ported from the prototype's MakeupDialog
   * (client/components.jsx). */
  import { Button, Badge, Icon, EmptyState } from '$lib/components/ui';
  import FormModal from './FormModal.svelte';
  import SuccessBody from './SuccessBody.svelte';
  import { MAKEUP_SLOTS, type EnrolledCourse, type MakeupSlot } from '$lib/member/data';

  export let open = false;
  export let course: EnrolledCourse | null = null;
  export let onClose: () => void = () => {};
  export let onSubmit: ((slot: MakeupSlot | undefined) => void) | undefined = undefined;

  let pick = '';
  let done = false;

  // Reset state each time the dialog transitions to open.
  let wasOpen = false;
  $: if (open && !wasOpen) {
    pick = '';
    done = false;
  }
  $: wasOpen = open;

  const slots = MAKEUP_SLOTS;
  $: chosen = slots.find((s) => s.id === pick);
  $: anyOpen = slots.some((s) => s.spots > 0);

  function confirm() {
    done = true;
    onSubmit?.(chosen);
  }
</script>

{#if open && course}
  {#if done}
    <FormModal open {onClose} icon="rotate-cw" title="預約補課" subtitle={course.name}>
      <SuccessBody
        title="補課預約成功"
        body={chosen ? `已預約 ${chosen.date} ${chosen.time} · ${chosen.room}，已加入你的日程表。` : ''}
      />
      <svelte:fragment slot="footer">
        <Button variant="primary" on:click={onClose}>完成</Button>
      </svelte:fragment>
    </FormModal>
  {:else}
    <FormModal
      open
      {onClose}
      icon="rotate-cw"
      title="預約補課"
      subtitle={course.name + ' · 選擇一個可補課時段'}
    >
      {#if !anyOpen}
        <EmptyState
          icon="calendar-x"
          title="目前沒有可預約的補課時段"
          body="新的補課時段開放時，我們會以通知提醒你，也可聯絡櫃台協助安排。"
          pad="32px 12px"
        />
      {:else}
        <div class="slots">
          {#each slots as s (s.id)}
            {@const full = s.spots === 0}
            {@const on = pick === s.id}
            <button
              type="button"
              class="slot"
              class:on
              disabled={full}
              style="opacity:{full ? 0.55 : 1};cursor:{full ? 'not-allowed' : 'pointer'}"
              on:click={() => (pick = s.id)}
            >
              <span class="radio" class:on>{#if on}<span class="dot"></span>{/if}</span>
              <div class="meta">
                <div class="slot-title">{s.date} · {s.time}</div>
                <div class="slot-sub">{s.room} · {s.coach} 教練</div>
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
        <Button variant="primary" disabled={!pick} on:click={confirm}>
          <Icon name="calendar-check" size={16} />確認預約
        </Button>
      </svelte:fragment>
    </FormModal>
  {/if}
{/if}

<style>
  .slots {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .slot {
    text-align: left;
    display: flex;
    align-items: center;
    gap: 13px;
    padding: 13px 15px;
    border-radius: 12px;
    width: 100%;
    background: #fff;
    border: 1.5px solid var(--df-border);
    font-family: var(--df-font-body);
  }
  .slot.on {
    background: var(--df-primary-bg);
    border-color: var(--df-primary);
  }
  .radio {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 2px solid var(--df-border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .radio.on {
    border-color: var(--df-primary);
  }
  .radio .dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    background: var(--df-primary);
  }
  .meta {
    flex: 1;
  }
  .slot-title {
    font-size: 14.5px;
    font-weight: 700;
    color: var(--df-ink);
  }
  .slot-sub {
    font-size: 12.5px;
    color: var(--df-text-light);
    margin-top: 2px;
  }
</style>
