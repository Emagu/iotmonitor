import admin from "firebase-admin";
import * as utils from "../lib/Utils.js";

// 改為 export default
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).send("Method not allowed");
    }

    const {
        deviceId,
        temperature,
        light,
        timestamp,
        token
    } = req.body;
	
    if (token !== process.env.API_REQUEST_PWD) {
        return res.status(401).send("no auth");
    }

    if (!deviceId || !timestamp) {
        return res.status(400).send("Missing required fields");
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
        
        // 准备数据
        const recordTime = new Date(timestamp);
        const queueData = {
            deviceId,
            temperature,
            light,
            timestamp: recordTime.getTime(),
            timeFormatted: utils.GetTimeFormat(recordTime),
            dateFormatted: utils.GetDateFormat(recordTime),
            createdAt: Date.now()
        };

        // 使用批量操作同时更新两个位置
        const updates = {};
        updates[`/devices/${deviceId}/lastData`] = {
            temperature,
            light,
            timestamp
        };
        updates[`/dataQueue/${deviceId}/${Date.now()}`] = queueData;

        // 批量写入，减少数据库请求次数
        await db.ref().update(updates);

        res.status(200).send("Data uploaded");
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal error");
    }
}