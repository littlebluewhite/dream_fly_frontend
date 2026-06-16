<script lang="ts">
  /* Mini 進度條。ui.jsx MiniBar (336-343)。tone 可為 'primary'|'warning'|'success' 關鍵字或任意色值。 */
  import { toneColor } from './tone';

  export let value: number;
  export let tone = 'var(--df-primary)';
  export let height = 6;

  $: c = toneColor(tone);
</script>

<div style="width:100%; height:{height}px; border-radius:999px; background:var(--df-border); overflow:hidden;">
  <div
    style="width:{value}%; height:100%; border-radius:999px; background:{c};
      transform-origin:left; animation:df-grow .5s ease both;"
  ></div>
</div>
