// 獲取所有設備數據和統計信息
export async function handleChartDate(request, env, ctx) {
    if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 })
    }
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('device_id'); 
    let searchDate = url.searchParams.get('date'); // 可選參數，格式為 YYYY-MM-DD
    if (!deviceId) {
        return new Response(JSON.stringify({ error: "Missing device_id parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }
    if(!searchDate) {
        return new Response(JSON.stringify({ error: "Missing date parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) {
        return new Response(JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }
    console.log(`Fetching chart data for device_id: ${deviceId}, date: ${searchDate || 'today'}`);
    try {
        const { results } = await env.DB.prepare(`
            SELECT 
                STRFTIME('%H:%M', post_at, '+8 hours') as time_label,
                temperature,
                light
            FROM device_history
            WHERE device_id = ? 
                -- 找出台北時間今天的起點 (00:00)，再減 8 小時轉回 UTC 時間
                AND post_at >= DATETIME(?, 'start of day', '-8 hours')
                AND post_at < DATETIME(?, 'start of day', '+1 day', '-8 hours')
            ORDER BY post_at ASC
        `).bind(deviceId, searchDate, searchDate).all();
        const data = {
            time: results.map(row => row.time_label),
            temperatures: results.map(row => Math.round(row.temperature * 10) / 10), // 四捨五入到小數1位
            lights: results.map(row => Math.round(row.light))
        };

        return new Response(JSON.stringify(data), { status: 200 });
    } catch (e) {
        console.log("Error fetching chart data:", e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
