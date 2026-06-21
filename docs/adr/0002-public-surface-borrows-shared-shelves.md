# 公開／行銷 surface 刻意借用共用 shelf

公開／行銷 surface（`/`、`/courses`、`/tickets`、`/cart` 等路由）沒有自己的 `lib/` 資料夾；它**刻意**借用 `lib/stores/`（`toastStore`、`notificationsStore`）、`lib/components/`、`lib/data/` 作為它的家。這是有意的設計，不是待修的缺陷。

## 背景與決定

架構審查候選 #7 原提議把行銷 stores（`toastStore`、`notificationsStore`）搬到新的 `lib/public/`，以對齊其餘六個 surface 各有 `lib/<surface>/` 的慣例。經 grilling 後決定**不搬，改為 relabel**——讓 shelf 的文件標籤（`docs/architecture.md` 第 31 行）與各檔頭誠實標示：`authStore` 是跨 surface 的 cross-cutting store；`toastStore` 與 `notificationsStore` 則屬於公開／行銷 surface。

## 後果

### 為何不搬（load-bearing 理由）

1. **只搬 stores 造成半途遷移**：`lib/components/` 與 `lib/data/` 仍留在共用 shelf，surface 的程式碼反而更分散，locality 沒有改善。
2. **churn 換不到行為價值**：約 8 個 import site 需要調整路徑，卻沒有任何執行期差異，屬純表面整理。
3. **與候選 #4 重複 churn**：候選 #4（toast 介面收斂：目前存在 6 個實作、2 種介面命名且簽章不一）也需要動到 `toastStore.ts`；搬移應留給 #4 一次處理，避免對同一檔案重複修改。
4. **真正的 navigability 痛點已解決**：`cartStore.ts` 死碼（造成「購物車到底在哪？」的混亂）已由本批次 Part A 刪除，不需要搬移行銷 stores 來改善可讀性。

relabel 以最小代價達成誠實標示，符合「簡單優先、手術式修改」的原則。

### 替代方案（已知、暫緩）

完整的 `lib/public/` 正規化（stores + components + data 一起搬）留作日後一次性的 surface 正規化，不在本範圍。此方案待 #4 toast 介面收斂完成後，整批搬移成本才合理。

---

下次架構審查若再看到 `toastStore` 或 `notificationsStore` 位於 `lib/stores/`，請先回看本 ADR，勿重提搬移——除非 `lib/public/` 正規化已被另案納入範圍。
