<script lang="ts">
  /* SuccessBody — sheet 內成功狀態。ui.jsx SuccessBody (325-333)。 */
  import Icon from '$lib/components/ui/Icon.svelte';

  export let icon = 'check';
  export let title: string;
  export let body = '';
</script>

<div style="text-align:center; padding:18px 0 10px; display:flex; flex-direction:column; align-items:center;">
  <div
    style="width:70px; height:70px; border-radius:50%; background:var(--df-success-bg);
      display:inline-flex; align-items:center; justify-content:center; margin-bottom:16px;
      animation:df-pop .4s ease both;"
  >
    <Icon name={icon} size={36} color="var(--df-success)" />
  </div>
  <h3 style="margin:0 0 6px; font-size:20px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);">{title}</h3>
  <p style="margin:0; color:var(--df-text-light); line-height:1.65; font-size:13.5px; max-width:290px;">{body}</p>
</div>
