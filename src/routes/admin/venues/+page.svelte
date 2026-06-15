<script lang="ts">
  /* 場館管理 — faithful port of reports.jsx VenuesView. PageHead + a card grid
   * over VENUES: an id chip + name + venue StatusBadge + type header, a
   * 面積/容納/今日排課 stats strip, the 器材配置 Tag chips, and the 排課表/編輯
   * actions (mock — they fire a toast, matching the prototype). */
  import { Button, Card, Icon, Tag } from '$lib/components/ui';
  import PageHead from '$lib/admin/components/PageHead.svelte';
  import StatusBadge from '$lib/admin/components/StatusBadge.svelte';
  import { toasts } from '$lib/admin/stores';
  import { VENUES } from '$lib/admin/data';

  const notify = toasts.notify;
</script>

<div style="display:flex; flex-direction:column; gap:20px;">
  <PageHead title="場館管理" sub="教室、訓練場地與器材配置">
    <svelte:fragment slot="actions">
      <Button
        variant="primary"
        size="sm"
        on:click={() => notify('success', '新增場地', '已開啟新場地建立表單。')}
      >
        <Icon name="plus" size={15} style="margin-right:6px;" />新增場地
      </Button>
    </svelte:fragment>
  </PageHead>

  <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(340px, 1fr)); gap:16px;">
    {#each VENUES as v (v.id)}
      {@const stats = [
        [v.area, '面積'],
        [v.cap + ' 人', '容納'],
        [v.today + ' 堂', '今日排課']
      ] as [string, string][]}
      <Card padding={0} hoverable style="overflow:hidden;">
        <div
          style="display:flex; align-items:center; gap:14px; padding:18px 20px 14px; border-bottom:1px solid var(--df-border);"
        >
          <div
            style="width:48px; height:48px; border-radius:12px; background:var(--df-primary-bg); display:flex; align-items:center; justify-content:center; flex:none; font-family:var(--df-font-heading); font-size:20px; font-weight:800; color:var(--df-primary);"
          >
            {v.id}
          </div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex; align-items:center; gap:8px;">
              <h3
                style="margin:0; font-size:17px; font-weight:700; color:var(--df-ink); font-family:var(--df-font-heading);"
              >
                {v.name}
              </h3>
              <StatusBadge kind="venue" value={v.status} />
            </div>
            <div style="font-size:12.5px; color:var(--df-text-light); margin-top:3px;">{v.type}</div>
          </div>
        </div>

        <div
          style="display:grid; grid-template-columns:repeat(3,1fr); border-bottom:1px solid var(--df-border);"
        >
          {#each stats as [val, lbl], i (lbl)}
            <div
              style="padding:12px 0; text-align:center; border-left:{i
                ? '1px solid var(--df-border)'
                : 'none'};"
            >
              <div
                style="font-size:16px; font-weight:800; color:var(--df-ink); font-family:var(--df-font-heading);"
              >
                {val}
              </div>
              <div style="font-size:11.5px; color:var(--df-text-light); margin-top:1px;">{lbl}</div>
            </div>
          {/each}
        </div>

        <div style="padding:14px 20px; display:flex; flex-direction:column; gap:10px;">
          <div
            style="font-size:11.5px; font-weight:600; color:var(--df-text-muted); letter-spacing:0.04em;"
          >
            器材配置
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            {#each v.equip as e (e)}
              <Tag>{e}</Tag>
            {/each}
          </div>
        </div>

        <div style="display:flex; gap:8px; padding:0 20px 18px;">
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            on:click={() => notify('info', v.name, '顯示 ' + v.name + ' 的排課時段。')}
          >
            <Icon name="calendar-days" size={14} style="margin-right:6px;" />排課表
          </Button>
          <Button
            variant="primary"
            size="sm"
            fullWidth
            on:click={() => notify('info', v.name, '編輯場地資訊（示範）。')}
          >
            <Icon name="pencil-line" size={14} style="margin-right:6px;" />編輯
          </Button>
        </div>
      </Card>
    {/each}
  </div>
</div>
