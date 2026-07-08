<script lang="ts">
  /* 場館管理 push screen。admin2.jsx VenuesScreen (113)。
   * VENUES 卡片：編號方塊 + 名稱/型態 + 狀態 Badge + 器材 Tag + 使用狀態列與時段表動作。
   *
   * Task F4：桌面 admin 場館編輯已接上真實 PATCH /venues，VENUES(`$lib/domain/venues`)
   * 的共用型別隨之收斂到 VenueResponse 真實欄位——面積/容納上限/今日排課堂數是無後端
   * 來源的裝飾欄位，已移除；這裡是唯讀展示(維持 mock，不接真 API，同任務簡報)，僅
   * 跟著移除對應顯示，不發明替代數字。 */
  import PushScreen from '$lib/components/mobile/PushScreen.svelte';
  import ScreenHeader from '$lib/components/mobile/ScreenHeader.svelte';
  import Icon from '$lib/components/ui/Icon.svelte';
  import Badge from '$lib/components/ui/Badge.svelte';
  import Tag from '$lib/components/ui/Tag.svelte';
  import { toasts } from '$lib/mobile-admin/stores';
  import { VENUES, VENUE_STATUS } from '$lib/mobile-admin/data';

  export let onBack: () => void;

  type BadgeTone = 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'info' | 'neutral';
</script>

<PushScreen>
  <ScreenHeader {onBack} title="場館管理" sub={VENUES.length + ' 個場地 · 器材與時段'} />
  <div class="df-scroll">
    <div style="padding:16px; display:flex; flex-direction:column; gap:12px;">
      {#each VENUES as v (v.id)}
        {@const tone = VENUE_STATUS[v.status][0] as BadgeTone}
        {@const label = VENUE_STATUS[v.status][1]}
        {@const maint = v.status === 'maintenance'}
        <div
          style="background:#fff; border:1px solid var(--df-border); border-radius:16px;
            box-shadow:var(--df-shadow-card); overflow:hidden; opacity:{maint ? 0.92 : 1};"
        >
          <div style="display:flex; align-items:center; gap:13px; padding:15px 16px 13px;">
            <div
              style="width:46px; height:46px; border-radius:13px;
                background:{maint ? 'var(--df-warning-bg)' : 'var(--df-primary-bg)'};
                display:flex; align-items:center; justify-content:center; flex:none;
                color:{maint ? 'var(--df-warning)' : 'var(--df-primary)'};
                font-weight:800; font-size:19px; font-family:var(--df-font-heading);"
            >{v.id}</div>
            <div style="flex:1; min-width:0;">
              <div style="font-size:16px; font-weight:700; color:var(--df-ink);">{v.name}</div>
              <div style="font-size:12.5px; color:var(--df-text-light); margin-top:1px;">
                {v.type}
              </div>
            </div>
            <Badge {tone} dot>{label}</Badge>
          </div>
          <div style="padding:0 16px 13px;">
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
              {#each v.equip as e (e)}<Tag>{e}</Tag>{/each}
            </div>
          </div>
          <div
            style="display:flex; align-items:center; justify-content:space-between; padding:11px 16px;
              border-top:1px solid var(--df-border); background:var(--df-bg-light);"
          >
            <span style="font-size:12.5px; color:var(--df-text-light); display:flex; align-items:center; gap:6px;">
              <Icon name="calendar-days" size={14} color="var(--df-text-muted)" />
              {maint ? '今日暫停使用' : '開放預約中'}
            </span>
            <button
              on:click={() =>
                toasts.notify('info', v.name, maint ? '場地維護中，預計本週五恢復。' : '查看 ' + v.name + ' 今日時段表。')}
              style="border:none; background:transparent; color:var(--df-primary); font-size:13px;
                font-weight:700; cursor:pointer; display:flex; align-items:center; gap:2px;"
            >時段表<Icon name="chevron-right" size={15} color="var(--df-primary)" /></button>
          </div>
        </div>
      {/each}
      <div style="height:8px;"></div>
    </div>
  </div>
</PushScreen>
