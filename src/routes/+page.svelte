<script lang="ts">
  import { toasts } from '$lib/stores/marketingToasts';
  import Hero from '$lib/components/home/Hero.svelte';
  import ProofStrip from '$lib/components/home/ProofStrip.svelte';
  import WhyUs from '$lib/components/home/WhyUs.svelte';
  import Categories from '$lib/components/home/Categories.svelte';
  import Coaches from '$lib/components/home/Coaches.svelte';
  import Pricing from '$lib/components/home/Pricing.svelte';
  import Voices from '$lib/components/home/Voices.svelte';
  import Faq from '$lib/components/home/Faq.svelte';
  import CtaBanner from '$lib/components/home/CtaBanner.svelte';

  function book() {
    toasts.notify('success', '已收到預約，專員將於 1 個工作天內與您聯繫');
  }
</script>

<svelte:head>
  <title>Dream Fly 體操館 - 專業體操訓練中心</title>
</svelte:head>

<Hero onBook={book} />
<ProofStrip />
<WhyUs />
<Categories />
<Coaches />
<Pricing onBook={book} />
<Voices />
<Faq />
<CtaBanner onBook={book} />
