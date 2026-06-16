<script lang="ts">
  import Radio from './Radio.svelte';
  export let plan = 'monthly';
</script>
<Radio bind:group={plan} value="monthly" name="plan" label="月繳" />
<Radio bind:group={plan} value="annual" name="plan" label="年繳" />
<span data-testid="plan">{plan}</span>
