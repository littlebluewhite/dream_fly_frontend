# 編輯對話框 reset 慣用式維持分散

> Status: Accepted。源自 2026-07-16 架構深化工程 8 卡批次之卡 7(admin 編輯對話框 reset 回歸補測
> ＋初始工作副本 clone 修正,2026-07-16 落地)。

## 背景

admin 的四個編輯對話框各自手寫 working-copy 的 reset 生命週期,分兩族:**entity 族**三個
(`ClassEditDialog`/`TicketEditDialog`/`VenueEditDialog`——prop 變更時 `$:` 分支 `{ ...prop }`
clone 進本地 `f`,並重建各自的派生 string buffer)與 **derive 族**一個(`OrderDialog`——`nextStatus`
由當前訂單即時派生,無持久草稿)。架構審查曾建議收斂成統一的 `shouldReset` helper。

## 決定一:不建統一 helper,reset 慣用式維持分散

2026-07-16 使用者裁決維持分散,理由落字以防未來架構審查 re-suggest:

- **derive 族有兩次回歸史**:`OrderDialog` 的 nextStatus 派生形正是先前兩次回歸修出來的形狀,
  其開/關 bookkeeping 刻意拆成兩條各自無狀態的 `$:`(換單重設、關閉清空);entity 族三檔則是
  「prop 變更 → clone 進本地 + 重建 buffer」的單條同步分支——reset 佈線形狀本就異質(member 側
  的 Leave/MakeupDialog 另有 FE#19 單一 reactive statement 約束,見該處註解,不在本 ADR 範圍)。
  一個共用 helper 必須同時容納「clone 進本地」與「即時派生」兩種相反的資料流與兩種守衛形,
  介面複雜度趨近實作本身(shallow module)。
- **entity 族每處僅省一行**:三個對話框的差異全在各自的 buffer 重建(cap/price/sessions/duration
  vs priceText/quotaText vs equipText),能共用的只有「prop 變了就 clone」一行;刪除測試(deletion
  test)下 helper 只是把複雜度搬家,不是收斂。

守衛改用測試而非抽象:四檔各補「換實體不殘留 + 關閉重開丟棄髒草稿/重派生」成對回歸 its
(共 8 個,措辭仿 `CouponCreateDialog.test.ts` 的成對先例),reset 語意此後由測試釘住,誰改壞誰紅。

## 決定二(隨批發現):初始工作副本必須 clone,不得別名

補測前提「現況行為正確」被證偽:三個 entity 族對話框的**初始** working copy 是別名
(`let f: ClassRow | null = klass;`),只有 prop 變更的 `$:` 分支才 clone——初次掛載後的
`bind:value={f.*}` 編輯**直接污染呼叫端傳入的原實體**(三個呼叫端頁面都是把列表列的原參照傳入,
取消不救、列表資料已髒)。修正:三檔初始行改 `prop ? { ...prop } : null` clone 形(一行/檔;
`OrderDialog` 為 derive 形無此缺陷,零產品碼改動)。落地時做過可證偽驗證:暫時還原別名形,
「關閉重開 + 原實體未污染」回歸 it 立即紅、錯誤簽名即污染本身;改回 clone 全綠。此後
**「working copy 生命週期的每一步(初始、prop 變更)都必須產生新物件」**是這四個對話框的固定約束,
由上述回歸 its 釘住。

## 關聯 ADR

- **`docs/adr/0012`**:統一 helper 的否決與其「太薄、抽出不比呼叫點深」的既有否決紀律同源;
  本 ADR 把該裁決固定下來,未來審查請先讀此篇再提對話框 reset 收斂。
- **`docs/adr/0014`**:同批次 ADR;卡 7 與其餘七卡的批次脈絡見彼處 Status 段。
