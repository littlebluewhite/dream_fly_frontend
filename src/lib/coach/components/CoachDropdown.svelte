<script lang="ts">
  /* 教練端 custom dropdown (icon + value + chevron → popover list). The shared ui
   * Select is a native <select>; this is the prototype's bespoke dropdown
   * (views_students.jsx:150-151). Used by 我的學員 (×2, REAL filters) and 排課管理
   * (×2, decorative — constant value + no-op onChange). Selecting calls
   * onChange(option) and closes. */
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let icon: IconName | undefined = undefined;
  export let value: string;
  export let options: string[] = [];
  export let onChange: (v: string) => void = () => {};

  let open = false;
  function pick(o: string) {
    open = false;
    onChange(o);
  }
</script>

<div style="position:relative">
  <button
    type="button"
    on:click={() => (open = !open)}
    style="display:inline-flex;align-items:center;gap:8px;border:1px solid var(--df-border);background:#fff;border-radius:8px;padding:8px 14px;font-size:13px;font-weight:600;color:var(--df-text-dark);cursor:pointer;font-family:var(--df-font-body)"
  >
    {#if icon}<Icon name={icon} size={15} color="var(--df-text-light)" />{/if}
    <span>{value}</span>
    <Icon name="chevron-down" size={15} color="var(--df-text-muted)" />
  </button>
  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div style="position:fixed;inset:0;z-index:60" on:click={() => (open = false)}></div>
    <div
      style="position:absolute;top:calc(100% + 6px);left:0;min-width:180px;background:#fff;border-radius:10px;box-shadow:var(--df-shadow-strong);z-index:70;overflow:hidden;padding:4px 0;animation:df-fade-up .14s ease both"
    >
      {#each options as o (o)}
        {@const on = o === value}
        <button
          type="button"
          class="df-rowhover"
          on:click={() => pick(o)}
          style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;border:none;background:{on
            ? 'var(--df-primary-bg)'
            : 'transparent'};text-align:left;font-size:13px;font-weight:{on
            ? 600
            : 500};color:{on ? 'var(--df-primary)' : 'var(--df-text-dark)'};cursor:pointer;font-family:var(--df-font-body)"
        >
          <span style="flex:1;min-width:0">{o}</span>
          {#if on}<Icon name="check" size={15} color="var(--df-primary)" />{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
