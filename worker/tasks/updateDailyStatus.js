// 定時檢查設備狀態和發送警報
export async function updateDailyStatusTask(env) {
    try {
        await env.DB.prepare(
            `update device_status set \
            maxTempFullDay=?, \
            minTempFullDay=?, \
            maxlightFullDay=?`
        ).bind(20, 30, 0).run();
    } catch (error) {
        console.error("updateDailyStatusTask error:", error);
    }
}
