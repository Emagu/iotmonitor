import admin from "firebase-admin";
import { getSetting } from "../lib/settings.js";

// 定時檢查設備狀態和發送警報
export default async function handler(req, res) {
    // 驗證定時任務密鑰
    if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
        return res.status(401).send("Unauthorized");
    }

    try {
        // 初始化 Firebase
        const firebaseServiceAccount = JSON.parse(process.env.FIREBASE_CREDENTIAL);
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(firebaseServiceAccount),
                databaseURL: "https://iot-monitor-50d03-default-rtdb.asia-southeast1.firebasedatabase.app"
            });
        }
        const db = admin.database();

        // 獲取所有設備的最後數據
        const devicesSnapshot = await db.ref('/devices').once('value');
        const devicesData = devicesSnapshot.val();

        if (!devicesData) {
            return res.status(200).send("No devices found");
        }

        const now = Date.now();
        const oneMinuteAgo = now - (60 * 1000); // 一分鐘前的時間戳

        // 並發檢查所有設備
        const checkPromises = Object.keys(devicesData).map(deviceId => 
            checkDeviceStatus(deviceId, devicesData[deviceId], oneMinuteAgo)
        );

        const results = await Promise.allSettled(checkPromises);
        
        // 統計結果
        const alertsSent = results.filter(r => r.status === 'fulfilled' && r.value).length;
        const errors = results.filter(r => r.status === 'rejected').length;

        console.log(`Alert check completed: ${alertsSent} alerts sent, ${errors} errors`);

        res.status(200).send(`Alert check completed: ${alertsSent} alerts sent`);
    } catch (error) {
        console.error("Alert check error:", error);
        res.status(500).send("Alert check failed");
    }
}

// 檢查單個設備狀態
async function checkDeviceStatus(deviceId, deviceData, oneMinuteAgo) {
    try {
        const lastData = deviceData.lastData;
        if (!lastData || !lastData.timestamp) {
            console.warn(`No lastData found for device ${deviceId}`);
            return false;
        }

        // 獲取設備設置
        const setting = await getSetting(deviceId);
        if (!setting) {
            console.warn(`No setting found for device ${deviceId}`);
            return false;
        }

        let alerts = [];

        // 檢查1: timestamp超過一分鐘
        var timestamp = new Date(lastData.timestamp);
        console.log(timestamp);
        if (timestamp < oneMinuteAgo) {
            const minutesAgo = Math.floor((Date.now() - timestamp) / (60 * 1000));
            alerts.push(`⚠️ **設備離線警報** - 設備 ${deviceId} (${setting.FactoryName}) 已離線 ${minutesAgo} 分鐘`);
        }

        // 檢查2: temperature大於overHeat
        if (setting.overHeat && lastData.temperature > setting.overHeat) {
            alerts.push(`🔥 **溫度過高警報** - 設備 ${deviceId} (${setting.FactoryName}) 溫度 ${lastData.temperature}°C 超過設定值 ${setting.overHeat}°C`);
        }

        // 檢查3: temperature小於lowHeat
        if (setting.lowHeat && lastData.temperature < setting.lowHeat) {
            alerts.push(`❄️ **溫度過低警報** - 設備 ${deviceId} (${setting.FactoryName}) 溫度 ${lastData.temperature}°C 低於設定值 ${setting.lowHeat}°C`);
        }

        // 檢查4: light大於overLux
        if (setting.overLux && lastData.light > setting.overLux) {
            alerts.push(`💡 **光照過強警報** - 設備 ${deviceId} (${setting.FactoryName}) 光照 ${lastData.light} lux 超過設定值 ${setting.overLux} lux`);
        }

        // 如果有警報，發送Discord通知
        if (alerts.length > 0 && setting.DiscordWebhookToken) {
            await sendDiscordAlert(setting.DiscordWebhookToken, alerts, lastData);
            console.log(`Sent ${alerts.length} alerts for device ${deviceId}`);
            return true;
        }

        return false;
    } catch (error) {
        console.error(`Error checking device ${deviceId}:`, error);
        return false;
    }
}

// 發送Discord警報
async function sendDiscordAlert(webhookToken, alerts, lastData) {
    try {
        const embed = {
            title: "🚨 IoT設備警報",
            description: alerts.join('\n\n'),
            color: 0xFF0000, // 紅色
            fields: [
                {
                    name: "📊 當前數據",
                    value: `溫度: ${lastData.temperature}°C\n光照: ${lastData.light} lux\n時間: ${new Date(lastData.timestamp).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`,
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

        const response = await fetch(webhookToken, {
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