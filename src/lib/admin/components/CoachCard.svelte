<script lang="ts">
  /* 教練卡片 — faithful port of the card rendered inside admin.jsx CoachesView.
   * Header: Avatar (代表色，純視覺裝飾) + 姓名(＋教練 suffix)＋公開顯示狀態 + 職稱
   * (primary colour) + 專長 tag chips，with an edit pencil IconButton。Footer: 課表。
   *
   * Task F5：欄位收斂——年資/學員/班級/獲獎 4-up 統計格與線上/忙碌/離線狀態點皆無
   * 後端來源，已移除(同 CoachEditDialog 欄位收斂理由，見 admin/api.ts mapCoach()
   * 註解：classes/students 統計已有真實來源 getReports()，不是這張卡片的職責)；
   * 聯絡按鈕(原顯示 coach.phone)一併移除——phone 無對應後端欄位。狀態改顯示
   * isActive(coaches.is_active)：這個旗標實際控制公開教練頁/課程頁看不看得到這位
   * 教練，故標籤誠實寫「公開顯示中／未公開顯示」，不是假的線上/忙碌裝飾。
   *
   * The pencil fires onEdit(coach); 課表 emits the same info toast the source does. */
  import { Avatar, Card, Button, IconButton, Icon, Tag } from '$lib/components/ui';
  import { toasts } from '$lib/admin/stores';
  import type { Coach } from '$lib/admin/data';

  export let coach: Coach;
  export let onEdit: (coach: Coach) => void = () => {};

  function schedule() {
    toasts.notify('info', '課表', '顯示 ' + coach.name + ' 教練的授課時段。');
  }
</script>

<Card padding={0} hoverable style="overflow:hidden">
  <div class="head">
    <Avatar name={coach.initial} size="lg" color={coach.color} />
    <div class="meta">
      <div class="name">
        {coach.name} <span class="suffix">教練</span>
        <span class="status">
          <span
            class="dot"
            style="background:{coach.isActive ? 'var(--df-success)' : 'var(--df-text-muted)'}"
          ></span>{coach.isActive ? '公開顯示中' : '未公開顯示'}
        </span>
      </div>
      <div class="title">{coach.title}</div>
      <div class="tags">
        {#each coach.tags as t}
          <Tag>{t}</Tag>
        {/each}
      </div>
    </div>
    <IconButton aria-label="編輯教練" variant="ghost" on:click={() => onEdit(coach)}>
      <Icon name="pencil-line" size={17} color="var(--df-text-light)" />
    </IconButton>
  </div>

  <div class="foot">
    <Button variant="secondary" size="sm" fullWidth on:click={schedule}>
      <Icon name="calendar-days" size={14} />課表
    </Button>
  </div>
</Card>

<style>
  .head {
    display: flex;
    gap: 14px;
    padding: 20px 20px 16px;
  }
  .meta {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 17px;
    font-weight: 700;
    color: var(--df-ink);
    font-family: var(--df-font-heading);
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .suffix {
    font-size: 13px;
    font-weight: 500;
    color: var(--df-text-muted);
  }
  .status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 500;
    color: var(--df-text-light);
  }
  .status .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex: none;
  }
  .title {
    font-size: 12.5px;
    color: var(--df-primary);
    margin-top: 3px;
    line-height: 1.4;
  }
  .tags {
    display: flex;
    gap: 6px;
    margin-top: 9px;
    flex-wrap: wrap;
  }
  .foot {
    display: flex;
    gap: 8px;
    padding: 14px 20px;
    border-top: 1px solid var(--df-border);
  }
  /* match the source's button icon+label inline layout */
  .foot :global(button) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }
</style>
