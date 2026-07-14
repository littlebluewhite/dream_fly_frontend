<script lang="ts">
  /* 李教練's avatar — gold (--df-accent) disc with a navy (--df-ink) initial,
   * optional online dot (shell.jsx:28-35). The shared ui Avatar uses white text,
   * so this navy-on-gold variant is custom.
   *
   * `initial` 為 optional prop(審查回修):已接縫頁面(settings/ProfileTab)
   * 傳入 payload 的 coach.initial;W4(ADR 0013 §2)起 Sidebar 亦顯式傳入
   * authStore 衍生縮寫,所有 production 呼叫端均已傳 prop — `COACH.initial`
   * 預設值已無 production 觸達路徑,依該 ADR 裁決刻意保留(退役另 pass 處理)。 */
  import { COACH } from '$lib/coach/data';
  export let size = 40;
  export let online = false;
  export let initial: string = COACH.initial;
</script>

<div style="position:relative;width:{size}px;height:{size}px;flex:none">
  <div
    style="width:{size}px;height:{size}px;border-radius:50%;background:var(--df-accent);display:flex;align-items:center;justify-content:center;color:var(--df-ink);font-weight:800;font-size:{size *
      0.42}px;font-family:var(--df-font-body)"
  >
    {initial}
  </div>
  {#if online}
    <span
      style="position:absolute;right:0;bottom:0;width:{size * 0.28}px;height:{size *
        0.28}px;border-radius:50%;background:var(--df-success);border:2px solid var(--df-ink-soft)"
    ></span>
  {/if}
</div>
