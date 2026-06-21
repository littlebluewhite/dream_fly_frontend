<script lang="ts">
  import Sheet from './Sheet.svelte';
  export let open = true;
  export let onClose = () => {};
  export let footer = true;
</script>

<Sheet {open} {onClose} {footer} title="測試標題">
  <span>DEFAULT_SLOT_CONTENT</span>
  <svelte:fragment slot="footer">
    <span>FOOTER_SLOT_CONTENT</span>
  </svelte:fragment>
</Sheet>
