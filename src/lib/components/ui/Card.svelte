<script lang="ts">
  /* Dream Fly card primitive. Static by default (12px radius, 1px border,
   * resting card shadow); `hoverable` opts into the -2px lift. Renders an <a>
   * when `href` is set so clickable cards stay keyboard-accessible; otherwise a
   * plain container <div>. `padding` accepts a number (px) or any CSS length. */
  export let padding: number | string = 24;
  export let hoverable = false;
  export let href: string | undefined = undefined;
  export let style = '';
  let className = '';
  export { className as class };

  $: pad = typeof padding === 'number' ? `${padding}px` : padding;
</script>

{#if href}
  <a
    {href}
    class="card {className}"
    class:card-hoverable={hoverable}
    style="padding: {pad}; {style}"
    on:click
    {...$$restProps}
  >
    <slot />
  </a>
{:else}
  <div
    class="card {className}"
    class:card-hoverable={hoverable}
    style="padding: {pad}; {style}"
    {...$$restProps}
  >
    <slot />
  </div>
{/if}

<style>
  a.card {
    display: block;
    color: inherit;
    text-decoration: none;
  }
</style>
