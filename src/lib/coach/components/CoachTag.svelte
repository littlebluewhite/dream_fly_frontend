<script lang="ts">
  /* 教練端 CoachTag — coloured/closable chip for specialty tags.
   * Unlike the static ui Tag, this supports tone (accent/primary/success/warning/error/neutral)
   * and an optional remove button. */
  import { createEventDispatcher } from 'svelte';
  import Icon from '$lib/components/ui/Icon.svelte';

  export let tone: 'accent' | 'primary' | 'success' | 'warning' | 'error' | 'neutral' = 'primary';
  export let removable = false;

  const TONE_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
    accent:  { bg: '#FFF8DB', fg: '#92400E',                  border: '#F59E0B' },
    primary: { bg: 'var(--df-primary-bg)', fg: 'var(--df-primary-dark)', border: 'var(--df-primary)' },
    success: { bg: 'var(--df-success-bg)', fg: 'var(--df-success-strong)', border: 'var(--df-success)' },
    warning: { bg: 'var(--df-warning-bg)', fg: '#92400E',     border: '#D97706' },
    error:   { bg: 'var(--df-error-bg)',   fg: 'var(--df-error)',   border: 'var(--df-error)' },
    neutral: { bg: 'var(--df-bg-light)',   fg: 'var(--df-text-light)', border: 'var(--df-border)' }
  };

  $: t = TONE_STYLE[tone] ?? TONE_STYLE.primary;

  const dispatch = createEventDispatcher<{ remove: void }>();
  function handleRemove(e: MouseEvent) {
    e.stopPropagation();
    dispatch('remove');
  }
</script>

<span
  style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:var(--df-radius-pill);background:{t.bg};color:{t.fg};border:1px solid {t.border};font-size:12px;font-weight:600;font-family:var(--df-font-body);white-space:nowrap;line-height:1.5"
>
  <slot />
  {#if removable}
    <button
      type="button"
      on:click={handleRemove}
      aria-label="移除"
      style="display:inline-flex;align-items:center;justify-content:center;padding:0;border:none;background:transparent;cursor:pointer;color:{t.fg};opacity:0.7;line-height:1"
    >
      <Icon name="x" size={12} color={t.fg} />
    </button>
  {/if}
</span>
