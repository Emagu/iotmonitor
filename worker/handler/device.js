// 獲取所有設備數據和統計信息
export async function handlerDevice(request, env, ctx) {
    const url = new URL(request.url);
    let deviceId = null;
    if (request.method === "GET") {
        try {
            deviceId = url.searchParams.get('device_id'); 
            const { results: settings } = await env.DB.prepare("SELECT * FROM settings where device_id = ?").bind(deviceId).all();
            if (settings.length === 0) {
                return new Response("Device not found", { status: 404 });
            }
            return new Response(JSON.stringify({
                factory_name: settings[0].factory_name,
                over_heat: settings[0].over_heat,
                low_heat: settings[0].low_heat,
                over_lux: settings[0].over_lux,
                is_notify_discord: settings[0].is_notify_discord,
                is_notify_telegram: settings[0].is_notify_telegram
            }), { status: 200 });
        } catch (error) {
            console.log("Error fetching device device_id=" + deviceId + ":", error);
            return new Response("Internal server error", { status: 500 });
        }
    }
    else if (request.method === "PUT") {
        try {
            deviceId = url.searchParams.get('device_id'); 
            const { over_heat, low_heat, over_lux, is_notify_discord, is_notify_telegram } = await request.json();
            const { results: settings } = await env.DB.prepare("SELECT * FROM settings where device_id = ?").bind(deviceId).all();
            if (settings.length === 0) {
                return new Response("Device not found", { status: 404 });
            }
            await env.DB.prepare("UPDATE settings SET over_heat = ?, low_heat = ?, over_lux = ?, is_notify_discord = ?, is_notify_telegram = ? WHERE device_id = ?").bind(over_heat, low_heat, over_lux, is_notify_discord, is_notify_telegram, deviceId).run();
            return new Response("Device settings updated", { status: 200 });
        } catch (error) {
            console.log("Error updating device device_id=" + deviceId + ":", error);
            return new Response("Internal server error", { status: 500 });
        }
    }
    else {
        return new Response("Method not allowed", { status: 405 })
    }
}
