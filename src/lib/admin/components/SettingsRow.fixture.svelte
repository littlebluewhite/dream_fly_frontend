<script lang="ts">
  /* Test-only harness: bare render(Component, props) can't inject slot content
   * (see EditModal.test note), so this wraps SettingsRow with a real slotted
   * control to exercise the slot. Not collected as a test (no .test/.spec). */
  import SettingsRow from './SettingsRow.svelte';
  import { Switch } from '$lib/components/ui';

  export let label = 'Email 通知';
  export let desc = '報名、繳費與請假以 Email 通知家長';
</script>

<SettingsRow {label} {desc}>
  <Switch label="切換 Email 通知" />
</SettingsRow>
