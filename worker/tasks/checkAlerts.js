// 定時檢查設備狀態和發送警報
export async function checkAlertTask(env) {
    try {
        const { results: settings } = await env.DB.prepare("SELECT * FROM settings").all();
        const { results: devices } = await env.DB.prepare("SELECT * FROM devices WHERE rowid IN (SELECT MAX(rowid) FROM devices GROUP BY device_Id) and created_at >= datetime('now', '-10 minutes')").all();
        // 併發檢查所有設備
        let checkPromises = [];
        const now = Date.now();
        const oneMinuteAgo = now - (60 * 1000); // 一分鐘前的時間戳
        settings.forEach((s)=>{
            checkPromises.push(checkDeviceStatus(s, devices.find(d=>d.device_id == s.device_Id), oneMinuteAgo));
        });
        const checkResult = await Promise.allSettled(checkPromises);

        // 統計結果
        const alertsSent = checkResult.filter(r => r.status === 'fulfilled' && r.value).length;
        const errors = checkResult.filter(r => r.status === 'rejected').length;

        console.log(`Alert check completed: ${alertsSent} alerts sent, ${errors} errors`);

    } catch (error) {
        console.error("Alert check error:", error);
    }
}
async function checkDeviceStatus(setting, deviceData, oneMinuteAgo) {
    try {
        let alerts = [];
        // 檢查1: timestamp超過一分鐘
        var timestamp = new Date(deviceData.post_at);
        if (timestamp < oneMinuteAgo) {
            const minutesAgo = Math.floor((Date.now() - timestamp) / (60 * 1000));
            alerts.push(`⚠️ **設備離線警報** - 設備 ${deviceData.device_id} (${setting.factory_name}) 已離線 ${minutesAgo} 分鐘`);
        }

        // 檢查2: temperature大於overHeat
        if (setting.over_heat && deviceData.temperature > setting.over_heat) {
            alerts.push(`🔥 **溫度過高警報** - 設備 ${deviceData.device_id} (${setting.factory_name}) 溫度 ${deviceData.temperature}°C 超過設定值 ${setting.over_heat}°C`);
        }

        // 檢查3: temperature小於lowHeat
        if (setting.low_heat && deviceData.temperature < setting.low_heat) {
            alerts.push(`❄️ **溫度過低警報** - 設備 ${deviceData.device_id} (${setting.factory_name}) 溫度 ${deviceData.temperature}°C 低於設定值 ${setting.low_heat}°C`);
        }

        // 檢查4: light大於overLux
        if (setting.over_lux && deviceData.light > setting.over_lux) {
            alerts.push(`💡 **光照過強警報** - 設備 ${deviceData.device_id} (${setting.factory_name}) 光照 ${deviceData.light} lux 超過設定值 ${setting.over_lux} lux`);
        }

        // 如果有警報，發送Discord通知
        if (alerts.length > 0 && setting.discord_token) {
            await sendDiscordAlert(setting.discord_token, alerts, deviceData);
            console.log(`Sent ${alerts.length} alerts to discord for device ${deviceData.device_id}`);
        }
        if (alerts.length > 0 && setting.telegram_token && setting.telegram_chat_id) {
            await sendTelegramAlert(setting.telegram_token, setting.telegram_chat_id, alerts, deviceData);
            console.log(`Sent ${alerts.length} alerts to telegram for device ${deviceData.device_id}`);
        }
        return true;
    } catch (error) {
        console.log(`Error checking device ${deviceId}:`, error);
        return false;
    }
}


// 發送Discord警報
async function sendDiscordAlert(webhookToken, alerts, lastData) {
    try {
        let post_at = new Date(new Date(lastData.post_at).getTime() + 8 * 60 * 60 * 1000); // 調整為台北時間
        const embed = {
            title: "🚨 IoT設備警報",
            description: alerts.join('\n\n'),
            color: 0xFF0000, // 紅色
            fields: [
                {
                    name: "📊 當前數據",
                    value: `溫度: ${lastData.temperature}°C\n光照: ${lastData.light} lux\n時間: ${post_at.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`,
                    inline: true
                }
            ],
            timestamp: new Date().toISOString(),
            footer: {
                text: "IoT監控系統"
            }
        };

        const payload = {
            embeds: [embed]
        };

        const response = await fetch('https://discord.com/api/webhooks/' + webhookToken, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Discord webhook failed: ${response.status}`);
        }

        console.log('Discord alert sent successfully');
    } catch (error) {
        console.error('Error sending Discord alert:', error);
        throw error;
    }
} 

// 發送telegram警報
async function sendTelegramAlert(telegramToken, chatId, alerts, lastData) {
    try {
        let post_at = new Date(new Date(lastData.post_at).getTime() + 8 * 60 * 60 * 1000); // 調整為台北時間
        const message = alerts.join('\n\n');
        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: "<b>🚨 IoT設備警報</b>\n " + message + `\n<b>📊 當前數據</b>\n溫度: <code>${lastData.temperature}°C</code>\n光照: <code>${lastData.light} lux</code>\n時間: <code>${post_at.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</code>`,
                parse_mode: "HTML"
            })
        });
        if (!response.ok) {
            throw new Error(`Telegram API failed: ${response.status}`);
        }

        console.log('Telegram alert sent successfully');
    } catch (error) {
        console.error('Error sending Telegram alert:', error);
        throw error;
    }
} 
            