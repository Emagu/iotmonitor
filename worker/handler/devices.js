// 獲取所有設備數據和統計信息
export async function handlerDevices(request, env, ctx) {
    if (request.method !== "GET") {
        return new Response("Method not allowed", { status: 405 })
    }

    try {
        const { results: settings } = await env.DB.prepare("SELECT * FROM settings").all();
        const { results: device_status } = await env.DB.prepare("SELECT * FROM device_status").all();
        const dataMap = Object.fromEntries(device_status.map(d => [d.device_id, d]));

        // 格式化返回數據
        const formattedDevices = {};
        settings.forEach(setting=>{
            let dId = setting.device_Id;
            if(dataMap[dId]) {
                dataMap[dId].factoryName = setting.factory_name;
            }
        });
        return new Response(JSON.stringify(dataMap), { status: 200 });
    } catch (error) {
        console.log("Error fetching devices:", error);
        return new Response("Internal server error", { status: 500 });
    }
}
