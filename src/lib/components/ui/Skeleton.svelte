<script lang="ts">
  /* Shimmering placeholder bar. w/h/r accept a number (px) or any CSS length. */
  export let w: string | number = '100%';
  export let h: string | number = 14;
  export let r: string | number = 8;
  export let style = '';
  const u = (v: string | number) => (typeof v === 'number' ? `${v}px` : v);
</script>

<div class="skel" style="width:{u(w)};height:{u(h)};border-radius:{u(r)};{style}"></div>

<style>
  .skel {
    background: linear-gradient(90deg, #eef1f5 25%, #e2e8f0 37%, #eef1f5 63%);
    background-size: 300% 100%;
    animation: df-shimmer 1.3s ease infinite;
    flex: none;
  }
</style>
