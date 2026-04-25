// 定時任務處理函數 - 統計近10分資料任務
export async function deleteOverTimeTask(env) {
    try {
        await env.DB.prepare("delete FROM device_history WHERE created_at >= datetime('now', '-7 days')").run();
        console.log(`delete over time data successfully at ${new Date().toISOString()}`);
    } catch (error) {
        console.error("Delete over time error:", error);
    }
}
