<script lang="ts">
  /* Settings list row — faithful port of admin.jsx SettingsView's SettingsRow.
   * A label + description on the left, and a control (Switch / Button / Badge)
   * slotted on the right. Used for the 通知與自動化 and 帳號與安全 rows. */
  export let label: string;
  export let desc = '';
</script>

<div class="row">
  <div class="text">
    <div class="label">{label}</div>
    {#if desc}<div class="desc">{desc}</div>{/if}
  </div>
  <div class="control"><slot /></div>
</div>

<style>
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 20px;
    padding: 16px 0;
    border-bottom: 1px solid var(--df-border);
  }
  .label {
    font-size: 14.5px;
    font-weight: 600;
    color: var(--df-text-dark);
  }
  .desc {
    font-size: 12.5px;
    color: var(--df-text-light);
    margin-top: 2px;
  }
  .control {
    flex: none;
  }
</style>
