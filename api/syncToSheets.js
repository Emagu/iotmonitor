import admin from "firebase-admin";
import {
    google
} from "googleapis";
import {
    getGoogleAuth
} from "../lib/googleAuth.js";
import {
    getSetting
} from "../lib/settings.js";
import * as utils from "../lib/Utils.js";

// 定時任務處理函數 - 同步到Sheets並更新統計數據
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

        // 獲取所有待處理數據
        const queueSnapshot = await db.ref('/dataQueue').once('value');
        const queueData = queueSnapshot.val();

        // 獲取所有設備數據（用於統計）
        const devicesSnapshot = await db.ref('/devices').once('value');
        const devicesData = devicesSnapshot.val();

        if (!queueData && !devicesData) {
            return res.status(200).send("No data to process");
        }

        let syncResult = "No data to sync";
        let statsResult = "No devices to update";

        // 先更新統計數據（在同步之前）
        if (devicesData) {
            statsResult = await updateStats(devicesData, db, queueData);
        }

        // 再進行數據同步（統計完成後）
        if (queueData) {
            syncResult = await syncToSheets(queueData, db);
        }

        console.log(`Stats: ${statsResult}, Sync: ${syncResult}`);
        res.status(200).send(`Stats and sync completed`);
    } catch (error) {
        console.error("Stats and sync error:", error);
        res.status(500).send("Stats and sync failed");
    }
}

// 同步到Google Sheets
async function syncToSheets(queueData, db) {
    try {
        // 按設備分組數據
        const deviceGroups = {};
        for (const deviceId in queueData) {
            deviceGroups[deviceId] = Object.values(queueData[deviceId]);
        }

        // 並發處理每個設備的數據
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: "v4", auth });

        // 使用 Promise.all 並發處理多個設備
        const devicePromises = Object.keys(deviceGroups).map(deviceId => 
            processDeviceData(sheets, deviceId, deviceGroups[deviceId], db)
        );

        await Promise.all(devicePromises);
        return "Sync completed";
    } catch (error) {
        console.error("Sync error:", error);
        throw error;
    }
}

// 更新統計數據
async function updateStats(devicesData, db, queueData) {
    try {
        const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
        const updates = {};

        // 並發處理所有設備的統計數據
        const updatePromises = Object.keys(devicesData).map(async (deviceId) => {
            try {
                let recentData = null;

                // 如果有隊列數據，直接使用（避免重複查詢）
                if (queueData && queueData[deviceId]) {
                    const deviceQueueData = queueData[deviceId];
                    // 過濾最近10分鐘的數據
                    recentData = {};
                    Object.keys(deviceQueueData).forEach(key => {
                        const record = deviceQueueData[key];
                        if (record.timestamp >= tenMinutesAgo) {
                            recentData[key] = record;
                        }
                    });
                } else {
                    // 如果沒有隊列數據，從數據庫查詢
                    const recentDataSnapshot = await db.ref('/dataQueue')
                        .child(deviceId)
                        .orderByChild('timestamp')
                        .startAt(tenMinutesAgo)
                        .once('value');
                    
                    recentData = recentDataSnapshot.val();
                }
                
                // 計算統計數據
                const stats = calculateStats(recentData);
                
                // 準備更新
                updates[`/devices/${deviceId}/stats`] = {
                    ...stats,
                    lastUpdated: Date.now()
                };

                console.log(`Updated stats for device ${deviceId}: ${stats.dataCount} records`);
            } catch (error) {
                console.error(`Error updating stats for device ${deviceId}:`, error);
            }
        });

        await Promise.all(updatePromises);

        // 批量更新所有統計數據
        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
            console.log(`Updated stats for ${Object.keys(updates).length} devices`);
        }

        return "Stats updated successfully";
    } catch (error) {
        console.error("Stats update error:", error);
        throw error;
    }
}

// 處理單個設備的數據
async function processDeviceData(sheets, deviceId, dataList, db) {
    try {
        const setting = await getSetting(deviceId);
        if (!setting.DataSheetFileId) {
            console.warn(`No sheet ID configured for device ${deviceId}`);
            // 即使沒有配置，也要清除隊列數據避免堆積
            await db.ref(`/dataQueue/${deviceId}`).remove();
            return;
        }

        // 按日期分組數據
        const dateGroups = {};
        dataList.forEach(data => {
            const dateKey = data.dateFormatted;
            if (!dateGroups[dateKey]) {
                dateGroups[dateKey] = [];
            }
            dateGroups[dateKey].push(data);
        });

        // 並發處理每個日期的數據
        const datePromises = Object.keys(dateGroups).map(dateKey => 
            processDateData(sheets, setting.DataSheetFileId, dateKey, dateGroups[dateKey])
        );

        await Promise.all(datePromises);

        // 清除已處理的數據
        await db.ref(`/dataQueue/${deviceId}`).remove();
        
        console.log(`Processed ${dataList.length} records for device ${deviceId}`);
    } catch (error) {
        console.error(`Error processing device ${deviceId}:`, error);
        // 錯誤時不刪除隊列數據，保留重試機會
        throw error;
    }
}

// 處理單個日期的數據
async function processDateData(sheets, spreadsheetId, sheetName, dataList) {
    try {
        // 確保工作表存在
        await utils.ensureSheetExists(sheets, spreadsheetId, sheetName);

        // 準備批量數據
        const values = dataList.map(data => [
            data.temperature,
            data.light,
            data.timeFormatted,
            data.timestamp
        ]);

        // 批量寫入數據
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A:D`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values }
        });

        console.log(`Synced ${dataList.length} records to sheet ${sheetName}`);
    } catch (error) {
        console.error(`Error syncing to sheet ${sheetName}:`, error);
        throw error;
    }
}

// 計算統計數據
function calculateStats(data) {
    if (!data) {
        return {
            avgTemp: null,
            maxTemp: null,
            minTemp: null,
            avgLight: null,
            maxLight: null,
            minLight: null,
            dataCount: 0
        };
    }

    const temperatures = [];
    const lights = [];
    
    // 收集所有數據
    Object.values(data).forEach(record => {
        if (record.temperature !== undefined && record.temperature !== null) {
            temperatures.push(parseFloat(record.temperature));
        }
        if (record.light !== undefined && record.light !== null) {
            lights.push(parseFloat(record.light));
        }
    });

    // 計算統計數據
    const stats = {
        avgTemp: temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : null,
        maxTemp: temperatures.length > 0 ? Math.max(...temperatures) : null,
        minTemp: temperatures.length > 0 ? Math.min(...temperatures) : null,
        avgLight: lights.length > 0 ? lights.reduce((a, b) => a + b, 0) / lights.length : null,
        maxLight: lights.length > 0 ? Math.max(...lights) : null,
        minLight: lights.length > 0 ? Math.min(...lights) : null,
        dataCount: Object.keys(data).length
    };

    return stats;
} 