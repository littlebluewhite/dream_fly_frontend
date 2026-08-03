<script lang="ts">
  /* 教練端 custom dropdown (icon + value + chevron → popover list). The shared ui
   * Select is a native <select>; this is the prototype's bespoke dropdown
   * (views_students.jsx:150-151). Used by 我的學員 (×2, REAL filters)、排課管理
   * (×2, decorative — constant value + no-op onChange) 與 出席點名 (切換班級).
   * Options are keyed（{ key, label }）：`value` 與 onChange 走 key，label 只管顯示——
   * 同日兩場同課名（label 相同、key 相異）各自可選，each key 也不撞
   * (selectClass name→id，ADR 0014 限制撤銷)。字串篩選類使用點以 key=label 遷移。 */
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let icon: IconName | undefined = undefined;
  export let value: string;
  export let options: { key: string; label: string }[] = [];
  export let onChange: (key: string) => void = () => {};

  let open = false;
  function pick(key: string) {
    open = false;
    onChange(key);
  }
  // 按鈕顯示選中項的 label；key 查無時退回顯示 value 本身（key=label 使用點的等價路徑）。
  $: valueLabel = options.find((o) => o.key === value)?.label ?? value;
</script>

<div style="position:relative">
  <button
    type="button"
    on:click={() => (open = !open)}
    style="display:inline-flex;align-items:center;gap:8px;border:1px solid var(--df-border);background:#fff;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--df-text-dark);cursor:pointer;font-family:var(--df-font-body)"
  >
    {#if icon}<Icon name={icon} size={15} color="var(--df-text-light)" />{/if}
    <span>{valueLabel}</span>
    <Icon name="chevron-down" size={15} color="var(--df-text-muted)" />
  </button>
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div style="position:fixed;inset:0;z-index:60" on:click={() => (open = false)}></div>
    <div
      style="position:absolute;top:calc(100% + 6px);left:0;min-width:180px;background:#fff;border-radius:10px;box-shadow:var(--df-shadow-strong);z-index:70;overflow:hidden;padding:4px 0;animation:df-fade-up .14s ease both"
    >
      {#each options as o (o.key)}
        {@const on = o.key === value}
        <button
          type="button"
          class="df-rowhover"
          on:click={() => pick(o.key)}
          style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;border:none;background:{on
            ? 'var(--df-primary-bg)'
            : 'transparent'};text-align:left;font-size:13px;font-weight:{on
            ? 600
            : 500};color:{on ? 'var(--df-primary)' : 'var(--df-text-dark)'};cursor:pointer;font-family:var(--df-font-body)"
        >
          <span style="flex:1;min-width:0">{o.label}</span>
          {#if on}<Icon name="check" size={15} color="var(--df-primary)" />{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
