// 獲取所有設備數據和統計信息
export async function handlerDevices(request, env, ctx) {
    if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 })
    }

    try {
        const { results: settings } = await env.DB.prepare("SELECT * FROM settings").all();
        const { results: devicesStats } = await env.DB.prepare("SELECT * FROM deviceStats").all();
        const { results: devicesData } = await env.DB.prepare("SELECT * FROM devices WHERE rowid IN (SELECT MAX(rowid) FROM devices GROUP BY device_Id)").all();
        const dataMap = Object.fromEntries(devicesData.map(d => [d.device_id, d]));
        const statsMap = Object.fromEntries(devicesStats.map(s => [s.device_id, s]));

        // 格式化返回數據
        const formattedDevices = {};
        settings.forEach(setting=>{
            const dId = setting.device_Id; 
            formattedDevices[dId] = {
                lastData: dataMap[dId] || {},
                stats: statsMap[dId] || {
                    avgTemp: null,
                    maxTemp: null,
                    minTemp: null,
                    avgLight: null,
                    maxLight: null,
                    minLight: null,
                    dataCount: 0
                }
            };
        });
        return new Response(JSON.stringify({ devices: formattedDevices }), { status: 200 });
    } catch (error) {
        console.log("Error fetching devices:", error);
        return new Response("Internal server error", { status: 500 });
    }
}
