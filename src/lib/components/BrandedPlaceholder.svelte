<script lang="ts">
  import Icon from '$lib/components/ui/Icon.svelte';
  import type { IconName } from '$lib/icon-registry';

  export let src: string;
  export let alt: string;
  export let variant: 'hero' | 'gallery' = 'gallery';
  export let icon: IconName = 'image';
  export let showCaption = true;

  function isPlaceholder(u: string): boolean {
    return !u || u.includes('placehold.co');
  }

  function caption(u: string, fallback: string): string {
    try {
      const text = new URL(u, 'https://placehold.co').searchParams.get('text');
      if (text) return decodeURIComponent(text);
    } catch {
      // malformed URL or %-sequence → fall through to alt
    }
    return fallback;
  }

  $: placeholder = isPlaceholder(src);
  $: label = caption(src, alt);
  $: iconSize = variant === 'hero' ? 56 : 40;
</script>

{#if placeholder}
  <div class="branded {variant}" role="img" aria-label={label}>
    <div class="monogram" aria-hidden="true">DF</div>
    <div class="glyph" aria-hidden="true">
      <Icon name={icon} size={iconSize} color="var(--df-white)" />
    </div>
    {#if showCaption}
      <p class="caption">{label}</p>
    {/if}
    <p class="sub-label">示意圖 · 實拍照片整備中</p>
  </div>
{:else}
  <img class="real" {src} {alt} loading={variant === 'hero' ? 'eager' : 'lazy'} />
{/if}

<style>
  .branded {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1.5rem;
    box-sizing: border-box;
    text-align: center;
    background: linear-gradient(
      135deg,
      var(--df-ink),
      var(--df-primary-dark),
      var(--df-primary)
    );
  }

  .monogram {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 3rem;
    height: 3rem;
    border-radius: var(--df-radius-md);
    background-color: var(--df-white);
    color: var(--df-primary);
    font-family: var(--df-font-heading);
    font-weight: 700;
    font-size: 1.25rem;
    letter-spacing: 0.05em;
  }

  .glyph {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .caption {
    margin: 0;
    color: var(--df-white);
    font-family: var(--df-font-heading);
    font-weight: 600;
    font-size: 1.125rem;
  }

  .sub-label {
    margin: 0;
    color: var(--df-accent);
    font-family: var(--df-font-body);
    font-size: 0.8125rem;
    letter-spacing: 0.02em;
  }

  .hero .monogram {
    width: 3.5rem;
    height: 3.5rem;
    font-size: 1.5rem;
  }

  .hero .caption {
    font-size: 1.375rem;
  }

  .real {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
