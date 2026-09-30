/**
 * 共享 store 暖機 helper(R14 候選 F3:自 member/api.ts 的私有 hydrateSessionStores 升格,
 * 改名 warmStores;語意與 log 格式逐字不變)。
 *
 * 兩類呼叫端:
 *   - 各 surface 的 layout 宣告自己的暖機清單(member/mobile:通知;mobile-admin 教練分區:
 *     訊息),以身分為 key 反應式呼叫——每個身分只打一次 GET:閘門守衛擋重訪、在飛合併
 *     (R14 F2)擋掉同頁的重複、換身分時閘門自己重置。
 *   - 頁面自己的 gate.fetch(member/mine、member/account、mobile/account)與主 GET 並行
 *     暖機,清單由頁面決定(getMine/getAccount 本身已不再順手水合 store)。
 *
 * best-effort 語意:tasks 彼此獨立,用 Promise.allSettled 平行執行,單項失敗只
 * console.error 記錄、不 throw——不讓一個非核心 store 的暫時性失敗擋住整頁;失敗時
 * store 保留前值,頁面仍可正常顯示。
 *
 * 與 getPoints() 刻意不同:getPoints 的 refreshPoints() 是用 Promise.all(fail-hard)——
 * 那裡的 rewards 目錄跟 points store 是同一次「進頁必要資料」的並行副產品,失敗即代表
 * 頁面本身也拿不到資料,理應讓錯誤浮上去;這裡的 tasks 則是「頁面主資料以外」的順手
 * 動作,兩者語意刻意不同,不要合流。
 *
 * tuple 形而非物件形:[中文資源名, hydrate 函式] 讓 label 留在呼叫端視野,一眼看出 log
 * 會印出什麼資源名。
 *
 * @param caller 呼叫端名稱,作為 log 前綴(如 'member/account')
 * @param tasks [中文資源名, hydrate 函式] tuple 陣列
 */
export async function warmStores(
	caller: string,
	tasks: ReadonlyArray<readonly [label: string, hydrate: () => Promise<void>]>
): Promise<void> {
	const results = await Promise.allSettled(tasks.map(([, hydrate]) => hydrate()));
	results.forEach((result, i) => {
		if (result.status === 'rejected') console.error(`${caller}: ${tasks[i][0]} hydrate 失敗`, result.reason);
	});
}
