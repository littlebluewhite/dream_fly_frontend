<script lang="ts">
  /* 學員資料 — read-only member detail modal. Faithful port of admin.jsx
   * MemberDialog, narrowed down (Task 1，R13 小 bug 包：刪死分支，ADR-0010) to the
   * one branch MembersTable ever actually passes: 學員管理頁's real getMembers()
   * data (MemberAccount: id/name/initial/phone/joined/status/points — the only 7
   * fields GET /users actually returns). It shows ONLY those fields; no
   * 出席率/近況/分級/代表色/課程/教練/繳費/剩餘堂數 etc. (P2: 需後端欄位). It also offers no
   * 編輯資料 button — integration-contract.md §3.2 has no admin edit-another-user
   * endpoint, so a working edit form here would silently fail to persist.
   * (The mock-seed `member`/onEdit branch this file used to carry alongside
   * `account` was never wired by any caller — MembersTable only ever passes
   * `account` — and was removed here.) */
  import { Avatar, Dialog } from '$lib/components/ui';
  import StatusBadge from './StatusBadge.svelte';
  import type { MemberAccount } from '$lib/admin/data';

  export let account: MemberAccount | null = null;
  export let onClose: () => void = () => {};

  // [label, value, mono?] field grid — `account` only carries the 7 real
  // GET /users fields (見上方註解).
  $: rows = account
    ? ([
        ['會員編號', account.id, true],
        ['聯絡電話', account.phone || '—'],
        ['入會時間', account.joined],
        ['會員點數', account.points + ' 點']
      ] as [string, string, boolean?][])
    : [];
</script>

<Dialog
  open={!!account}
  title="學員資料"
  width={460}
  {onClose}
  primaryAction={null}
  secondaryAction={{ label: '關閉', onClick: onClose }}
>
  {#if account}
    <div style="display:flex;align-items:center;gap:14px;margin:4px 0 18px">
      <Avatar name={account.initial} size="lg" />
      <div>
        <div
          style="font-size:19px;font-weight:700;color:var(--df-ink);font-family:var(--df-font-heading)"
        >
          {account.name}
        </div>
        <div style="margin-top:5px">
          <StatusBadge kind="memberAccount" value={account.status} />
        </div>
      </div>
    </div>

    <!-- P2 (issue #8): 本月出席率／近況出席／會員分級／代表色／課程／教練／繳費／剩餘堂數／
         續費／生日／家長／LINE／緊急聯絡人等欄位 GET /users 沒有對應資料來源，誠實隱藏（不以
         假資料填充）。 -->

    <div
      style="display:grid;grid-template-columns:1fr 1fr;gap:12px 18px;border-top:1px solid var(--df-border);padding-top:16px"
    >
      {#each rows as [k, v, mono]}
        <div>
          <div style="font-size:11.5px;color:var(--df-text-muted);margin-bottom:2px">{k}</div>
          <div
            style="font-size:14px;color:var(--df-text-dark);font-weight:500;font-family:{mono
              ? 'var(--df-font-mono)'
              : 'inherit'}"
          >{v}</div>
        </div>
      {/each}
    </div>
  {/if}
</Dialog>
