<script lang="ts">
  /* 學員狀態 badge（MEMBER_ACCOUNT_STATUS tone+label，帶 dot）。ui.jsx StatusBadgeM (93)。
   * Task 20：MEMBER_STATUS 現為 MemberAccountStatus(active/inactive)強型別 Record
   * ——`s` prop 維持 string(容錯任意呼叫端傳入值)，索引前先轉型並提供 fallback。
   * 批次 1 W2a：MEMBER_STATUS 改名 MEMBER_ACCOUNT_STATUS（消同名異義，同桌面
   * admin/data.ts 命名）。 */
  import Badge from '$lib/components/ui/Badge.svelte';
  import { MEMBER_ACCOUNT_STATUS, type MemberAccountStatus } from '$lib/mobile-admin/data';

  export let s: string;

  type Tone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
  $: [tone, label] = (MEMBER_ACCOUNT_STATUS[s as MemberAccountStatus] || MEMBER_ACCOUNT_STATUS.active) as [Tone, string];
</script>

<Badge {tone} dot>{label}</Badge>
