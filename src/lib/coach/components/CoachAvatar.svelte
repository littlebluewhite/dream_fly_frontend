<script lang="ts">
  /* 李教練's avatar — gold (--df-accent) disc with a navy (--df-ink) initial,
   * optional online dot (shell.jsx:28-35). The shared ui Avatar uses white text,
   * so this navy-on-gold variant is custom.
   *
   * `initial` 為 optional prop(審查回修):已接縫頁面(settings/ProfileTab)
   * 傳入 payload 的 coach.initial;預設值保住 Sidebar/Topbar 等 layout 殼層的
   * 既有無-prop 呼叫 — 這是殼層邊界的刻意預設,與頁面元件 required-props 原則
   * 不衝突。 */
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
