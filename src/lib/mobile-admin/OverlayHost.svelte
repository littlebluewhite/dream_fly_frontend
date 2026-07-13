<script lang="ts">
  /* Overlay host — 把 overlay store 的 push-stack 頂層 + 當前 sheet 對應到元件並渲染。
   * 對應 app.jsx 的 push-stack（178-183）與 sheets（186-193）區塊。
   * push 一律帶 onBack={overlay.pop}，sheet 一律帶 onClose={overlay.closeSheet}，
   * 其餘 props 由 push/sheet 呼叫端透過 props 傳入並展開。 */
  import { overlay } from '$lib/mobile-admin/stores';
  import type { MobileAdminPushId, MobileAdminSheetId } from '$lib/mobile-admin/stores';

  import CoachesScreen from '$lib/mobile-admin/overlays/CoachesScreen.svelte';
  import VenuesScreen from '$lib/mobile-admin/overlays/VenuesScreen.svelte';
  import TicketsScreen from '$lib/mobile-admin/overlays/TicketsScreen.svelte';
  import ReportsScreen from '$lib/mobile-admin/overlays/ReportsScreen.svelte';
  import AdminSettingsScreen from '$lib/mobile-admin/overlays/AdminSettingsScreen.svelte';
  import MessageThread from '$lib/mobile-admin/overlays/MessageThread.svelte';

  import MemberSheet from '$lib/mobile-admin/overlays/MemberSheet.svelte';
  import ClassSheet from '$lib/mobile-admin/overlays/ClassSheet.svelte';
  import OrderSheet from '$lib/mobile-admin/overlays/OrderSheet.svelte';
  import MemberForm from '$lib/mobile-admin/overlays/MemberForm.svelte';
  import ClassForm from '$lib/mobile-admin/overlays/ClassForm.svelte';
  import CoachForm from '$lib/mobile-admin/overlays/CoachForm.svelte';
  import NotifSheet from '$lib/mobile-admin/overlays/NotifSheet.svelte';
  import RoleSheet from '$lib/mobile-admin/overlays/RoleSheet.svelte';
  import StudentActionSheet from '$lib/mobile-admin/overlays/StudentActionSheet.svelte';

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type Comp = any;

  const PUSH: Record<MobileAdminPushId, Comp> = {
    coaches: CoachesScreen,
    venues: VenuesScreen,
    tickets: TicketsScreen,
    reports: ReportsScreen,
    settings: AdminSettingsScreen,
    messageThread: MessageThread
  };
  const SHEETS: Record<MobileAdminSheetId, Comp> = {
    member: MemberSheet,
    class: ClassSheet,
    order: OrderSheet,
    memberForm: MemberForm,
    classForm: ClassForm,
    coachForm: CoachForm,
    notif: NotifSheet,
    role: RoleSheet,
    studentAction: StudentActionSheet
  };

  $: top = $overlay.stack[$overlay.stack.length - 1];
</script>

{#if top && PUSH[top.id]}
  <svelte:component this={PUSH[top.id]} onBack={overlay.pop} {...top.props} />
{/if}

{#if $overlay.sheet && SHEETS[$overlay.sheet.id]}
  <svelte:component this={SHEETS[$overlay.sheet.id]} onClose={overlay.closeSheet} {...$overlay.sheet.props} />
{/if}
