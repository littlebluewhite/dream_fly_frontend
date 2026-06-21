<script lang="ts">
  /* Push screen 外殼（全幅、由右滑入）。ported from ui.jsx PushScreen。 */
</script>

<div
  class="df-push"
  style="position:absolute; inset:0; background:var(--df-bg-light); display:flex;
    flex-direction:column; z-index:50;"
>
  <slot />
</div>
