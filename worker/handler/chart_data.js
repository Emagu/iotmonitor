// 獲取所有設備數據和統計信息
export async function handleChartDate(request, env, ctx) {
    if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 })
    }
    const url = new URL(request.url);
    const deviceId = url.searchParams.get('device_id'); 
    if (!deviceId) {
        return new Response(JSON.stringify({ error: "Missing device_id parameter" }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }
    try {
        const { results } = await env.DB.prepare(`
            SELECT 
                STRFTIME('%H:%M', post_at, '+8 hours') as time_label,
                AVG(temperature) as avg_temp,
                AVG(light) as avg_light  -- 假設光度欄位名稱為 light
            FROM devices
            WHERE device_id = ? 
                AND post_at >= DATETIME('now', 'start of day', '-8 hours')
            GROUP BY STRFTIME('%Y-%m-%d %H:', post_at, '+8 hours') || (CAST(STRFTIME('%M', post_at, '+8 hours') AS INTEGER) / 10)
            ORDER BY post_at ASC
        `).bind(deviceId).all();
        const data = {
            time: results.map(row => row.time_label),
            temperatures: results.map(row => Math.round(row.avg_temp * 10) / 10), // 四捨五入到小數1位
            lights: results.map(row => Math.round(row.avg_light))
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
