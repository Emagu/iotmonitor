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

// 定时任务处理函数
export default async function handler(req, res) {
    // 验证定时任务密钥
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

        // 获取所有待处理数据
        const queueSnapshot = await db.ref('/dataQueue').once('value');
        const queueData = queueSnapshot.val();

        if (!queueData) {
            return res.status(200).send("No data to sync");
        }

        // 按设备分组数据
        const deviceGroups = {};
        for (const deviceId in queueData) {
            deviceGroups[deviceId] = Object.values(queueData[deviceId]);
        }

        // 并发处理每个设备的数据
        const auth = getGoogleAuth();
        const sheets = google.sheets({ version: "v4", auth });

        // 使用 Promise.all 并发处理多个设备
        const devicePromises = Object.keys(deviceGroups).map(deviceId => 
            processDeviceData(sheets, deviceId, deviceGroups[deviceId], db)
        );

        await Promise.all(devicePromises);

        res.status(200).send("Sync completed");
    } catch (error) {
        console.error("Sync error:", error);
        res.status(500).send("Sync failed");
    }
}

// 处理单个设备的数据
async function processDeviceData(sheets, deviceId, dataList, db) {
    try {
        const setting = await getSetting(deviceId);
        if (!setting.DataSheetFileId) {
            console.warn(`No sheet ID configured for device ${deviceId}`);
            // 即使没有配置，也要清除队列数据避免堆积
            await db.ref(`/dataQueue/${deviceId}`).remove();
            return;
        }

        // 按日期分组数据
        const dateGroups = {};
        dataList.forEach(data => {
            const dateKey = data.dateFormatted;
            if (!dateGroups[dateKey]) {
                dateGroups[dateKey] = [];
            }
            dateGroups[dateKey].push(data);
        });

        // 并发处理每个日期的数据
        const datePromises = Object.keys(dateGroups).map(dateKey => 
            processDateData(sheets, setting.DataSheetFileId, dateKey, dateGroups[dateKey])
        );

        await Promise.all(datePromises);

        // 清除已处理的数据
        await db.ref(`/dataQueue/${deviceId}`).remove();
        
        console.log(`Processed ${dataList.length} records for device ${deviceId}`);
    } catch (error) {
        console.error(`Error processing device ${deviceId}:`, error);
        // 错误时不删除队列数据，保留重试机会
        throw error;
    }
}

// 处理单个日期的数据
async function processDateData(sheets, spreadsheetId, sheetName, dataList) {
    try {
        // 确保工作表存在
        await utils.ensureSheetExists(sheets, spreadsheetId, sheetName);

        // 准备批量数据
        const values = dataList.map(data => [
            data.temperature,
            data.light,
            data.timeFormatted,
            data.timestamp
        ]);

        // 批量写入数据
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