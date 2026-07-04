<script lang="ts">
  /* 學員資料 — read-only member detail modal. Faithful port of admin.jsx
   * MemberDialog: avatar + name + status badge, a 本月出席率 progress bar, the
   * 近六堂出席 letter strip, then a 2-col field grid covering the enriched member
   * record (分校/分級/課程/教練/繳費/剩餘/續費/最近出席/來源/生日/家長/電話/LINE/緊急聯絡/
   * 入會/點數). Built on the shared Dialog (matches the source's ADialog) with a
   * 編輯資料 primary that calls onEdit and a 關閉 secondary that calls onClose.
   *
   * Task 5 (issue #8) adds a second, honest `account` branch for 學員管理頁's real
   * getMembers() data (MemberAccount: id/name/initial/phone/joined/status/points —
   * the only 7 fields GET /users actually returns). It shows ONLY those fields; no
   * 出席率/近況/分級/代表色/課程/教練/繳費/剩餘堂數 etc. (P2: 需後端欄位). It also offers no
   * 編輯資料 button — primaryAction stays null unless `member` is set — because
   * integration-contract.md §3.2 has no admin edit-another-user endpoint, so a
   * working edit form here would silently fail to persist. `member`/`account` are
   * mutually exclusive: the caller (MembersTable) passes whichever shape its
   * compact/full variant has. */
  import { Avatar, Dialog, ProgressBar } from '$lib/components/ui';
  import StatusBadge from './StatusBadge.svelte';
  import { ATT_MARK, PAY_STATUS, type Member, type MemberAccount } from '$lib/admin/data';

  export let member: Member | null = null;
  export let account: MemberAccount | null = null;
  export let onClose: () => void = () => {};
  export let onEdit: (m: Member) => void = () => {};

  // [label, value, mono?] field grid — mirrors the source row list order for
  // `member`; `account` only carries the 7 real GET /users fields (見上方註解).
  $: rows = member
    ? ([
        ['會員編號', member.id, true],
        ['年齡', member.age + ' 歲'],
        ['所屬分校', member.campus],
        ['會員分級', member.tier],
        ['報名課程', member.course],
        ['授課教練', member.coach + ' 教練'],
        ['繳費狀態', PAY_STATUS[member.pay][1]],
        ['剩餘堂數', member.remain + ' 堂'],
        ['續費到期', member.renewDue],
        ['最近出席', member.lastSeen],
        ['報名來源', member.source],
        ['生日', member.birthday],
        ['家長', member.parent],
        ['聯絡電話', member.phone],
        ['LINE', member.lineId],
        ['緊急聯絡人', member.emName + ' · ' + member.emPhone],
        ['入會時間', member.joined],
        ['會員點數', member.points + ' 點']
      ] as [string, string, boolean?][])
    : account
      ? ([
          ['會員編號', account.id, true],
          ['聯絡電話', account.phone || '—'],
          ['入會時間', account.joined],
          ['會員點數', account.points + ' 點']
        ] as [string, string, boolean?][])
      : [];
</script>

<Dialog
  open={!!member || !!account}
  title="學員資料"
  width={460}
  {onClose}
  primaryAction={member ? { label: '編輯資料', onClick: () => onEdit(member) } : null}
  secondaryAction={{ label: '關閉', onClick: onClose }}
>
  {#if member}
    <div style="display:flex;align-items:center;gap:14px;margin:4px 0 18px">
      <Avatar name={member.initial} size="lg" color={member.color} />
      <div>
        <div
          style="font-size:19px;font-weight:700;color:var(--df-ink);font-family:var(--df-font-heading)"
        >
          {member.name}
        </div>
        <div style="margin-top:5px">
          <StatusBadge kind="member" value={member.status} />
        </div>
      </div>
    </div>

    <div style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px">
        <span style="color:var(--df-text-light)">本月出席率</span>
        <span style="font-weight:700;color:var(--df-text-dark)">{member.att}%</span>
      </div>
      <ProgressBar value={member.att} height={7} tone={member.att >= 80 ? 'success' : 'warning'} />
    </div>

    <div style="margin-bottom:16px">
      <div
        style="display:flex;justify-content:space-between;font-size:12px;color:var(--df-text-muted);margin-bottom:6px"
      >
        <span>近六堂出席</span>
        <span>出 · 缺 · 遲 · 假</span>
      </div>
      <div style="display:flex;gap:6px">
        {#each member.recent as mk}
          {@const m = ATT_MARK[mk]}
          <span
            class="att-cell"
            style="background:{m[0]}1F;color:{m[0]}"
            title={m[1]}
          >{m[1]}</span>
        {/each}
      </div>
    </div>

    <!-- tier chip rendered with its own tierColor (the source surfaces tier as plain text;
         we add the coloured pill the brief calls for, sourced from tierColor) -->
    <div style="margin-bottom:16px">
      <span
        class="tier-chip"
        style="background:{member.tierColor}1F;color:{member.tierColor}"
      >{member.tier}</span>
    </div>
  {:else if account}
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
  {/if}

  {#if member || account}
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

<style>
  .att-cell {
    width: 24px;
    height: 24px;
    border-radius: 7px;
    font-size: 11.5px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .tier-chip {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: var(--df-radius-pill);
    font-size: 12.5px;
    font-weight: 700;
  }
</style>
