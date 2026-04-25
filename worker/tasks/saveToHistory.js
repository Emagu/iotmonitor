// 定時任務處理函數 - 統計近10分資料任務
export async function saveToHistoryTask(env) {
    try {
        await env.DB.prepare(
        `INSERT INTO device_history (device_id, temperature, light, post_at) SELECT device_id, avgTemp, avgLight, datetime('now') FROM device_status`
      ).run();
        console.log(`save to history data successfully at ${new Date().toISOString()}`);
    } catch (error) {
        console.error("Save to history error:", error);
    }
}
