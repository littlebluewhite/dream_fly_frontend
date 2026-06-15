<script lang="ts">
  /* Centered success confirmation (round green check bubble + title + body).
   * Used inside dialogs after a successful action. */
  import Icon from '$lib/components/ui/Icon.svelte';
  export let icon = 'check';
  export let title = '';
  export let body = '';
</script>

<div class="ok">
  <div class="bubble"><Icon name={icon} size={34} color="var(--df-success)" /></div>
  <h3>{title}</h3>
  <p>{body}</p>
</div>

<style>
  .ok {
    text-align: center;
    padding: 16px 0 8px;
  }
  .bubble {
    width: 66px;
    height: 66px;
    border-radius: 50%;
    background: var(--df-success-bg);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 14px;
  }
  h3 {
    margin: 0 0 6px;
    font-size: 20px;
    font-weight: var(--df-weight-bold);
    color: var(--df-ink);
    font-family: var(--df-font-heading);
  }
  p {
    margin: 0;
    color: var(--df-text-light);
    line-height: 1.6;
  }
</style>
