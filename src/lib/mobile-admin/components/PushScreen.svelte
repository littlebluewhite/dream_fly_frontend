<script lang="ts">
  /* Push screen wrapper。ui.jsx PushScreen (132-138)。絕對定位覆蓋整個 .m-screen。 */
</script>

<div
  class="df-push"
  style="position:absolute; inset:0; background:var(--df-bg-light); display:flex;
    flex-direction:column; z-index:50;"
>
  <slot />
</div>
