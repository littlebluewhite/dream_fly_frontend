<script lang="ts">
  /* Dream Fly Avatar — circular member/coach avatar with image or initial
   * fallback (works with CJK surnames). Ported from the DS bundle: disc dim by
   * size token, font ≈ 42% of dim, optional status dot ≈ 24% of dim. */
  type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  type Status = 'online' | 'busy' | 'offline';

  export let name = '';
  export let src: string | null = null;
  export let size: Size | number = 'md';
  export let color = 'var(--df-primary)';
  export let status: Status | null = null;
  export let style = '';
  let className = '';
  export { className as class };

  const SIZES: Record<Size, number> = { xs: 28, sm: 36, md: 48, lg: 64, xl: 80 };
  const STATUS: Record<Status, string> = {
    online: 'var(--df-success)',
    busy: 'var(--df-warning)',
    offline: 'var(--df-text-muted)'
  };

  $: dim = typeof size === 'number' ? size : SIZES[size] ?? 48;
  $: fontSize = Math.round(dim * 0.42);
  $: dotSize = Math.max(8, Math.round(dim * 0.24));
  $: initial = name ? name.trim().charAt(0) : '?';
</script>

<span class="avatar {className}" {style}>
  <span
    class="disc"
    style="width:{dim}px;height:{dim}px;font-size:{fontSize}px;background:{src
      ? 'var(--df-bg-light)'
      : color};"
  >
    {#if src}<img {src} alt={name} />{:else}{initial}{/if}
  </span>
  {#if status}
    <span
      class="status"
      style="width:{dotSize}px;height:{dotSize}px;background:{STATUS[status] ?? STATUS.offline};"
    ></span>
  {/if}
</span>

<style>
  .avatar {
    position: relative;
    display: inline-flex;
    flex: none;
  }
  .disc {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: #fff;
    overflow: hidden;
    font-family: var(--df-font-body);
    font-weight: var(--df-weight-bold);
    line-height: 1;
    user-select: none;
  }
  .disc img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .status {
    position: absolute;
    right: 0;
    bottom: 0;
    border-radius: 50%;
    border: 2px solid #fff;
  }
</style>
