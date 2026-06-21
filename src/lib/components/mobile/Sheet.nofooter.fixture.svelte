<script lang="ts">
  import Sheet from './Sheet.svelte';
  export let open = true;
  export let onClose = () => {};
</script>

<!-- footer=true but NO footer slot provided — the footer region must not appear -->
<Sheet {open} {onClose} footer={true}>
  <span>DEFAULT_SLOT_CONTENT</span>
</Sheet>
