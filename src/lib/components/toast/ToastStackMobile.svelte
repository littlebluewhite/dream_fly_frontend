<script lang="ts">
  /* Toast host for mobile/mobile-admin surfaces. Dark background (`--df-ink`),
   * positioned above tab bar at bottom:96px. Inline styles — no scoped CSS.
   * Icon names: success→circle-check / info→info / warning→triangle-alert /
   * error→circle-x / accent→star. */
  import type { ToastTone, createToasts } from '$lib/stores/toasts';
  import Icon from '$lib/components/ui/Icon.svelte';

  export let toasts: ReturnType<typeof createToasts>;

  const ICONS: Record<ToastTone, string> = {
    success: 'circle-check',
    info: 'info',
    warning: 'triangle-alert',
    error: 'circle-x',
    accent: 'star'
  };
  const TINT: Record<ToastTone, string> = {
    success: 'var(--df-success)',
    info: 'var(--df-info)',
    warning: 'var(--df-warning)',
    error: 'var(--df-error)',
    accent: 'var(--df-accent)'
  };
</script>

<div
  style="position:absolute; left:16px; right:16px; bottom:96px; z-index:200; display:flex;
    flex-direction:column; gap:8px; pointer-events:none;"
>
  {#each $toasts as t (t.id)}
    <div
      style="animation:df-toast-in .24s ease both; background:var(--df-ink); color:#fff;
        border-radius:14px; padding:12px 15px; display:flex; align-items:flex-start; gap:11px;
        box-shadow:var(--df-shadow-strong);"
    >
      <span style="margin-top:1px; display:flex; flex:none;">
        <Icon name={ICONS[t.tone] || 'info'} size={19} color={TINT[t.tone] || '#fff'} />
      </span>
      <div style="min-width:0;">
        <div style="font-size:14px; font-weight:700;">{t.title}</div>
        {#if t.body}
          <div style="font-size:12.5px; opacity:0.85; margin-top:2px; line-height:1.45;">{t.body}</div>
        {/if}
      </div>
    </div>
  {/each}
</div>
