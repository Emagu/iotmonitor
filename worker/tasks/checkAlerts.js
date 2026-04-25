// 定時檢查設備狀態和發送警報
export async function checkAlertTask(env) {
    try {
        const { results: settings } = await env.DB.prepare("SELECT * FROM settings").all();
        const { results: devices } = await env.DB.prepare("SELECT * FROM device_status").all();
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
        var timestamp = new Date(deviceData.modifyDate).getTime();
        if (timestamp < oneMinuteAgo) {
            const minutesAgo = Math.floor((Date.now() - timestamp) / (60 * 1000));
            alerts.push(`⚠️ **設備離線警報** - 設備 ${deviceData.device_id} (${setting.factory_name}) 已離線 ${minutesAgo} 分鐘`);
        }

        // 檢查2: lastTemp大於overHeat
        if (setting.over_heat && deviceData.lastTemp > setting.over_heat) {
            alerts.push(`🔥 **溫度過高警報** - 設備 ${deviceData.device_id} (${setting.factory_name}) 溫度 ${deviceData.lastTemp}°C 超過設定值 ${setting.over_heat}°C`);
        }

        // 檢查3: lastTemp小於lowHeat
        if (setting.low_heat && deviceData.lastTemp < setting.low_heat) {
            alerts.push(`❄️ **溫度過低警報** - 設備 ${deviceData.device_id} (${setting.factory_name}) 溫度 ${deviceData.lastTemp}°C 低於設定值 ${setting.low_heat}°C`);
        }

        // 檢查4: lastLight大於overLux
        if (setting.over_lux && deviceData.lastLight > setting.over_lux) {
            alerts.push(`💡 **光照過強警報** - 設備 ${deviceData.device_id} (${setting.factory_name}) 光照 ${deviceData.lastLight} lux 超過設定值 ${setting.over_lux} lux`);
        }

        // 如果有警報，發送Discord通知
        if (alerts.length > 0 && setting.discord_token && setting.is_notify_discord) {
            await sendDiscordAlert(setting.discord_token, alerts, deviceData);
            console.log(`Sent ${alerts.length} alerts to discord for device ${deviceData.device_id}`);
        }
        if (alerts.length > 0 && setting.telegram_token && setting.telegram_chat_id && setting.is_notify_telegram) {
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
        let post_at = new Date(new Date(lastData.modifyDate).getTime() + 8 * 60 * 60 * 1000); // 調整為台北時間
        const embed = {
            title: "🚨 IoT設備警報",
            description: alerts.join('\n\n'),
            color: 0xFF0000, // 紅色
            fields: [
                {
                    name: "📊 當前數據",
                    value: `溫度: ${lastData.lastTemp}°C\n光照: ${lastData.lastLight} lux\n時間: ${post_at.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`,
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
        let post_at = new Date(new Date(lastData.modifyDate).getTime() + 8 * 60 * 60 * 1000); // 調整為台北時間
        const message = alerts.join('\n\n');
        const response = await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                chat_id: chatId,
                text: "<b>🚨 IoT設備警報</b>\n " + message + `\n<b>📊 當前數據</b>\n溫度: <code>${lastData.lastTemp}°C</code>\n光照: <code>${lastData.lastLight} lux</code>\n時間: <code>${post_at.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}</code>`,
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
            